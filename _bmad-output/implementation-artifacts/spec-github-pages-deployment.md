---
title: 'Deploy the static site to GitHub Pages'
type: 'feature'
created: '2026-08-18'
status: 'done'
baseline_commit: '098e9cf2e42e9680dcf147a5dd8253372abac70b'
context:
  - '{project-root}/**/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** CI and the tag-driven release ZIP work, but nothing publishes a playable build — the site only exists as a downloadable archive. Publishing to GitHub Pages puts it at a subpath (`/Quantique/`), and the case asset manifest authors root-absolute paths (`/assets/logo.png`, `/cases/young-interference/assets/characters/*.png`) that `preloadCaseAssets` hands to Phaser unchanged, so every authored portrait would 404 into its vector fallback with no error the player can see.

**Approach:** Resolve authored root-absolute asset paths against the deploy base at the adapter boundary — leaving the schema's root-path contract and the case content untouched — then add a Pages workflow that runs the full verification stack on pushes to `main` and publishes `dist/` through GitHub's official Pages actions.

## Boundaries & Constraints

**Always:** Keep `base: './'` in both Vite configs so the bundle stays subpath- and root-agnostic; resolve asset URLs through one pure function that takes the base explicitly and is unit-tested at root, subpath, and `'./'` bases; run typecheck, unit tests, production build, and the Chromium e2e suite before publishing; scope `pages: write` / `id-token: write` to the deploy job only; use `npm ci` against the committed lockfile.

**Ask First:** Changing the Vite `base`, relaxing the manifest's root-path schema rule, editing `public/cases/**` content, adding a custom domain or CNAME, publishing from a `gh-pages` branch instead of the Pages action, or bumping `CaseDefinition.version`.

**Never:** Commit `dist/`, publish from a branch other than `main`, deploy without the verification stack passing, add a backend, analytics, or remote configuration, or duplicate the asset-path fix into a second call site instead of the shared boundary.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Subpath host | Authored `/assets/logo.png`, base `'./'` | Phaser loads `./assets/logo.png`, resolving under `/Quantique/` | N/A |
| Root host | Authored `/assets/logo.png`, base `'/'` | Phaser loads `/assets/logo.png` — byte-identical to today's behavior | N/A |
| Explicit subpath base | Authored `/cases/x/a.png`, base `'/Quantique/'` | Phaser loads `/Quantique/cases/x/a.png` | N/A |
| Base without trailing slash | base `'/Quantique'` | Exactly one separator in the result — never `//` and never a missing `/` | N/A |
| Non-image manifest entry | `audio` / `document` entry | Not queued through the image loader (unchanged) | N/A |
| Push to `main` | Verification stack passes | `dist/` publishes to Pages | A failed check fails the job before `deploy-pages` runs |
| Push to `main` | Any check fails | Nothing publishes; the previous live site stays up | Job fails loudly in Actions |

</frozen-after-approval>

## Code Map

- `src/adapters/phaser/preloadCaseAssets.ts` -- the sole runtime consumer of `asset.path`; queues manifest images into Phaser's loader. The fix boundary.
- `src/adapters/content/loadCaseDefinition.ts:7` -- `contentPath` already resolves case JSON against `import.meta.env.BASE_URL`; the reference pattern to mirror, including the `baseUrl = import.meta.env.BASE_URL` default parameter.
- `src/schemas/CaseDefinitionSchema.ts:463` -- `AssetManifestSchema` requires `^\/(?!\/)` root paths. Authoring contract — do not change.
- `src/adapters/phaser/scenes/{Laboratory,Library,RivalLab,Debrief}Scene.ts` -- the four `preloadCaseAssets(this, …)` call sites; a defaulted parameter leaves all four untouched.
- `vite/config.prod.mjs:22` -- `base: './'`; already rewrites `index.html`'s `/style.css` and `/favicon.png` to `./` in `dist/`. No change needed.
- `.github/workflows/ci.yml` -- the verification-step sequence the deploy job mirrors.
- `tests/unit/PreloadCaseAssets.test.ts` -- asserts exact queued `[key, path]` pairs; extend rather than rewrite.
- `tests/e2e/offline-reload.spec.ts:24` -- asserts the portrait response `pathname === '/cases/…/thea-young.png'`; must stay green under the preview server's root base.

