#!/usr/bin/env python3
"""Validate the static site without third-party dependencies."""

from __future__ import annotations

import re
import json
import struct
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
HTML_FILES = sorted(ROOT.glob("*.html"))
CSS_FILES = sorted((ROOT / "assets").glob("*.css"))
EXTERNAL_SCHEMES = {"http", "https", "mailto", "tel", "data"}
PUBLIC_BASE = "https://yan-yongchun.github.io/Personal-blog/"
NON_INDEXED_PAGES = {"404.html", "offline.html"}


class PageParser(HTMLParser):
    def __init__(self, path: Path) -> None:
        super().__init__(convert_charrefs=True)
        self.path = path
        self.doctype = False
        self.lang = ""
        self.charset = ""
        self.title_parts: list[str] = []
        self.in_title = False
        self.meta_names: set[str] = set()
        self.meta_values: dict[str, str] = {}
        self.meta_properties: dict[str, str] = {}
        self.http_equiv: dict[str, str] = {}
        self.link_relations: dict[str, list[dict[str, str]]] = {}
        self.ids: set[str] = set()
        self.duplicate_ids: set[str] = set()
        self.references: list[tuple[str, str, str]] = []
        self.headings: list[int] = []
        self.counts: Counter[str] = Counter()
        self.images: list[dict[str, str]] = []
        self.buttons: list[dict[str, str]] = []
        self.controls: list[tuple[str, dict[str, str]]] = []
        self.label_targets: set[str] = set()
        self.inline_handlers: list[tuple[str, str]] = []
        self.inline_styles: list[str] = []
        self.inline_scripts = 0
        self.links: list[dict[str, str]] = []

    def handle_decl(self, decl: str) -> None:
        if decl.lower() == "doctype html":
            self.doctype = True

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {name.lower(): value or "" for name, value in attrs}
        self.counts[tag] += 1

        if tag == "html":
            self.lang = values.get("lang", "")
        elif tag == "meta":
            if "charset" in values:
                self.charset = values["charset"].lower()
            if values.get("name"):
                name = values["name"].lower()
                self.meta_names.add(name)
                self.meta_values[name] = values.get("content", "")
            if values.get("property"):
                self.meta_properties[values["property"].lower()] = values.get("content", "")
            if values.get("http-equiv"):
                self.http_equiv[values["http-equiv"].lower()] = values.get("content", "")
            if values.get("property") == "og:image" and values.get("content"):
                self.references.append(("meta", "content", values["content"]))
        elif tag == "link":
            for relation in values.get("rel", "").lower().split():
                self.link_relations.setdefault(relation, []).append(values)
        elif tag == "a":
            self.links.append(values)
        elif tag == "title":
            self.in_title = True
        elif tag == "script" and not values.get("src"):
            self.inline_scripts += 1
        elif tag == "img":
            self.images.append(values)
        elif tag == "button":
            self.buttons.append(values)
        elif tag in {"input", "textarea", "select"}:
            if values.get("type", "").lower() != "hidden":
                self.controls.append((tag, values))
        elif tag == "label" and values.get("for"):
            self.label_targets.add(values["for"])

        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.headings.append(int(tag[1]))

        element_id = values.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicate_ids.add(element_id)
            self.ids.add(element_id)

        for attr in values:
            if attr.startswith("on"):
                self.inline_handlers.append((tag, attr))
            if attr == "style":
                self.inline_styles.append(tag)

        for attr in ("href", "src", "poster"):
            value = values.get(attr)
            if value:
                self.references.append((tag, attr, value))

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return "".join(self.title_parts).strip()


def local_target(source: Path, raw_url: str) -> tuple[Path | None, str]:
    if raw_url.startswith("//"):
        return None, ""
    parsed = urlsplit(raw_url)
    if parsed.scheme.lower() in EXTERNAL_SCHEMES:
        return None, ""
    path_text = unquote(parsed.path)
    if not path_text:
        return source, unquote(parsed.fragment)
    if path_text.startswith("/"):
        target = ROOT / path_text.lstrip("/")
    else:
        target = source.parent / path_text
    return target.resolve(), unquote(parsed.fragment)


