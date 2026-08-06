# Young accessibility findings — recorded, non-blocking, post-MVP

**Status: not a release gate.** ADR-008 removed manual accessibility acceptance from the MVP Young
validation gate. Findings are still **collected and recorded here**, and they are **carried forward to
a named post-MVP accessibility owner** — they simply do not block Young public validation or later-case
production.

This template is retained deliberately, and the existing accessibility specs
(`tests/e2e/accessibility.spec.ts`) are retained with it. Nothing here is deleted; the de-scope changed
the gate, not the intent.

**Two checks were moved out of this template and remain BLOCKING:** reduced motion and
no-flashing/photosensitivity now live in `young-motion-safety-template.md`. Record them there, not
here.

**Carry-forward owner (required):** _Post-MVP accessibility owner — name before the release decision_

| Finding | Accessibility reviewer | Evidence reference | Observation (Met / Gap / Not assessed) | Post-MVP carry-forward owner | Target milestone |
| --- | --- | --- | --- | --- | --- |
| Keyboard-only flow and visible focus recovery | _Name_ | _Reference_ | _Observation_ | _Name_ | _Post-MVP milestone_ |
| Screen-reader announcements and reading order | _Name_ | _Reference_ | _Observation_ | _Name_ | _Post-MVP milestone_ |
| Non-colour scientific encoding and zoom/text scaling | _Name_ | _Reference_ | _Observation_ | _Name_ | _Post-MVP milestone_ |
| Tablet keyboard, pointer, and touch input | _Name_ | _Reference_ | _Observation_ | _Name_ | _Post-MVP milestone_ |
| Assistive-technology reach into the Phaser surface (`#game-container` is `aria-hidden`; see `deferred-work.md`) | _Name_ | _Reference_ | _Observation_ | _Name_ | _Post-MVP milestone_ |
| Automated axe evidence — **supporting context only** | _Name_ | _Reference_ | _Observation_ | _Name_ | _Post-MVP milestone_ |

Use **Met / Gap / Not assessed**, not Pass / Blocked: a Pass/Blocked column on a non-blocking sheet
invites someone to read a Gap as a release stop, and a Blocked row here has no effect on the release
decision.

The axe result is supporting evidence only. It must not be recorded as a gate, in this template or in
`young-release-decision-template.md`.
