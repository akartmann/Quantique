# Young moderated validation plan

## Scope and owners

- **Learning-validation lead / session owner:** _Name before sessions begin_
- **Educator-review lead:** _Name before educator outreach_
- **QA / release lead:** _Name before technical verification_
- **Release owner:** _Name before the release decision_

This plan validates the Young laboratory before work begins on Morley–Miller, Hafele–Keating, Delft, or any other later case. Run **15–30 moderated learner sessions** with the validation entry route (`?mode=validation`). The application is an investigation tool, not a measurement instrument: it collects no session responses, telemetry, accounts, survey submissions, analytics, logs, or validation records.

## Consent and de-identification boundary

Obtain any consent required by the hosting institution before a moderated session. The facilitator, not the product, owns consent records and any detailed notes. Keep consent records and raw notes outside this repository and outside the application. The repository may contain only the de-identified aggregate template and completed aggregate totals; it must never contain names, contact details, device identifiers, recordings, raw learner conclusions, exported progress, or copied player records.

Use an arbitrary facilitator-held session code only while collating observations. Remove the code before sharing aggregate evidence. Learners may decline to answer a prompt or end a session; record the exclusion reason only in facilitator-held evidence when allowed by the consent protocol.

## Facilitator workflow

1. Confirm the session is moderated, consented, and uses the validation route.
2. State that the application does not collect session responses and that observations are facilitator-held and de-identified.
3. Invite the learner to investigate Young’s experiment without scoring, correctness claims, or speed expectations.
4. Complete the observation rubric from direct human observation; do not inspect browser state, IndexedDB, exports, console output, or product events.
5. Collate only de-identified totals in the aggregate template.
6. Obtain educator, scholarly/rights, accessibility, performance, offline, and technical evidence.
7. Record a blocked release decision unless every required gate passes. There is no waiver.

## Evidence retention

Facilitator-held consent forms, raw notes, and any recordings follow the institution’s retention and deletion policy and are never attached to player progress or application data. Retain only the completed de-identified aggregate and gate evidence references required for the release decision.