def parse_pages() -> dict[Path, PageParser]:
    pages: dict[Path, PageParser] = {}
    for path in HTML_FILES:
        parser = PageParser(path)
        parser.feed(path.read_text(encoding="utf-8"))
        pages[path.resolve()] = parser
    return pages


def validate_pages(pages: dict[Path, PageParser]) -> list[str]:
    errors: list[str] = []
    titles = Counter(page.title for page in pages.values())
    descriptions = Counter(page.meta_values.get("description", "") for page in pages.values())
    for path, page in pages.items():
        label = path.relative_to(ROOT)
        is_indexed = label.name not in NON_INDEXED_PAGES
        if not page.doctype:
            errors.append(f"{label}: missing <!doctype html>")
        if page.lang != "zh-CN":
            errors.append(f"{label}: html lang must be zh-CN")
        if page.charset != "utf-8":
            errors.append(f"{label}: missing UTF-8 charset")
        if not page.title:
            errors.append(f"{label}: missing document title")
        if "viewport" not in page.meta_names:
            errors.append(f"{label}: missing viewport meta")
        if "description" not in page.meta_names:
            errors.append(f"{label}: missing description meta")
        if "referrer" not in page.meta_names:
            errors.append(f"{label}: missing referrer policy")
        if "content-security-policy" not in page.http_equiv:
            errors.append(f"{label}: missing Content Security Policy")
        if "manifest" not in page.link_relations:
            errors.append(f"{label}: missing web app manifest")
        if "apple-touch-icon" not in page.link_relations:
            errors.append(f"{label}: missing apple touch icon")
        if page.title and titles[page.title] > 1:
            errors.append(f"{label}: document title is not unique")
        description = page.meta_values.get("description", "")
        if description and descriptions[description] > 1:
            errors.append(f"{label}: meta description is not unique")

        if is_indexed:
            required_properties = {"og:type", "og:locale", "og:title", "og:description", "og:url", "og:image", "og:image:alt"}
            for property_name in sorted(required_properties - page.meta_properties.keys()):
                errors.append(f"{label}: missing {property_name} metadata")
            if page.meta_values.get("twitter:card") != "summary_large_image":
                errors.append(f"{label}: twitter card must be summary_large_image")
            if "noindex" in page.meta_values.get("robots", "").lower():
                errors.append(f"{label}: public page must not be noindex")
            canonical_links = page.link_relations.get("canonical", [])
            if len(canonical_links) != 1:
                errors.append(f"{label}: expected exactly one canonical link")
            else:
                expected_path = "" if label.name == "index.html" else quote(label.name)
                expected_canonical = PUBLIC_BASE + expected_path
                if canonical_links[0].get("href") != expected_canonical:
                    errors.append(f"{label}: canonical URL must be {expected_canonical}")
                if page.meta_properties.get("og:url") != expected_canonical:
                    errors.append(f"{label}: og:url must match canonical URL")
        elif "noindex" not in page.meta_values.get("robots", "").lower():
            errors.append(f"{label}: utility page must be noindex")
        if page.counts["h1"] != 1:
            errors.append(f"{label}: expected exactly one h1, found {page.counts['h1']}")
        if page.counts["main"] != 1:
            errors.append(f"{label}: expected exactly one main element")
        if page.counts["nav"] < 1:
            errors.append(f"{label}: missing nav element")
        if page.counts["footer"] != 1:
            errors.append(f"{label}: expected exactly one footer element")
        for duplicate in sorted(page.duplicate_ids):
            errors.append(f"{label}: duplicate id #{duplicate}")
        for previous, current in zip(page.headings, page.headings[1:]):
            if current > previous + 1:
                errors.append(f"{label}: heading level jumps from h{previous} to h{current}")
        for image in page.images:
            src = image.get("src", "<unknown>")
            if "alt" not in image:
                errors.append(f"{label}: image {src} is missing alt text")
            if not image.get("width") or not image.get("height"):
                errors.append(f"{label}: image {src} is missing width/height")
            if image.get("decoding") != "async":
                errors.append(f"{label}: image {src} must use asynchronous decoding")
        for button in page.buttons:
            if not button.get("type"):
                errors.append(f"{label}: button is missing an explicit type")
        for tag, attrs in page.controls:
            control_id = attrs.get("id", "")
            if not control_id:
                errors.append(f"{label}: {tag} is missing an id")
            elif control_id not in page.label_targets and not attrs.get("aria-label"):
                errors.append(f"{label}: form control #{control_id} has no label")
        for tag, attr in page.inline_handlers:
            errors.append(f"{label}: inline event handler {attr} on <{tag}> is not allowed")
        for tag in page.inline_styles:
            errors.append(f"{label}: inline style on <{tag}> is not allowed")
        if page.inline_scripts:
            errors.append(f"{label}: inline executable scripts are not allowed")

        for link in page.links:
            href = link.get("href", "")
            parsed = urlsplit(href)
            if parsed.scheme == "http" and parsed.hostname not in {"127.0.0.1", "localhost"}:
                errors.append(f"{label}: insecure external link {href}")
            if link.get("target", "").lower() == "_blank":
                rel_tokens = set(link.get("rel", "").lower().split())
                if not {"noopener", "noreferrer"}.issubset(rel_tokens):
                    errors.append(f"{label}: target=_blank link must use noopener noreferrer")

        for tag, attr, raw_url in page.references:
            if raw_url.strip() in {"", "#"}:
                errors.append(f"{label}: empty {attr} on <{tag}>")
                continue
            target, fragment = local_target(path, raw_url)
            if target is None:
                continue
            try:
                target.relative_to(ROOT)
            except ValueError:
                errors.append(f"{label}: local reference escapes repository: {raw_url}")
                continue
            if not target.exists():
                errors.append(f"{label}: missing local target {raw_url}")
                continue
            if fragment and target.suffix.lower() == ".html":
                target_page = pages.get(target)
                if target_page is None or fragment not in target_page.ids:
                    errors.append(f"{label}: missing anchor {raw_url}")
    return errors


