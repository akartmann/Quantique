# Young EN + FR content completeness — template (BLOCKING)

Quantique ships English and French from launch (NFR19, ADR-010). Incomplete translation is this
project's most-repeated defect class, so this sheet **enumerates every player-facing Young surface**
rather than carrying a single "all content translated" row. A reviewer signs each surface
individually.

The locale is resolved from the browser and there is **no in-product language selector**, so review
each surface by running the app in a browser configured for that language (see the locale protocol in
`young-validation-plan.md`).

**Bilingual reviewer (required):** _Name before review begins_

A surface passes only when it is **complete in both EN and FR** — no missing key, no English string
left in a French session, no mixed-language panel, and no clipped or overflowing French copy at
1280×720 (French runs roughly 15–25% longer than English).

| # | Player-facing Young surface | Reviewer | Evidence reference | Result (Pass / Blocked) | Remediation owner | Follow-up date |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Interface chrome — boot frame, entry button, boot status messages | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 2 | Curated record — source list, inspect/read controls, status text | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 3 | Book content — archival spreads, page chrome, translated-rendition notice, reuse statement | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 4 | Colleague dialogue — speaker names, dialogue lines, dialogue controls and counters | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 5 | Prediction proposal text — all four cards, markers, attributions, limitations | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 6 | Conclusion proposal text — all four cards, markers, attributions, limitations | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 7 | Hint text — colleague hints (Story 2.6) | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 8 | Rival-lab critique lines (Story 2.5) | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 9 | Source labels and attributions — including provenance categories and citation reuse statements (`citationText` and `archiveUrl` stay canonical by design) | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 10 | Debrief — historical debrief copy and any replay framing | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 11 | Error and recovery copy — every reachable `Result` error code and boot-status recovery message | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 12 | Validation session disclosure (`?mode=validation`) | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 13 | Print / export view — the printable investigation record | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |

Also confirm the measurement rendering, which is locale-dependent and easy to miss:

| Check | Reviewer | Evidence reference | Result (Pass / Blocked) | Remediation owner | Follow-up date |
| --- | --- | --- | --- | --- | --- |
| French numbers render with a comma decimal and a narrow no-break space before the unit (`0,25 mm`) everywhere a measurement appears | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| French typography — `«  »` guillemets with non-breaking spaces, `’` apostrophe, full accented repertoire, no missing glyph | _Name_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |

Rows 7 and 8 cannot be reviewed until Stories 2.6 and 2.5 ship. They stay **Blocked**, not "N/A" — the
gate is not satisfiable before those stories land, which is the same prerequisite AC6 records.

Any blocked row blocks Young public validation and all later-case production. There is no waiver or
override.
