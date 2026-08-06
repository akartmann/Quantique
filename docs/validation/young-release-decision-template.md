# Young validation release decision — template

**Release owner:** _Name_
**Decision date:** _YYYY-MM-DD_
**Baseline commit under review:** _Commit_
**Decision:** **Blocked**

The decision may change to **Pass** only when **every** blocking gate below has a Pass result. All
blocking gates are conjunctive. There is no waiver field, override path, or partial approval, and the
decision defaults to **Blocked**.

## Blocking gates

| Required gate | Owner | Evidence reference | Result (Pass / Blocked) | Remediation owner when blocked | Follow-up date when blocked |
| --- | --- | --- | --- | --- | --- |
| **Stories 2.5 and 2.6 shipped** (prerequisite — no moderated session may be scheduled before both land) | _Release owner_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 15–30 moderated sessions and de-identified facilitator evidence | _Learning-validation lead/session owner_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| **Moderated sample includes >= 1 `en` and >= 1 `fr` session** | _Learning-validation lead/session owner_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| >=60% named an own-measurement reason for the chosen proposal (rubric Field A) | _Learning-validation lead/session owner_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| >=60% voluntary beyond-minimum variable test (rubric Field B) | _Learning-validation lead/session owner_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| At least five educators would share/use the case | _Educator-review lead_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| Scholarly source and rights review | _Scholarly/rights reviewer_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| **EN + FR content completeness across every Young surface** (`young-bilingual-completeness-template.md`) | _Bilingual reviewer_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| **Reduced-motion / no-flashing check on the Phaser scenes** (`young-motion-safety-template.md`) | _Reviewer named in the motion-safety sheet_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| 10-minute, 1280×720, low-end-laptop 60-FPS check | _QA/release lead_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| Cached offline reload | _QA/release lead_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |
| Automated technical evidence | _QA/release lead_ | _Reference_ | _Result_ | _Name_ | _YYYY-MM-DD_ |

If any result is Blocked, both Young public validation and later-case production remain blocked until
the named owner closes the remediation and the release owner records a new decision.

---

## Non-blocking — recorded accessibility findings (post-MVP)

**These rows do not gate this release.** ADR-008 removed manual accessibility acceptance from the MVP
gate. Findings are still recorded in `young-accessibility-findings-template.md` and carried forward to a
named owner. A Gap recorded there does **not** change the decision above, and it must never be
transcribed into the blocking table.

| Item | Value |
| --- | --- |
| Accessibility findings recorded (`young-accessibility-findings-template.md`) | _Yes / No — recording is expected; the findings themselves are non-blocking_ |
| **Post-MVP accessibility carry-forward owner** | _Name — required_ |
| Target post-MVP milestone | _Milestone_ |
| Automated axe evidence reference (supporting context only, never a gate) | _Reference_ |

The two motion guards that survived the de-scope — reduced motion and no-flashing/photosensitivity —
are **blocking** and appear in the table above, not here.
