/* NEON RUSH service worker: offline play after the first load. Hand-written, no dependencies. */
// The precache list and cache version below are filled in at build time by the Vite plugin in vite.config.ts.
const VERSION = 'neonrush-__VERSION__';
const SHELL = ['./', ...__PRECACHE__];
// The game itself: the only page that may become the offline copy.
const SHELL_PATHS = [new URL('./', self.location).pathname, new URL('./index.html', self.location).pathname];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Live data (leaderboard API) always goes to the network and is never cached.
  if (url.pathname.includes('/api/')) return;

  // Pages: network first so updates arrive, cached copy when offline. Only a good copy of the game
  // is kept: never another page in scope (the privacy policy) or an error page.
  if (req.mode === 'navigate') {
    const shell = SHELL_PATHS.includes(url.pathname);
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (shell && res.ok && res.type === 'basic' && !res.redirected) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match(shell ? './index.html' : req, { ignoreVary: true }).then((r) => r || Response.error())),
    );
    return;
  }

  // Hashed build assets and everything else: cache first, fill the cache on first use.
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
