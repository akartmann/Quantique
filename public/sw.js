const CACHE_NAME = 'quantique-bootstrap-v1';

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
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