Added during step-04 review (see Spec Change Log):

- `tests/e2e/subpath-hosting.spec.ts` -- the automated guard for acceptance criterion 1; runs against a second preview server built with `--base=/Quantique/`.
- `playwright.config.ts` -- `webServer` is now an array: the root-origin server plus the subpath server on port 4273.
- `package.json` -- `build:subpath` / `preview:subpath` scripts backing that server; `.gitignore` covers `dist-subpath/`.

## Tasks & Acceptance

**Execution:**

- [x] `src/adapters/content/resolveAssetUrl.ts` -- add a pure `resolveAssetUrl(path, baseUrl)` that joins an authored root-absolute path to a deploy base with exactly one separator -- gives both content and Phaser loading one place where the deploy base is applied.
- [x] `src/adapters/phaser/preloadCaseAssets.ts` -- queue `resolveAssetUrl(asset.path, baseUrl)` with a `baseUrl = import.meta.env.BASE_URL` third parameter -- makes authored portraits load under any host path without touching the four scene call sites.
- [x] `tests/unit/ResolveAssetUrl.test.ts` -- cover every I/O matrix row for the resolver: `'./'`, `'/'`, `'/Quantique/'`, and `'/Quantique'` bases -- pins the separator rule that a subpath deploy depends on.
- [x] `tests/unit/PreloadCaseAssets.test.ts` -- add an explicit-`baseUrl` case asserting subpath-prefixed queued paths, and keep the existing root-base expectations -- proves the fix without loosening the existing contract.
- [x] `.github/workflows/pages.yml` -- add a `main`-push (plus `workflow_dispatch`) workflow: `npm ci`, typecheck, unit tests, build, Chromium install, Chromium e2e, then `actions/upload-pages-artifact` on `dist/` and `actions/deploy-pages` in a `github-pages`-environment deploy job with `pages: write` and `id-token: write` scoped there -- publishes a verified build and nothing else.
- [x] `README.md` -- document the Pages deployment, its URL, and that GitHub Pages on a private repository requires a paid plan, so this workflow will fail at the deploy step until the repo is public or upgraded -- records the one thing that blocks a green run today.

**Acceptance Criteria:**

- Given a manifest whose paths are root-absolute, when the game runs from a subpath host, then every authored portrait resolves under that subpath rather than the origin root.
- Given the resolver is used, when the site is served from the origin root, then the requested asset URLs are unchanged from `baseline_commit` — `tests/e2e/offline-reload.spec.ts` still observes `/cases/…/thea-young.png` from the service worker.
- Given a push to `main`, when the Pages workflow runs, then the publish step is reachable only after typecheck, unit tests, build, and Chromium e2e have passed.
- Given the repository is private on a free plan, when the workflow reaches `deploy-pages`, then it fails at that step with the plan requirement documented in `README.md` — and no earlier step is skipped or weakened to hide it.
- Given the workflow files are inspected, when permissions are audited, then `pages: write` and `id-token: write` exist only on the deploy job and the top-level default stays `contents: read`.

## Spec Change Log

- **2026-08-18 — step-04 review patches (no loopback; no `intent_gap` or `bad_spec` finding).** Three reviewers converged on two real defects, both fixed in place rather than by re-deriving code. (1) **Acceptance criterion 1 had no automated test** — the spec's Verification section prescribed only a *manual* subpath build-and-inspect, so the release gate could have stayed green on a build whose assets 404 under `/Quantique/`. Added `tests/e2e/subpath-hosting.spec.ts` behind a second `webServer`, and **mutation-proved both of its tests**: reverting `resolveAssetUrl` fails the asset test with the six portraits requested from the origin root, and making `OfflineCache`'s `register` absolute fails the worker-scope test. (2) **`workflow_dispatch` had no ref guard**, so a manual run from any branch would have published it live — breaching this spec's own `Never: publish from a branch other than main` while the spec's task text simultaneously mandated `workflow_dispatch`; the deploy job now carries `if: github.ref == 'refs/heads/main'`. Two test-quality fixes came with them: an anchored `not.toMatch(/^\/\//)` in place of a whole-string `not.toContain('//')`, and a corrected comment on the defaulted-base test, which pins Vitest's `'/'` rather than the `'./'` a real build ships. **KEEP if this is ever re-derived:** the defaulted `baseUrl` parameter (it leaves all four scene call sites untouched), the base-independent texture keys, and the two mutation proofs — a guard for a silent failure mode is worth nothing until it has been seen to fail.