def validate_css() -> list[str]:
    errors: list[str] = []
    url_pattern = re.compile(r"url\(\s*([\"']?)([^\"')]+)\1\s*\)", re.IGNORECASE)
    for path in CSS_FILES:
        css = path.read_text(encoding="utf-8")
        for _, raw_url in url_pattern.findall(css):
            target, _ = local_target(path, raw_url.strip())
            if target is not None and not target.exists():
                errors.append(f"{path.relative_to(ROOT)}: missing CSS resource {raw_url}")
        if ":focus-visible" not in css:
            errors.append(f"{path.relative_to(ROOT)}: missing visible keyboard focus styles")
        if "prefers-reduced-motion" not in css:
            errors.append(f"{path.relative_to(ROOT)}: missing reduced motion support")
    return errors


def png_dimensions(path: Path) -> tuple[int, int] | None:
    data = path.read_bytes()[:24]
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", data[16:24])


def validate_manifest() -> list[str]:
    errors: list[str] = []
    path = ROOT / "manifest.webmanifest"
    if not path.exists():
        return ["manifest.webmanifest: file is missing"]
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        return [f"manifest.webmanifest: invalid JSON: {error}"]

    for key in ("name", "short_name", "start_url", "scope", "display", "theme_color", "background_color"):
        if not manifest.get(key):
            errors.append(f"manifest.webmanifest: missing {key}")
    if manifest.get("display") not in {"standalone", "fullscreen", "minimal-ui"}:
        errors.append("manifest.webmanifest: display must provide an app-like mode")

    icon_sizes: set[str] = set()
    for icon in manifest.get("icons", []):
        source = icon.get("src", "")
        sizes = icon.get("sizes", "")
        icon_sizes.add(sizes)
        target = (ROOT / source).resolve()
        if not target.exists():
            errors.append(f"manifest.webmanifest: missing icon {source}")
            continue
        dimensions = png_dimensions(target)
        if dimensions and sizes != f"{dimensions[0]}x{dimensions[1]}":
            errors.append(f"manifest.webmanifest: icon size mismatch for {source}")
    for required_size in {"192x192", "512x512"} - icon_sizes:
        errors.append(f"manifest.webmanifest: missing {required_size} icon")
    return errors


