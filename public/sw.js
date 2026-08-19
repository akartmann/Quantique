// Bump whenever a cached response can no longer satisfy the current bundle. v2: `scenarioScript`
// became a required field of the strictly-parsed case definition (Story 1.10), so a pre-1.10
// case.json left in the cache fails validation and boots into "content unavailable" instead of a
// degraded session. This worker caches per response as it fetches, with no atomic swap, so a
// mixed-version cache is reachable in either direction — a new name is what retires the old pairing.
// v3: same change class — every localizable authored string now requires an `fr` member (Story
// 1.1b), so a pre-1.1b case.json left in the cache fails the strict parse the same way.
// v4: again the same class — a readable source now requires one rendition per shipped locale, so a
// v3-era case.json carrying only the English rendition no longer parses.
// v5: and again — `colleagues`, `predictionProposals`, and `conclusionProposals` became required
// fields of the strictly-parsed case definition (Story 1.11), so a cached pre-1.11 case.json boots
// a returning offline player into "content unavailable" with no recovery.
// v6: and again — a scenario scene's `dialogueBeats` now carry `text` as required `LocalizedText`
// instead of the pre-1.12 `textKey`, so a cached v5-era case.json fails the strict parse and boots a
// returning offline player into "content unavailable" with no recovery.
// v7: the 1.16 case/manifest image bundle must not mix with cached 1.15/manifest 1.0 responses.
// v8 — code review of 3.2. `CaseDefinitionSchema` now *requires* `title` and `experiment.modelId` of
// every case, and one `inlineLabel` per primary control. A cached 1.18.0/1.19.0 `case.json` carries
// none of them, `contentPath` builds a stable URL with no version query, so the stale response matches
// the new request exactly and the new bundle strict-parses it into "content unavailable" with no
// recovery. Exactly the change class v3, v5 and v6 were bumped for.
// v9 — Story 3.3. The same change class again, and the reason it is the same one: the source-and-rights
// ledger makes `ledger`, one `ledgerEntry` per contextual artifact, and one `rights` block per manifest
// asset **required** of every case. A cached 1.20.0 `case.json` and manifest 1.1.0 carry none of the
// three, so the stale response — matched exactly, because `contentPath` builds a stable URL with no
// version query — strict-parses into "content unavailable" with no recovery for an offline player who
// had a working investigation before the update.
const CACHE_NAME = 'quantique-bootstrap-v9';

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
