# Young motion safety check — template (BLOCKING)

Manual accessibility acceptance was removed from the MVP release gate (ADR-008), but the
reduced-motion and photosensitivity guards were **explicitly retained and remain blocking**. They are
recorded here, separately from the non-blocking accessibility findings in
`young-accessibility-findings-template.md`, so the de-scope cannot quietly take them with it.

Check the **Phaser scenes**, which are the sole interactive surface: library reading, laboratory
apparatus and run animation, colleague dialogue and proposal cards, scene transitions, and the
archival book spreads.

| Check | Reviewer | Evidence reference | Result (Pass / Blocked) | Remediation owner | Follow-up date |
| --- | --- | --- | --- | --- | --- |
| `prefers-reduced-motion: reduce` is honoured across every Phaser scene — animation, transitions, and run playback are reduced or stilled, and no information is only conveyed by movement | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| No flashing or photosensitivity risk — nothing flashes more than three times per second, no large-area luminance flash, no high-contrast strobing pattern, in either motion mode | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| Both checks re-confirmed in a French session — longer French copy must not introduce a new animated reflow or transition | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |

Observe this manually with the OS-level reduced-motion setting toggled in both directions. An axe run
does not evaluate either check and must not be recorded here.

Any blocked row blocks Young public validation and all later-case production. There is no waiver or
override.
