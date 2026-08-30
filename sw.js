// Cache version bumped when the site moved from /blog/ to the origin root:
// the activate handler purges caches left by the old /blog/ scope.
const CACHE_NAME = 'yan-blog-v20260830c';
const CACHE_PREFIX = 'yan-blog-';
const OFFLINE_PAGE = './offline.html';

const APP_SHELL = [
  './',
  './index.html',
  './about.html',
  './embedded.html',
  './algorithms.html',
  './modeling.html',
  './modeling-cat-算法模型.html',
  './modeling-cat-应用案例.html',
  './modeling-cat-理论研究.html',
  './projects.html',
  './blog.html',
  './contact.html',
  './404.html',
  OFFLINE_PAGE,
  './manifest.webmanifest',
  './assets/bootstrap.js?v=20260820d',
  './assets/app.js?v=20260820d',
  './assets/modeling.js?v=20260830a',
  './assets/papers.json',
  './assets/algorithms.js?v=20260830a',
  './assets/projects.js?v=20260830a',
  './assets/leetcode-catalog.json',
  './assets/github-projects.json',
  './assets/styles.css?v=20260820e',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './assets/图标1.jpg',
  './assets/2.jpg',
  './assets/3.jpg',
  './assets/4.jpg',
  './assets/5.jpg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (key) { return key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { return cache.put(request, copy); });
          }
          return response;
        })
        .catch(function () {
          return caches.match(request, { ignoreSearch: true })
            .then(function (cached) { return cached || caches.match(OFFLINE_PAGE); });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { return cache.put(request, copy); });
          }
          return response;
        });
      })
  );
});
