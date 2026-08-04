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
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);

        if (cachedResponse) {
            return cachedResponse;
        }

        try {
            const response = await fetch(event.request);

            if (response.ok && new URL(event.request.url).origin === self.location.origin) {
                await cache.put(event.request, response.clone());
            }

            return response;
        } catch {
            return new Response('Offline content is not cached yet.', { status: 503 });
        }
    })());
});
