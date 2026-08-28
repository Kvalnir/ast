/* Service worker — offline support for the pattern site.
 *
 * Scope is the directory this file is served from (the repo root, i.e.
 * /ast/ on Pages), which is why every path below is relative: the same file
 * works at a domain root, at /ast/, and on a local dev server without edits.
 *
 * BUMP `VERSION` whenever a precached file changes. The precache is keyed on
 * it, so a stale version string means visitors keep the old CSS and JS until
 * they clear storage. There is no build step to do this automatically —
 * changing it is part of editing the site.
 */
const VERSION = 'v32';  // v32: the square means focus, a highlight is just a colour

// Every cache name is prefixed, and the sweep below only ever touches names
// carrying this prefix. That is not tidiness, it is the difference between
// correct and destructive: this site is served from kvalnir.github.io/ast/,
// and Cache Storage is scoped to the ORIGIN, not to the service worker's
// path. Every other project published under the same github.io account shares
// that storage, so an unprefixed "delete every cache that is not mine" sweep
// deletes their offline data too, from a worker they never installed.
const PREFIX = 'ast-';
const SHELL = `${PREFIX}shell-${VERSION}`;  // our files, replaced on bump
const FONTS = `${PREFIX}fonts`;             // Google Fonts, kept across versions

// Everything the three pages need to run with the network off. `./` is left
// out on purpose: it is byte-for-byte index.html, and the navigation handler
// already falls back to the cached copy.
const PRECACHE = [
  './index.html',
  './trainer.html',
  './cheatsheet.html',
  './manifest.webmanifest',
  './assets/css/site.css',
  './assets/js/core.js',
  './assets/js/techniques.js',
  './assets/js/bank.js',
  './assets/js/import.js',
  './assets/js/trainer.js',
  './assets/js/pwa.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/favicon-32.png',
  './assets/icons/icon.svg',
  './assets/icons/apple-touch-icon.png',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // `cache: 'reload'` bypasses the browser's HTTP cache. Pages serves assets
    // with a non-zero max-age, so a plain request could fill a freshly bumped
    // VERSION with the very bytes the bump was meant to replace.
    // addAll is atomic on purpose — a half-populated shell is worse than none
    // — so a bad path here disables offline support entirely, loudly.
    try {
      await cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })));
    } catch (err) {
      console.error('[sw] precache failed; offline support is off:', err);
      throw err;
    }
  })());
  // No skipWaiting: a new worker sits in waiting until the page asks for it,
  // so an update never swaps the JS out from under a puzzle in progress.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith(PREFIX) && k !== SHELL && k !== FONTS)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// The page sends this when the visitor accepts the update banner.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // --- Page loads: network first, so an update lands on the next visit
  // rather than after a cache expiry, but a dead network still opens.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // Only successful pages go in. Without the check, every 404 under the
        // scope — a mistyped link, a crawler, a stale bookmark — was stored
        // and then SERVED from cache while offline, and the cache grew without
        // bound because a query string makes a new key.
        // `redirected` is excluded as well: a redirected response cached under
        // the PRE-redirect key makes the next offline navigation reject
        // outright ("a redirected response was used for a request whose
        // redirect mode is not follow"), which loses the offline page.
        if (fresh && fresh.ok && !fresh.redirected) {
          const cache = await caches.open(SHELL);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        return (await caches.match(req, { ignoreSearch: true }))
            || (await caches.match('./index.html'))
            || Response.error();
      }
    })());
    return;
  }

  // --- Google Fonts: cache first and keep. The stylesheet and the woff2
  // files never change behind a given URL, and refetching them is the one
  // thing that makes an "offline" page hang on a slow connection.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        // Opaque responses (no CORS on the woff2) are cached as-is; they are
        // still usable as a font, just not readable by script. An error the
        // browser CAN read is not cached: this cache is never revalidated and
        // never expires, so a 404 stored here would outlive the outage that
        // caused it and break the type permanently.
        if (res && (res.type === 'opaque' || res.ok)) {
          const cache = await caches.open(FONTS);
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        // No font is better than no page — the CSS stack falls back to
        // system-ui on its own.
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // --- Our own assets: serve the cached copy at once, refresh it in the
  // background. A CSS or JS change is therefore live on the second load,
  // which is the same moment the new page HTML arrives anyway.
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const hit = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    if (hit) {
      // Refresh for next time, but do not make the response wait on it, and
      // do not let an offline rejection surface as an unhandled rejection.
      event.waitUntil(network.catch(() => {}));
      return hit;
    }
    // Nothing cached and no network: resolving to undefined here would throw
    // inside respondWith rather than fail the request cleanly.
    return network.catch(() => new Response('', { status: 504, statusText: 'offline' }));
  })());
});
