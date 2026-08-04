---
title: 'Repair epic implementation readiness'
type: 'refactor'
created: '2026-08-04'
status: 'in-review'
baseline_commit: '0de0af231fb5797b22016903758a2d921a1950e1'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/planning-artifacts/implementation-readiness-report-2026-08-04.md'
  - '{project-root}/_bmad-output/game-architecture.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The epic plan has a forward dependency: the Young slice and foundation stories require case-definition capabilities that are scheduled in later Epic 3. It also omits explicit acceptance coverage for several GDD requirements and lacks a story for the required moderated learning validation.

**Approach:** Revise the epic sequence and stories so the greenfield setup and minimal validated Young case contract are available before dependent work; harden the reusable framework afterward. Add traceable, testable acceptance criteria for the readiness findings without changing game scope.

## Boundaries & Constraints

**Always:** Preserve the GDD’s Young-first production order, Morley-first campaign order, semantic-HTML authority, deterministic/versioned science, offline-first behavior, and BDD acceptance-criteria format. Keep every epic user- or role-value focused and prevent forward dependencies.

**Ask First:** Adding a new epic, changing the four-case campaign scope, or changing the approved GDD/architecture decisions.

**Never:** Edit the GDD, architecture, readiness report, source material, or implementation code; introduce a backend, freeform sandbox, telemetry, hard-fail states, or unsupported UX decisions.

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/epics.md` -- sole planning artifact to revise: requirement inventory, coverage map, epic ordering, stories, and acceptance criteria.
- `_bmad-output/planning-artifacts/implementation-readiness-report-2026-08-04.md` -- evidence source for the defects being corrected; do not modify.
- `_bmad-output/game-architecture.md` -- source for the starter-template, case-contract, accessibility, and release constraints.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/planning-artifacts/epics.md` -- split greenfield project setup from accessible-control work, then introduce only the base Young case contract before each dependent story extends it -- removes setup oversizing and all Epic 2/Epic 3 forward dependencies.
- [x] `_bmad-output/planning-artifacts/epics.md` -- retain Epic 3 as framework hardening, reframe its second-case spike as a reviewable Morley–Miller prototype, and preserve source/rights author value -- keeps later-case authoring independent and concrete.
- [x] `_bmad-output/planning-artifacts/epics.md` -- add stable GDD traceability whose story evidence exactly includes every mandatory GDD mechanic and metric, including all later-case details and FR26 solely where its ledger fields are required -- closes every partial or misleading trace.
- [x] `_bmad-output/planning-artifacts/epics.md` -- add a Young validation gate immediately after the Young slice, before later-case production, using the exact 15–30 moderated-session, ≥60%-citation, ≥60%-optional-variable, and five-educator-would-use targets; define evidence artifacts, no-telemetry handling, owners, and a blocking release decision -- makes the GDD success metrics operational without weakening them.
- [x] `_bmad-output/planning-artifacts/epics.md` -- require the finite phase machine, synthesis gate, two-to-four cycles, discoverable confound mechanisms, and reset-solvable path in every case; add Young validation access that preserves campaign locking, deterministic optional-wavelength inputs, and all omitted Morley, Hafele–Keating, and Delft mechanics -- makes every case story independently reviewable and complete.

**Acceptance Criteria:**
- Given the revised epic order, when Epic 2 begins, then all starter, case-schema, repository, and Young-content capabilities it needs are delivered by Epic 1 rather than a later epic.
- Given a reviewer traces all 29 GDD functional requirements, when they inspect the coverage map and story acceptance criteria, then every requirement has explicit coverage and no partial-coverage finding remains.
- Given a Young release candidate, when learning validation is performed before later-case production, then the plan requires 15–30 moderated no-telemetry learner sessions, ≥60% citation of a recorded observation or setting, ≥60% voluntary testing beyond the minimum path, and at least five educators who would share or use the case.
- Given later case work, when a case story is scheduled, then it depends only on prior epics and contains a coherent, testable vertical slice.
- Given a coverage-map row, when it claims an FR is covered, then each mandatory mechanic in that GDD FR is explicitly present in the referenced story acceptance criteria.

## Spec Change Log

- **Review loop 1:** Adversarial review found that the first implementation substituted learning metrics, deferred Young validation until after expansion, left mandatory case mechanics implicit, and treated a broad Young contract as minimal. The tasks and acceptance criteria now require the exact GDD metrics and sequencing, per-mechanic traceability, incremental contract growth, explicit universal case-loop/confound rules, validation access, and omitted historical case details. This avoids a document that appears fully traced while allowing GDD requirements to ship unplanned. **KEEP:** Preserve the bootstrap-before-Young sequence, the Young contract before Epic 2, the Epic 3 Morley prototype, GDD FR1–FR29 IDs, counterfactual replay, no-economy constraints, and named release evidence.

## Design Notes

Keep campaign sequencing separate from production sequencing: Young is the first implementation/validation case, while Morley–Miller is the first campaign unlock. Young validation must have a non-campaign route that does not change campaign locks, and its learning/accessibility/educator gate must pass before later-case production. The minimal case contract belongs with the first feature that needs it; later foundation stories extend it only with the fields they consume, while Epic 3 proves the hardened contract with an author-reviewable Morley prototype.

## Verification

**Manual checks:**
- Inspect the revised coverage map and all story references for consistent numbering, no forward dependencies, and direct traceability to the GDD.
- Review every added or changed acceptance criterion for Given/When/Then form, a verifiable outcome, and preservation of project constraints.
- Compare each FR1–FR29 coverage row and all release metrics directly against the GDD; confirm every mandatory detail is explicitly represented in the linked story criteria.
