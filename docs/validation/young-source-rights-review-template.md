# Young scholarly source and rights review — template

**Fed by the ledger.** Open `?ledger=1` and read the release-approval banner and its named blocker list;
that surface is the evidence for every row below, and `docs/source-rights/README.md` explains how to read
it. Do not fill a Result in from memory — the ledger states it, per row, from the case's own authored data.

| Gate | Reviewer | Evidence reference | Result (Pass / Blocked) | Remediation owner | Follow-up date |
| --- | --- | --- | --- | --- | --- |
| Scholarly claims and source labels reviewed | _Scholarly/rights reviewer_ | `?ledger=1` — Sources table and Sign-off table | **Blocked** (2026-08-19) | _Name_ | _YYYY-MM-DD_ |
| Asset and source rights status reviewed | _Scholarly/rights reviewer_ | `?ledger=1` — Assets table and blocker list | **Blocked** (2026-08-19) | _Name_ | _YYYY-MM-DD_ |

Any blocked row blocks Young public validation and later-case production. There is no waiver or override
— not in this template and not in `evaluateLedgerReleaseApproval`, which takes no waiver parameter.

## Standing at 2026-08-19 (Story 3.3)

The ledger resolves Young to **BLOCKED** on seven named rows. This is recorded rather than hidden: the
test suite asserts this exact verdict and blocker set, so the suite stays green while the release stays
honestly blocked.

| Blocker | Subject | What closes it |
| --- | --- | --- |
| `asset-rights-incomplete` | `thea-young-portrait` | Rights review of the generated derivative — clear it for public use, or replace it. |
| `asset-rights-incomplete` | `elias-wren-portrait` | As above. |
| `asset-rights-incomplete` | `marianne-cole-portrait` | As above. |
| `asset-rights-incomplete` | `samuel-hart-portrait` | As above. |
| `asset-rights-incomplete` | `arthur-bell-portrait` | As above. |
| `scholarly-review-pending` | `young-interference` | Alexis assigns a scholarly reviewer, who signs the row off. |
| `educator-context-sheet-pending` | `young-interference` | The educator context sheet is produced and the row signed off. |

The five portraits are recorded in
[young-character-assets.md](young-character-assets.md) as "generated and technically validated; not
rights-reviewed and not publicly cleared", and each carries a replacement plan in both locales. **They
are not hidden from the game**: a fictional colleague portrait is not a verified historical claim, and
blanking the cast to satisfy a rule about labelling would break shipped play. What is forbidden is
representing them as reviewed — and blocking release, which the ledger does.

Both of Young's sources are `reviewed` with real citations and HTTPS archive URLs, and neither is a
blocker. The accessibility reviewer and the accessible-controls reference are **de-scoped (ADR-008)** —
recorded and rendered as such, never dropped and never spelled as a sign-off.
