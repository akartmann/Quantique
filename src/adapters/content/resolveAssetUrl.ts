/**
 * Resolves an authored asset path against the deploy base.
 *
 * `AssetManifestSchema` requires every authored path to be a same-origin root path (`/assets/…`),
 * which is an *authoring* contract rather than a request URL: a root path ignores the base the site
 * is actually served from, so on a subpath host (GitHub Pages serves this repository at
 * `/Quantique/`) it resolves against the origin root and 404s. Phaser's loader failure is silent by
 * design — renderers fall back to authored vector art — so the defect would reach a player as
 * missing portraits with nothing logged.
 *
 * `baseUrl` is passed explicitly rather than read from `import.meta.env` here so this stays pure and
 * testable at every base the project can be built with: `'./'` (both Vite configs today), `'/'`,
 * and an explicit `'/Quantique/'`. A base with no trailing slash is accepted because
 * `import.meta.env.BASE_URL` is not guaranteed to carry one.
 */
const resolveAssetUrl = (path: string, baseUrl: string): string =>
    `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}${path}`;

export { resolveAssetUrl };
