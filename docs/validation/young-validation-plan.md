# Young moderated validation plan

## Scope and owners

- **Learning-validation lead / session owner:** _Name before sessions begin_
- **Educator-review lead:** _Name before educator outreach_
- **Bilingual reviewer:** _Name before the EN + FR completeness review_
- **Scholarly / rights reviewer:** _Name before the source and rights review_
- **QA / release lead:** _Name before technical verification_
- **Release owner:** _Name before the release decision_
- **Post-MVP accessibility carry-forward owner:** _Name before the release decision (non-blocking findings)_

This plan validates the Young laboratory before work begins on Morley–Miller, Hafele–Keating, Delft, or any other later case. Run **15–30 moderated learner sessions** with the validation entry route (`?mode=validation`). The application is an investigation tool, not a measurement instrument: it collects no session responses, telemetry, accounts, survey submissions, analytics, logs, or validation records.

## Prerequisite: no session may be scheduled before Stories 2.5 and 2.6 ship

**Both revised success measures are undefined without them.** Field A of the rubric asks why a learner
chose one authored proposal over the others, and Field B is defined against the **significant-measure**
unlock rule — not a run count. Story 2.6 delivers that significance rule and the colleague hints; Story
2.5 delivers the rival-lab critique that closes the guided loop.

Until both have shipped:

- Do **not** schedule or run a moderated session. Sessions run against the pre-pivot loop measure
  behaviour the release will not contain, and their observations cannot be aggregated.
- Do **not** open the educator review of the candidate, for the same reason.
- The `Stories 2.5 and 2.6 shipped` row in `young-release-decision-template.md` stays **Blocked**, and it
  blocks the whole decision.

The instrument in this folder can be prepared, reviewed, and owner-assigned in advance. Running it
cannot.

## Locale protocol — running an EN session and an FR session

The interface language is resolved from the **browser's own language preferences** at boot. **There is
no in-product language selector**, and the language is never stored, so a facilitator cannot switch it
from inside the game.

To run a session in a given locale:

1. Configure the browser's language preferences **before** launching the session — put the target
   language first in the browser's ordered language list (`fr` / `fr-FR` / `fr-CA` all resolve to
   French; anything unmatched falls back to English).
2. Open a fresh browser profile or window so a previously cached page is not reused, then navigate to
   the validation route.
3. Confirm the resolved language on the boot screen **once the page has finished loading**, before the
   session starts. `index.html` ships English placeholder text by design — the markup cannot know which
   language the browser will resolve to, so the app rewrites every boot string, and the page title, from
   the i18n layer as it boots. **A brief flash of English on a slow machine is expected and is not a
   misconfiguration.** Judge it on the settled screen: if the boot frame is still English after loading
   completes, the browser's language list is wrong — fix it and reload rather than proceeding.
4. Record the locale (`en` or `fr`) in the rubric's per-session header. This field is required; a session
   without it cannot count toward the per-locale minimum and has to be reported in the aggregate's
   "locale unrecorded" bucket.

**The moderated sample must include at least one session in each locale.** A single-locale sample fails
the gate regardless of the percentage reached.

## Consent and de-identification boundary

Obtain any consent required by the hosting institution before a moderated session. The facilitator, not the product, owns consent records and any detailed notes. Keep consent records and raw notes outside this repository and outside the application. The repository may contain only the de-identified aggregate template and completed aggregate totals; it must never contain names, contact details, device identifiers, recordings, raw learner conclusions, exported progress, or copied player records.

Use an arbitrary facilitator-held session code only while collating observations. Remove the code before sharing aggregate evidence. Learners may decline to answer a prompt or end a session; record the exclusion reason only in facilitator-held evidence when allowed by the consent protocol.

## Facilitator workflow

1. Confirm Stories 2.5 and 2.6 have shipped. If either has not, stop — no session may be run.
2. Confirm the session is moderated, consented, and uses the validation route.
3. Configure and confirm the session locale per the locale protocol above, and record it.
4. State that the application does not collect session responses and that observations are facilitator-held and de-identified.
5. Invite the learner to investigate Young's experiment without scoring, correctness claims, or speed expectations.
6. Complete the observation rubric from direct human observation; do not inspect browser state, IndexedDB, exports, console output, or product events. Ask at most one neutral opener for Field A — naming a control or a value for the learner makes the response prompted, which is a **No**.
7. Collate only de-identified totals in the aggregate template, overall and split by locale.
8. Obtain the remaining **blocking** evidence: educator responses, scholarly/rights review, EN + FR content completeness (`young-bilingual-completeness-template.md`), motion safety (`young-motion-safety-template.md`), low-end-laptop 60-FPS performance, cached offline reload, and automated technical evidence.
9. Record **accessibility findings — non-blocking, post-MVP** (`young-accessibility-findings-template.md`) and assign the named carry-forward owner. These findings do **not** gate the release (ADR-008); the reduced-motion and no-flashing checks moved out of that sheet and **do** gate it.
10. Record a blocked release decision unless every required gate passes. There is no waiver.

## Evidence retention

Facilitator-held consent forms, raw notes, and any recordings follow the institution's retention and deletion policy and are never attached to player progress or application data. Retain only the completed de-identified aggregate and gate evidence references required for the release decision.
