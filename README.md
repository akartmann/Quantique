# Quantique

Quantique is a static, local-first historical science investigation game. This repository starts from Phaser's official Vite + TypeScript template and currently provides only the accessible boot shell and verification harness for the Young validation slice.

## Prerequisites

- Node.js 20.19.0 or later
- npm

Install dependencies and the Playwright browser binaries:

```sh
npm install
npx playwright install
```

The project scripts use a project-local Playwright browser cache. To populate that cache explicitly, run:

```sh
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium firefox webkit
```

## Development and verification

```sh
npm run dev                    # Start the Vite development server
npm run build                  # Produce static files in dist/
npm run typecheck              # TypeScript checking
npm test                       # Vitest unit tests
npm run test:e2e               # Chromium browser suite
npm run test:e2e:offline       # Cached production offline-reload test (Chromium)
npm run test:e2e:a11y          # axe accessibility test (Chromium)
npm run test:e2e:cross-browser # Chromium, Firefox, and WebKit boot-shell coverage
```

Browser tests build and serve the production artifact automatically, on two servers: the root-origin preview on port 4173, and a `--base=/Quantique/` build on port 4273 that `tests/e2e/subpath-hosting.spec.ts` uses to check the site works from the subpath GitHub Pages serves it from. The offline-reload check is intentionally Chromium-only because Playwright WebKit cannot perform the forced offline reload used by this test; the shared boot-shell and accessibility checks run in Chromium, Firefox, and WebKit.

## Continuous integration and releases

GitHub Actions runs locked dependency installation, typechecking, unit tests, a production build, and the Chromium end-to-end suite for every pull request and every push to `main`.

To create a release, push a version tag beginning with `v` (for example, `v0.1.0`). The release workflow repeats the same checks, packages the production `dist/` directory as `quantique-<tag>.zip`, and attaches that archive to a GitHub Release generated from the tag.

## GitHub Pages deployment

Every push to `main` also runs the `Pages` workflow, which repeats the full verification stack and then publishes `dist/` to GitHub Pages at `https://akartmann.github.io/Quantique/`. The workflow can also be started manually from the Actions tab. Publishing is reachable only after typechecking, unit tests, the production build, and the Chromium end-to-end suite have passed, so a failed check leaves the previously published site in place.

Two prerequisites are worth stating explicitly:

- **The repository must be public, or on a paid GitHub plan.** GitHub Pages is unavailable for private repositories on the Free plan, so the workflow's verification job will succeed and its deploy job will fail until the repository is made public or the account is upgraded.
- **Pages must be set to build from GitHub Actions** (Settings → Pages → Source: GitHub Actions). The workflow uses `actions/deploy-pages` rather than pushing to a `gh-pages` branch.

The site is hosted from a subpath, and both Vite configurations set `base: './'` so the same build works from a subpath or from a domain root. Authored case asset paths are same-origin root paths by contract, so `resolveAssetUrl` applies the deploy base when queueing them into the Phaser loader.

## Delivery constraints

The production build is static-hostable. The boot shell remains semantic HTML with a keyboard-operable entry button; Phaser is visual-only. The minimal service worker caches same-origin production assets after a successful online load so the boot shell can reload offline. It does not use accounts, telemetry, advertising, remote configuration, cloud save, or a backend.
