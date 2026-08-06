# Decision Log — Fracture of Certainty

| Date | Version | Decision | Rationale | Status |
|---|---:|---|---|---|
| 2026-08-04 | 0.1 | GDD created in Express mode. | Existing brief, brainstorming, and research provide a strong starting point. | Confirmed |
| 2026-08-04 | 0.1 | Game type: Puzzle with historical-science investigation framing. | Bounded evidence and experiment challenges are the core player activity; narrative provides context. | Proposed |
| 2026-08-04 | 0.1 | Phaser is an MVP engine constraint. | Browser-first interactive laboratory needs a production-ready 2D web-game runtime. | Proposed |
| 2026-08-04 | 0.1 | Scope is a four-case campaign delivered and tested one case at a time. | The project keeps its anthology promise while putting the light-interference case first for early validation. | Confirmed |
| 2026-08-04 | 0.1 | The first case is anchored in Thomas Young's double-slit interference work. | It provides the earliest focused test of the game's apparatus–anomaly–revision loop. | Confirmed |
| 2026-08-04 | 0.1 | Young case core controls are slit spacing and screen distance; wavelength is an optional advanced comparison. | Two tightly coupled, visible variables keep the first laboratory puzzle legible. | Confirmed |
| 2026-08-04 | 0.1 | Entanglement is a full fourth case. | It completes the campaign's escalating inquiry arc, rather than functioning as a short coda. | Confirmed |
| 2026-08-04 | 0.1 | Cases have no hard fail state; peer review supports unlimited revision. | Productive uncertainty is a core pillar. | Confirmed |
| 2026-08-04 | 0.1 | Non-competitive recognition rewards rigorous evidence practice. | It sustains engagement without compromising the learning goal. | Confirmed |
| 2026-08-04 | 0.2 | Initial GDD and detailed epics drafted. | Draft consolidates confirmed decisions and makes unresolved historical dependencies explicit. | Drafted |
| 2026-08-04 | 0.2 | Production begins with Young; campaign play order begins with thermal drift. | Young provides the fastest validation slice while thermal drift remains the campaign tutorial. | Confirmed |
| 2026-08-04 | 0.2 | The Curated Record, adaptive consultation, named sources, and public-validation gates are mandatory. | Reconciles the GDD with the brief, brainstorming, and research inputs. | Confirmed |
| 2026-08-04 | 0.3 | Validation fixes applied. | Canonical game type, measurable moderated-study targets, and traceable stories for later cases are now explicit. | Confirmed |
| 2026-08-04 | 0.3 | Campaign tutorial anchors in the 1907 Morley–Miller ether-drift follow-up. | Temperature drift is a documented confound, making the case a concise tutorial in controlled null-result reasoning. | Confirmed |
| 2026-08-04 | 0.3 | The relativity case anchors in the 1971 Hafele–Keating around-the-world clock experiment. | Literal divergent clocks, directional comparison, and uncertainty support a legible evidence-and-critique case. | Confirmed |
| 2026-08-04 | 0.3 | The entanglement finale anchors in Hensen et al.'s 2015 Delft loophole-free Bell test. | It makes measurement reliability and finite statistical certainty the player-facing final trade-off. | Confirmed |
| 2026-08-04 | 1.0 | GDD decision audit complete. | Every confirmed decision is captured in the GDD or epics; future historical/narrative detail is recorded as a dependency. | Finalized |
| 2026-08-05 | — | _Gap: the pivot to a Phaser guided adventure amended the GDD but recorded no entries here._ | Not backfilled — see `planning-artifacts/sprint-change-proposal-2026-08-05.md` for the authoritative record of those decisions. | Noted 2026-08-06 |
| 2026-08-06 | 1.1 | Apparatus controls become direct-manipulation physical instruments; drag snaps to the authored step and discrete/keyboard stepping remains. | Play-testing found `+`/`−` text buttons read as configuration rather than operating an instrument. Snapping keeps the domain normalization rule invisible and off-step values impossible. (ADR-012) | Confirmed |
| 2026-08-06 | 1.1 | The experiment is player-initiated: the apparatus sits unlit until the player starts the light, which replaces the run control. | The light animated unattended from scene load while the run affordance lived off-canvas. Gating on a player action also removes a continuous idle animation cost from the NFR1 baseline. (ADR-012) | Confirmed |
| 2026-08-06 | 1.1 | The colleague cast and rival lab are staged as **coded vector silhouettes**, not commissioned portrait art. | Delivers the GDD's existing "portraits **or** silhouettes" character requirement with no art commission, no per-asset rights-ledger entry, and no preload cost against NFR2's five-second first interaction. Uses the already-validated `portrait: { kind: 'silhouette', accentColor }` shape. | Confirmed |
| 2026-08-06 | 1.1 | Every forward transition is advanced from within the scene the player is standing in. | Nine of fourteen player intents were dispatchable only from the retired DOM panels, so the guided adventure was not playable on its own surface. (NFR20, ADR-011) | Confirmed |
