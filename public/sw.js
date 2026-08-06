// Bump whenever a cached response can no longer satisfy the current bundle. v2: `scenarioScript`
// became a required field of the strictly-parsed case definition (Story 1.10), so a pre-1.10
// case.json left in the cache fails validation and boots into "content unavailable" instead of a
// degraded session. This worker caches per response as it fetches, with no atomic swap, so a
// mixed-version cache is reachable in either direction — a new name is what retires the old pairing.
// v3: same change class — every localizable authored string now requires an `fr` member (Story
// 1.1b), so a pre-1.1b case.json left in the cache fails the strict parse the same way.
// v4: again the same class — a readable source now requires one rendition per shipped locale, so a
// v3-era case.json carrying only the English rendition no longer parses.
const CACHE_NAME = 'quantique-bootstrap-v4';

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter((cacheName) => cacheName.startsWith('quantique-') && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith((async () => {
        let cache;

        try {
            cache = await caches.open(CACHE_NAME);
        } catch {
            // Cache Storage is an offline enhancement; a network response must still work.
        }

        try {
            const response = await fetch(event.request);

            if (cache && response.ok && new URL(event.request.url).origin === self.location.origin) {
                try {
                    await cache.put(event.request, response.clone());
                } catch {
                    // A full or unavailable cache must not fail a successful request.
                }
            }

            return response;
        } catch {
            const cachedResponse = await cache?.match(event.request);

            if (cachedResponse) {
                return cachedResponse;
            }

            return new Response('Offline content is not cached yet.', { status: 503 });
        }
    })());
});
