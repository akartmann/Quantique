import { expect, test } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';

/**
 * The publishing gate for a subpath host.
 *
 * GitHub Pages serves this repository from `/Quantique/`, and every other spec in this suite runs
 * against a root-origin preview server — so without this file the whole release gate could stay green
 * on a build whose assets 404. That is not a hypothetical: the authored manifest paths are same-origin
 * *root* paths by schema contract (`AssetManifestSchema`), Phaser hands a loader path to the browser
 * unchanged, and a Phaser load failure is silent by design because renderers fall back to authored
 * vector art. The composed failure is a published site with five missing portraits, no console error,
 * and no red test.
 *
 * This runs against its own server on `SUBPATH_ORIGIN`, built with `--base=/Quantique/`, so what it
 * observes is the real production pipeline rather than a stub of it.
 */

const SUBPATH_ORIGIN = 'http://127.0.0.1:4273';
const SUBPATH = '/Quantique/';

/** Authored in the manifest as `/…`; correct here only if the deploy base has been applied. */
const AUTHORED_IMAGES = [
    '/assets/logo.png',
    '/cases/young-interference/assets/characters/thea-young.png',
    '/cases/young-interference/assets/characters/elias-wren.png',
    '/cases/young-interference/assets/characters/marianne-cole.png',
    '/cases/young-interference/assets/characters/samuel-hart.png',
    '/cases/young-interference/assets/characters/arthur-bell.png'
] as const;

test.use({ baseURL: SUBPATH_ORIGIN });

test('requests every authored asset under the deploy subpath, not the origin root', async ({ page }) => {
    // Collected from before the first navigation: the preloader runs during entry, so a
    // `waitForResponse` registered afterwards would race it.
    const failures: string[] = [];
    page.on('response', (response) => {
        if (response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });

    await page.goto(SUBPATH);
    await page.getByRole('button', { name: en['boot.enter'] }).click();

    // Wait on the last authored portrait rather than a fixed sleep, then read what was actually
    // requested. `performance` is the honest record here: a 404 still appears as a resource entry, so
    // the assertion below is about the URL that was built, and `failures` is about how it answered.
    await page.waitForFunction(
        (last) => performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(last)),
        AUTHORED_IMAGES[AUTHORED_IMAGES.length - 1],
        { timeout: 30_000 }
    );

    const requested = await page.evaluate(() => performance.getEntriesByType('resource')
        .map((entry) => new URL(entry.name).pathname));

    for (const authoredPath of AUTHORED_IMAGES) {
        expect(requested, `authored ${authoredPath} must be requested under ${SUBPATH}`)
            .toContain(`${SUBPATH.slice(0, -1)}${authoredPath}`);
        expect(requested, `authored ${authoredPath} must not be requested from the origin root`)
            .not.toContain(authoredPath);
    }

    // The case bundle resolves through a different mechanism (`contentPath`) against the same base, so
    // the two are pinned together — a base applied to one and not the other is the defect this guards.
    expect(requested).toContain(`${SUBPATH}cases/young-interference/case.json`);
    expect(requested).toContain(`${SUBPATH}cases/young-interference/asset-manifest.json`);

    expect(failures, 'no request may fail under a subpath host').toEqual([]);
});

test('registers the service worker at the subpath scope, keeping the offline gate intact', async ({ page }) => {
    // Offline reload is a release gate, and a worker registered at the wrong scope controls nothing.
    // `./sw.js` is relative on purpose; this asserts what that resolves to when the document is not at
    // the origin root.
    await page.goto(SUBPATH);

    // `register()` is fired and not awaited by the boot path, so wait on the worker reaching a live
    // state rather than sampling immediately — `getRegistration()` can resolve with a registration
    // whose state fields are all still empty, which fails for timing reasons and says nothing.
    const scope = await page.evaluate(async () => {
        const ready = await navigator.serviceWorker.ready;
        return ready.scope;
    });

    expect(scope).toBe(`${SUBPATH_ORIGIN}${SUBPATH}`);
});
