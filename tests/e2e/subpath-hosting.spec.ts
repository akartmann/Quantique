import { expect, test } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';
import { KNOWN_CASE_IDS } from '../../src/schemas/CaseDefinitionSchema';
import { resolveCampaignEntryCaseId } from '../../src/domain/cases/campaignOrder';
import { readShippedCaseFile } from '../shippedCases';

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

/**
 * Every path the case's own manifest authors, read from the manifest rather than restated.
 *
 * It used to be a six-entry literal naming Young's five portraits and the logo, which was wrong twice
 * over once Story 4.1 flipped the campaign default: the list stopped describing what a visitor to
 * `/Quantique/` actually loads, and a hand-copied list of authored content is the *"never restate a case
 * constant"* shape besides. Read through `tests/shippedCases.ts` rather than importing `node:fs` here,
 * for the reason that module exists — `@types/node` is deliberately absent, so each `node:` import costs
 * a `TS2307` on a count that may only go down.
 *
 * Authored in the manifest as `/…`; correct under this host only if the deploy base has been applied.
 */
const authoredImages = async (caseId: string): Promise<readonly string[]> => {
    const manifest = JSON.parse(await readShippedCaseFile(caseId, 'asset-manifest.json')) as {
        entries: { path: string }[];
    };
    const paths = manifest.entries.map(({ path }) => path);
    if (paths.length === 0) throw new Error(`${caseId} authors no assets — this spec would assert nothing.`);
    return paths;
};

test.use({ baseURL: SUBPATH_ORIGIN });

/**
 * One run per shipped case, at that case's own route.
 *
 * Both cases, because the base is applied to `contentPath` and to the Phaser loader independently and
 * the two cases exercise different amounts of it: Young authors five portraits through the preloader,
 * the prototype authors only the shared logo. A base applied for one and not the other is exactly the
 * silent-404 defect this file exists for, and sweeping `KNOWN_CASE_IDS` means a third case joins by
 * being added to the allowlist.
 */
for (const caseId of KNOWN_CASE_IDS) {
    test(`requests every asset ${caseId} authors under the deploy subpath, not the origin root`, async ({ page }) => {
        const images = await authoredImages(caseId);
        // Collected from before the first navigation: the preloader runs during entry, so a
        // `waitForResponse` registered afterwards would race it.
        const failures: string[] = [];
        page.on('response', (response) => {
            if (response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
        });

        // Named, not the bare subpath: `/` is the campaign entry now, so a bare navigation would boot
        // whichever case comes first and this loop would assert one case's assets twice. The bare
        // subpath has its own test below, which is where that behaviour belongs.
        await page.goto(`${SUBPATH}?case=${caseId}`);
        await page.getByRole('button', { name: en['boot.enter'] }).click();

        // Wait on the last authored image rather than a fixed sleep, then read what was actually
        // requested. `performance` is the honest record here: a 404 still appears as a resource entry, so
        // the assertion below is about the URL that was built, and `failures` is about how it answered.
        await page.waitForFunction(
            (last) => performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(last)),
            images[images.length - 1],
            { timeout: 30_000 }
        );

        const requested = await page.evaluate(() => performance.getEntriesByType('resource')
            .map((entry) => new URL(entry.name).pathname));

        for (const authoredPath of images) {
            expect(requested, `authored ${authoredPath} must be requested under ${SUBPATH}`)
                .toContain(`${SUBPATH.slice(0, -1)}${authoredPath}`);
            expect(requested, `authored ${authoredPath} must not be requested from the origin root`)
                .not.toContain(authoredPath);
        }

        // The case bundle resolves through a different mechanism (`contentPath`) against the same base, so
        // the two are pinned together — a base applied to one and not the other is the defect this guards.
        expect(requested).toContain(`${SUBPATH}cases/${caseId}/case.json`);
        expect(requested).toContain(`${SUBPATH}cases/${caseId}/asset-manifest.json`);

        expect(failures, 'no request may fail under a subpath host').toEqual([]);
    });
}

/**
 * What a real visitor to the published site gets: the **campaign entry**, resolved under the subpath.
 *
 * The case id comes from `resolveCampaignEntryCaseId([])` — the production rule for a fresh profile —
 * rather than from a literal, so this states "the campaign entry loads under a subpath host" instead of
 * "Morley–Miller loads under a subpath host", and it moves with the campaign rather than pinning it.
 */
test('boots the campaign entry under the deploy subpath for a fresh visitor', async ({ page }) => {
    const entryCaseId = resolveCampaignEntryCaseId([]);
    const failures: string[] = [];
    page.on('response', (response) => {
        if (response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });

    await page.goto(SUBPATH);
    await page.getByRole('button', { name: en['boot.enter'] }).click();

    await page.waitForFunction(
        (expected) => performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(expected)),
        `cases/${entryCaseId}/case.json`,
        { timeout: 30_000 }
    );

    const requested = await page.evaluate(() => performance.getEntriesByType('resource')
        .map((entry) => new URL(entry.name).pathname));

    expect(requested).toContain(`${SUBPATH}cases/${entryCaseId}/case.json`);
    expect(requested, 'the case bundle must not be fetched from the origin root')
        .not.toContain(`/cases/${entryCaseId}/case.json`);
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