def validate_discovery_files() -> list[str]:
    errors: list[str] = []
    robots_path = ROOT / "robots.txt"
    sitemap_path = ROOT / "sitemap.xml"
    if not robots_path.exists():
        errors.append("robots.txt: file is missing")
    elif PUBLIC_BASE + "sitemap.xml" not in robots_path.read_text(encoding="utf-8"):
        errors.append("robots.txt: missing public sitemap URL")

    expected_urls = {
        PUBLIC_BASE + ("" if path.name == "index.html" else quote(path.name))
        for path in HTML_FILES
        if path.name not in NON_INDEXED_PAGES
    }
    if not sitemap_path.exists():
        errors.append("sitemap.xml: file is missing")
    else:
        try:
            root = ElementTree.parse(sitemap_path).getroot()
            namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            actual_urls = {element.text or "" for element in root.findall("s:url/s:loc", namespace)}
            for missing in sorted(expected_urls - actual_urls):
                errors.append(f"sitemap.xml: missing URL {missing}")
            for extra in sorted(actual_urls - expected_urls):
                errors.append(f"sitemap.xml: unexpected URL {extra}")
        except ElementTree.ParseError as error:
            errors.append(f"sitemap.xml: invalid XML: {error}")
    return errors


def validate_service_worker() -> list[str]:
    errors: list[str] = []
    path = ROOT / "sw.js"
    if not path.exists():
        return ["sw.js: file is missing"]
    source = path.read_text(encoding="utf-8")
    for html_path in HTML_FILES:
        if html_path.name not in source:
            errors.append(f"sw.js: app shell is missing {html_path.name}")
    for required in ("manifest.webmanifest", "assets/styles.css", "assets/app.js", "assets/icon-192.png", "assets/icon-512.png"):
        if required not in source:
            errors.append(f"sw.js: app shell is missing {required}")
    return errors


def validate_javascript_security() -> list[str]:
    errors: list[str] = []
    forbidden = {
        r"\beval\s*\(": "eval",
        r"\bnew\s+Function\b": "new Function",
        r"document\.write\s*\(": "document.write",
        r"\.innerHTML\s*=": "innerHTML assignment",
    }
    paths = sorted((ROOT / "assets").glob("*.js")) + [ROOT / "sw.js"]
    for path in paths:
        source = path.read_text(encoding="utf-8")
        for pattern, label in forbidden.items():
            if re.search(pattern, source):
                errors.append(f"{path.relative_to(ROOT)}: forbidden {label}")
    return errors


def main() -> int:
    if not HTML_FILES:
        print("ERROR: no HTML files found", file=sys.stderr)
        return 1
    pages = parse_pages()
    errors = (
        validate_pages(pages)
        + validate_css()
        + validate_manifest()
        + validate_discovery_files()
        + validate_service_worker()
        + validate_javascript_security()
    )
    if errors:
        print(f"Static site check failed with {len(errors)} issue(s):")
        for error in errors:
            print(f"  - {error}")
        return 1
    reference_count = sum(len(page.references) for page in pages.values())
    print(
        f"Static site check passed: {len(pages)} HTML pages, "
        f"{reference_count} references, {len(CSS_FILES)} stylesheets, "
        "PWA and discovery files verified."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
