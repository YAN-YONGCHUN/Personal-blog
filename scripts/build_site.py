#!/usr/bin/env python3
"""Create the exact static artifact published to GitHub Pages."""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_site"
PUBLIC_FILES = (
    "manifest.webmanifest",
    "robots.txt",
    "sitemap.xml",
    "sw.js",
)


def main() -> int:
    if OUTPUT.parent != ROOT:
        raise RuntimeError("Refusing to build outside the repository")
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()

    for source in sorted(ROOT.glob("*.html")):
        shutil.copy2(source, OUTPUT / source.name)
    for filename in PUBLIC_FILES:
        shutil.copy2(ROOT / filename, OUTPUT / filename)
    shutil.copytree(ROOT / "assets", OUTPUT / "assets")
    (OUTPUT / ".nojekyll").touch()

    page_count = len(list(OUTPUT.glob("*.html")))
    file_count = len([path for path in OUTPUT.rglob("*") if path.is_file()])
    print(f"Built _site: {page_count} HTML pages, {file_count} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
