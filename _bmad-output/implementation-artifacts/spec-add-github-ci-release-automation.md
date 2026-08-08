---
title: 'Add GitHub CI and release automation'
type: 'chore'
created: '2026-08-08'
status: 'done'
baseline_commit: '7c408bbb660bdb1f48cdc6932ebf8ab7116bb402'
context:
  - '{project-root}/package.json'
  - '{project-root}/README.md'
  - '{project-root}/**/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Quantique has local verification commands and a production build, but GitHub does not automatically validate contributions or package a distributable build for releases. That leaves regressions and release packaging dependent on a developer's local machine.

**Approach:** Add a GitHub Actions CI workflow for pull requests and main-branch pushes, plus a tag-triggered release workflow that repeats release-critical verification, builds the static site, archives `dist/`, and creates a GitHub Release containing that archive.

## Boundaries & Constraints

**Always:** Use the committed npm lockfile with `npm ci`; run the project-supported TypeScript, unit-test, production-build, and Chromium Playwright checks; keep release output static and derived only from `dist/`; retain the project-local Playwright browser path convention; grant write permission only to the release job.

**Ask First:** Changing GitHub Pages deployment, publishing to an external registry or hosting provider, signing artifacts, or changing the tag/versioning convention.

**Never:** Commit generated `dist/` output, release automatically from a branch push, expose tokens in logs, or add a backend, cloud deployment, analytics, or package publishing.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Contribution validation | Pull request or push to `main` | Install locked dependencies, typecheck, run unit tests, build, and run Chromium e2e tests | A failed command fails the workflow before it can report success |
| Tagged release | Pushed `v*` tag | Repeat verification, create a ZIP from production `dist/`, and attach it to a GitHub Release | A failed verification or build prevents release creation; GitHub permissions are scoped to release contents |
| Non-release tag | Pushed tag not matching `v*` | No release workflow runs | No artifact or release is produced |

</frozen-after-approval>

## Code Map

- `package.json` -- canonical scripts and lockfile-based npm dependency contract used by automation.
- `playwright.config.ts` -- browser-suite configuration; confirms the e2e command starts the production server itself.
- `.github/workflows/ci.yml` -- new contribution-validation workflow.
- `.github/workflows/release.yml` -- new tag-driven static-release workflow.

## Tasks & Acceptance

**Execution:**

- [x] `.github/workflows/ci.yml` -- add Ubuntu/Node 20 CI for pull requests and pushes to `main`, using `npm ci`, typecheck, unit tests, production build, Chromium installation, and Chromium e2e tests -- makes every merged change run the supported verification stack.
- [x] `.github/workflows/release.yml` -- add a `v*` tag workflow that performs the same validation, builds the static site, archives `dist/`, and creates a GitHub Release with that ZIP -- makes tagged releases reproducible and downloadable.
- [x] `README.md` -- document the CI coverage and the `v*` tag release trigger/output -- gives maintainers an explicit, discoverable release procedure.

**Acceptance Criteria:**

- Given an open pull request or a push to `main`, when GitHub Actions executes CI, then it uses locked dependencies and must pass typecheck, unit tests, production build, and Chromium e2e tests.
- Given a pushed tag whose name starts with `v`, when the release workflow succeeds, then GitHub contains a release named after that tag with a ZIP whose contents are the production `dist/` tree.
- Given a push without a matching release tag, when Actions runs, then it cannot create a GitHub Release or write repository contents.
- Given a workflow-edit pull request, when workflow files are inspected, then release write permission is scoped to the release workflow/job and tokens are not interpolated into command output.

## Spec Change Log

## Design Notes

The release workflow deliberately repeats CI rather than depending on a separate workflow completion event. A tag is an immutable release candidate and needs a self-contained, auditable success path; otherwise an untested tag could publish merely because an earlier branch build happened to pass.

The archive should contain `dist/` as its top-level folder, so consumers can distinguish the delivered static application from repository source files. The workflow will use the GitHub CLI already available on the Ubuntu runner to create and upload the release asset, avoiding a third-party release action and keeping the token supplied only through GitHub's standard environment.

## Verification

**Commands:**

- `npm run typecheck` -- expected: TypeScript exits successfully.
- `npm test` -- expected: Vitest suite passes.
- `npm run build` -- expected: Vite creates `dist/` successfully.
- `npm run test:e2e` -- expected: Chromium Playwright suite passes after the project-local browser is installed.
- `git diff --check` -- expected: workflow and documentation edits have no whitespace errors.

## Suggested Review Order

**Automation entry points**

- Start with contribution validation and its read-only permission boundary.
  [`ci.yml:1`](../../.github/workflows/ci.yml#L1)

- Follow the tag-only release path and its release-job write scope.
  [`release.yml:3`](../../.github/workflows/release.yml#L3)

**Release integrity**

- Inspect the filename normalization that keeps unusual valid tags archive-safe.
  [`release.yml:46`](../../.github/workflows/release.yml#L46)

- Inspect creation-or-update behavior for rerun-safe release assets.
  [`release.yml:55`](../../.github/workflows/release.yml#L55)

**Maintainer guidance**

- Confirm the documented checks and version-tag release procedure.
  [`README.md:38`](../../README.md#L38)
