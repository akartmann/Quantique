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

Browser tests build and serve the production artifact automatically. The offline-reload check is intentionally Chromium-only because Playwright WebKit cannot perform the forced offline reload used by this test; the shared boot-shell and accessibility checks run in Chromium, Firefox, and WebKit.

## Continuous integration and releases

GitHub Actions runs locked dependency installation, typechecking, unit tests, a production build, and the Chromium end-to-end suite for every pull request and every push to `main`.

To create a release, push a version tag beginning with `v` (for example, `v0.1.0`). The release workflow repeats the same checks, packages the production `dist/` directory as `quantique-<tag>.zip`, and attaches that archive to a GitHub Release generated from the tag.

## Delivery constraints

The production build is static-hostable. The boot shell remains semantic HTML with a keyboard-operable entry button; Phaser is visual-only. The minimal service worker caches same-origin production assets after a successful online load so the boot shell can reload offline. It does not use accounts, telemetry, advertising, remote configuration, cloud save, or a backend.
