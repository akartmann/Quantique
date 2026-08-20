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
// v10 — code review of 3.3. A *different* reason from v9, and the distinction is worth stating because
// no field became required this time: the ledger corrections change `rights` values in both
// `case.json` and `asset-manifest.json`, and Story 3.3 taught `manifestsMatch` to compare the two
// files' `rights` blocks. A cache holding one file at the old values beside the other at the new ones
// therefore fails `manifest-mismatch` at load — "content unavailable" again, reached through the
// consistency check rather than through a missing field. Two files that must agree are two files that
// must be evicted together.
// v11 — code review of 3.4. A *third* reason, and the one the story's own §11 reasoned past: the two
// new fields are optional, so a cached v10-era `case.json` still strict-parses under the new schema —
// that direction is genuinely safe and the story was right about it. The direction it did not consider
// is the reverse. `contentPath` builds `cases/<id>/case.json` with no version query and this worker is
// a per-response fetch-through cache with no atomic swap, so mid-deploy a returning player can reach
// the network for `case.json` while the hashed bundle still comes from cache. `PrimaryControlSchema`
// is `.strict()` and the pre-3.4 schema has no `affordance` key, so the *new* file parsed by the *old*
// bundle fails into `invalid-case-definition` — "content unavailable", with no recovery offline. The
// rule this makes explicit, and which the header did not say before: **an additive optional field is
// still a bump, because `.strict()` makes every schema change breaking in the old-bundle direction.**
// v12 — Story 4.1. The strongest case for a bump so far, and it fails in **both** directions at once.
// The Morley–Miller case re-anchors its second contextual artifact: the id
// `morley-miller-1905-reconstruction` is retired and `morley-miller-1907-final-report` takes its slot,
// with new authored prose, a new citation and a new archive URL. Two consequences, either one of which
// is a bump on its own.
//
// *New file, old bundle:* the retired id is still what a cached record's `inspectedSourceIds` holds and
// what the old bundle's reading gate, support predicates and debrief citations name — so the new
// `case.json` read by the old bundle refuses the player's saved investigation outright.
//
// *Old file, new bundle:* a cached 1.3.0 `case.json` still carries the 1905 artifact, and the new
// `CaseDefinitionSchema` also gains a Morley–Miller refinement pinning `flow` to two-to-four cycles,
// which that cached file violates at `maximumExperimentCycles: 6` — a load-time refusal with the path
// named, which is "content unavailable" for an offline player.
//
// Note this is a *content and refinement* change rather than a newly-required field, so it is neither
// v9's class nor v10's: it is the rule v11 stated, applied to a case where the content itself moved.
const CACHE_NAME = 'quantique-bootstrap-v12';

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