## Design Notes

`import.meta.env.BASE_URL` is `'./'` under both Vite configs, so the resolver's common output is a document-relative URL — correct at `/`, at `/Quantique/`, and under the service worker's same-origin cache alike. Mirror `contentPath`'s existing shape rather than inventing a second convention:

```ts
export const resolveAssetUrl = (path: string, baseUrl: string): string =>
    `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}${path}`;
```

Phaser resolves a relative loader path against the document URL, which is why no `setPath` call is involved and why the four scene call sites need no change. `src/game/scenes/*` are orphaned template leftovers — do not touch them.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors.
- `npm test` -- expected: all unit tests pass, including the new resolver suite.
- `npm run test:e2e` -- expected: the Chromium suite is no worse than `baseline_commit`; `offline-reload.spec.ts` passes.
- `npx vite build --config vite/config.prod.mjs --base=/Quantique/ && npx vite preview --outDir dist` -- expected: served under a subpath, the boot shell and the Young laboratory render authored portraits with no 404 in the network log.

**Manual checks (if no CLI):**
- `.github/workflows/pages.yml`: top-level `permissions` is `contents: read`; `pages: write` / `id-token: write` appear only in the deploy job, which declares `environment: github-pages`.

## Suggested Review Order

**The subpath defect and its fix**

- Start here: the whole design intent is one join, stated with its reason.
  [`resolveAssetUrl.ts:16`](../../src/adapters/content/resolveAssetUrl.ts#L16)

- The single boundary where an authored root path becomes a request URL.
  [`preloadCaseAssets.ts:42`](../../src/adapters/phaser/preloadCaseAssets.ts#L42)

- Defaulted, so all four scene call sites stay untouched.
  [`preloadCaseAssets.ts:35`](../../src/adapters/phaser/preloadCaseAssets.ts#L35)

**Publishing, and who is allowed to**

- `pages: write` sits on the deploy job alone; the top level stays read-only.
  [`pages.yml:71`](../../.github/workflows/pages.yml#L71)

- The ref guard: without it, a manual dispatch from any branch publishes live.
  [`pages.yml:68`](../../.github/workflows/pages.yml#L68)

- Verification runs in its own job and gates the deploy through `needs`.
  [`pages.yml:19`](../../.github/workflows/pages.yml#L19)

**The guard that makes the gate honest** (added in review)

- Asserts the subpath URL *and* the absence of the origin-root one.
  [`subpath-hosting.spec.ts:62`](../../tests/e2e/subpath-hosting.spec.ts#L62)

- Offline reload is a release gate, so worker scope is pinned too.
  [`subpath-hosting.spec.ts:83`](../../tests/e2e/subpath-hosting.spec.ts#L83)

- A second server, because the suite otherwise only ever sees `/`.
  [`playwright.config.ts:49`](../../playwright.config.ts#L49)

**Supporting**

- Every base the project can ship, including the no-trailing-slash case.
  [`ResolveAssetUrl.test.ts:1`](../../tests/unit/ResolveAssetUrl.test.ts#L1)

- Subpath expectations added; root-base expectations deliberately unchanged.
  [`PreloadCaseAssets.test.ts:57`](../../tests/unit/PreloadCaseAssets.test.ts#L57)

- The two prerequisites that block a green deploy today.
  [`README.md:44`](../../README.md#L44)
