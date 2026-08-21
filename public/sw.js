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
// v13 — code review of 4.1. Not a schema or content change at all: the *worker's own behaviour*
// changed, which is its own bump class. Story 4.1 made the boot target progress-dependent
// (`resolveCampaignEntryCaseId`), and this worker had no install-time precache — it cached per
// response as it fetched, so only the case the player had actually booted was ever in the cache.
// Completing the first campaign case therefore advanced the boot target to a case whose `case.json`
// had never been fetched: offline, that missed the cache, this worker returned 503, and
// `loadCaseDefinition` boots "content unavailable" with no picker and no `?case=` UI to escape with.
// A dead end reachable by ordinary play rather than by a mid-deploy race. The fix is the precache
// below, and a new name is what stops a v12 cache — populated under the old fetch-through-only rule
// and therefore holding at most one case — from being treated as complete.
// v14 — Story 4.2. A content change on the Morley–Miller case (1.4.0 → 1.5.0), bumped **whether or not**
// a field became required, which is what AC10 asks and what the last three stories each did late.
//
// No field became required and no id a record holds has moved, so this is neither v9's class nor v12's.
// What makes it a bump is the *old file, new bundle* direction, and it is the same shape v11 stated: the
// worker serves `case.json` from cache while the hashed bundle comes from the network, so a returning
// player can run this build's `CaseDefinitionSchema` over a cached **1.4.0** file. That file's
// `consultationRules` carry `consult-no-runs` and `consult-unread-report`, whose predicates are
// `missing-run` and `missing-source` — both still valid members of the union, so it parses. It would not
// *refuse*; it would quietly hand the player back the two dead branches this story replaced, and lose the
// replication guidance the case's own `resetPath` teaches. A silently older case rather than a broken one,
// which is exactly the outcome a `CACHE_NAME` is for.
//
// The *new file, old bundle* direction refuses outright and is the stronger half: 1.5.0 authors
// `predicate: { kind: 'missing-replication' }`, and `ConsultationPredicateSchema` is a
// `discriminatedUnion` of `.strict()` objects, so a bundle without that member fails the parse into
// `invalid-case-definition` — "content unavailable", with no recovery offline. **An additive union member
// is still a bump, for the reason v11 gives about an additive optional field: `.strict()` makes every
// schema change breaking in the old-bundle direction.**
//
// v15 — code review of 4.2. `case.json` goes to **1.6.0** (a French U+202F before `°C` in
// `experiment.resetPath.description`), and `CaseDefinitionSchema` gains two refusals a cached bundle does
// not implement: `apparatus.primaryControls[].unit` refuses the degree homoglyphs U+00BA and U+02DA, and
// `experiment.assumptions` is capped at four entries. Neither refusal is reachable from the shipped content,
// so the *old file, new bundle* direction is harmless here — but the *new file, old bundle* direction is the
// one that matters and it is the usual one: a returning player's cached 1.5.0 copy would be validated by
// this build against a version its allowlist accepts, while a cached **bundle** paired with the new file
// would parse 1.6.0 fine and then disagree with it about the separator. Bumped because the content moved at
// all, which is the rule this list exists to keep, and because offline reload is a release gate.
// v16 — Story 4.3. `case.json` goes to **1.7.0**: `conclude-ether-disproved.claim.en` is reworded so the
// authored `peer-overreach` rule fires on the claim it was written for. Bumped because the content moved at
// all, which is the rule this list exists to keep — and applied in the *dev* commit, not the review commit,
// which is the correction 4.2's review asked for after three consecutive late bumps.
//
// **No schema change either way, and that is worth stating rather than leaving to be inferred.** No field
// became required, no union gained a member, and `CaseDefinitionSchema` gains no refusal — so unlike v14 and
// v15 the *new file, old bundle* direction parses cleanly here, and unlike v9 and v12 nothing refuses. What
// this bump prevents needs stating carefully, because the mechanism first written here was one **this
// worker does not have**. The claim was that the worker serves `case.json` from cache while the hashed
// bundle comes from the network, so a returning player could run this build over a cached 1.6.0 file. That
// cannot happen under v16: the fetch handler is network-**first** and falls back to cache only when the
// request throws, `activate` deletes every other `quantique-*` cache, and `install` re-fetches every
// precached `case.json` with `cache: 'reload'`. Online both come from the network; offline both come from
// the same generation.
//
// The real window is narrower: the **v15 worker still in control**, serving a cached 1.6.0 `case.json` to a
// session that has the new bundle, which a v16 name fixes only by existing to be activated. So the bump is
// correct policy — the content moved, so the list moves — and the danger it was justified with is smaller
// than it read.
//
// The durable form of that danger was never a cache at all. A **saved record** holding the pre-edit
// conclusion text reaches exactly the outcome described above — reviewed clean at 1.7.0, a *calibrated
// conclusion* awarded on a draft declaring the ether disproved — and no `CACHE_NAME` touches it. That is
// closed in `CaseRecordSchema.ts`, where the 1.7.0 clause migrates the draft forward instead of dropping
// the card, and asserted in `MorleyMillerConclusion.test.ts`.
// v17 — Morley–Miller 1.8.0 adds five portrait assets and switches its cast and rival to authored image
// references while retaining the existing vectors as fallbacks. The case and manifest must update as one
// cache generation: mixing them fails the same manifest equality boundary that v10 documents, and an old
// manifest cannot warm the five images a new bundle expects to preload.
const CACHE_NAME = 'quantique-bootstrap-v17';

/**
 * The case directories to precache at install, so the boot target can advance offline.
 *
 * Restated rather than imported because this file is a static worker outside the TypeScript graph —
 * it cannot import `KNOWN_CASE_IDS`. `CaseDefinition.test.ts` reads this array out of this file's
 * text and asserts it equals `KNOWN_CASE_IDS`, so adding a case without adding it here is a red test
 * rather than a case that is unreachable offline.
 */
const PRECACHED_CASE_IDS = ['young-interference', 'morley-miller'];

/** Every case's two content files, resolved against this worker's own scope so a subpath deploy works. */
const precachedContentUrls = () => PRECACHED_CASE_IDS.flatMap((caseId) =>
    ['case.json', 'asset-manifest.json'].map((fileName) =>
        new URL(`cases/${caseId}/${fileName}`, self.location.href).href));

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        // Precaching is an offline enhancement: one unreachable file must not fail the install and
        // leave the player with no worker at all, so each URL is fetched on its own and its failure
        // is swallowed. `cache.addAll` would reject the whole batch on a single miss.
        try {
            const cache = await caches.open(CACHE_NAME);
            await Promise.all(precachedContentUrls().map(async (url) => {
                try {
                    const response = await fetch(url, { cache: 'reload' });
                    if (response.ok) {
                        await cache.put(url, response);
                    }
                } catch {
                    // Offline or blocked at install time; the fetch handler still caches on first use.
                }
            }));
        } catch {
            // Cache Storage is unavailable; the worker must still install.
        }

        await self.skipWaiting();
    })());
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
