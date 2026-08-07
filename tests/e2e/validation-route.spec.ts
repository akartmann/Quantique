import { expect, test, type Page } from '@playwright/test';

import {
    PROGRESS_DATABASE_NAME,
    PROGRESS_DATABASE_VERSION,
    PROGRESS_STORE_NAME
} from '../../src/adapters/persistence/IndexedDbRepository';
import { bookCloseControlCentre } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import {
    artifactAt,
    clickDesign,
    enterTheLaboratory,
    waitForBookToClose,
    waitForBookToOpen
} from './canvasHelpers';

/**
 * AC4: the moderated validation route grants Young access without touching campaign locks or player
 * progression, and AC5: its facilitator disclosure renders in the browser's resolved locale.
 *
 * Re-pointed at the Phaser-era contract. The previous version drove the retired DOM panels
 * (`Curated Record`, `Save, export, import, and print`, `Inspection recorded`) as its evidence of
 * "the route works". Those panels are mounted-but-retiring, so an assertion built on them tests
 * something the release is removing. What is asserted here instead is the surface set the
 * architecture keeps: the retained boot frame (`data-testid="enter-laboratory"` + `#boot-status`),
 * the routed Phaser canvas (`#game-container[data-active-scene]`), and the *absence* of the progress
 * region and the printable-record article — that absence is the isolation mechanism itself.
 */

const YOUNG_CASE_ID = 'young-interference';

/**
 * The retained printable record (ADR-007), which the `if (repository)` gate in `main.ts` mounts on the
 * normal route and not on the validation route.
 *
 * It is the last of the two surfaces this file used to check for. The other — the progress panel — is
 * deleted, and asserting its absence became true on every route in the same commit, which is precisely
 * the "an assertion that is true everywhere proves nothing" AC5 names. So the absence below is always
 * paired with the **presence** of the same surface on the normal route: one of the two has to fail if
 * the gate stops working, whichever way it breaks.
 */
const printableRecord = (page: Page) => page.getByRole('article', { name: en['print.ariaLabel'] });

const expectActiveScene = async (page: Page, sceneKey: string): Promise<void> => {
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', sceneKey);
};

/**
 * Reads the persisted record straight out of IndexedDB and serialises it, so "untouched" is a
 * byte-for-byte string comparison rather than an inference from whatever the UI chose to re-render.
 * Reading through a panel would make the proof depend on a surface the pivot is deleting; the record
 * itself is the thing that must not change.
 *
 * Opens at the same version the app uses and never upgrades a store into existence beyond that, so a
 * read on a route that has written nothing resolves `undefined` instead of failing.
 */
const readStoredYoungRecord = (page: Page): Promise<string | undefined> =>
    page.evaluate(
        ({ caseId, databaseName, databaseVersion, storeName }) =>
            new Promise<string | undefined>((resolve, reject) => {
                const request = indexedDB.open(databaseName, databaseVersion);
                request.onupgradeneeded = () => {
                    if (!request.result.objectStoreNames.contains(storeName)) {
                        request.result.createObjectStore(storeName);
                    }
                };
                request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
                request.onsuccess = () => {
                    const database = request.result;
                    if (!database.objectStoreNames.contains(storeName)) {
                        database.close();
                        resolve(undefined);
                        return;
                    }
                    const read = database.transaction(storeName, 'readonly').objectStore(storeName).get(caseId);
                    read.onsuccess = () => {
                        const stored: unknown = read.result;
                        database.close();
                        resolve(stored === undefined ? undefined : JSON.stringify(stored));
                    };
                    read.onerror = () => {
                        database.close();
                        reject(read.error ?? new Error('IndexedDB read failed.'));
                    };
                };
            }),
        {
            caseId: YOUNG_CASE_ID,
            databaseName: PROGRESS_DATABASE_NAME,
            databaseVersion: PROGRESS_DATABASE_VERSION,
            storeName: PROGRESS_STORE_NAME
        }
    );

/**
 * Seeds a real saved record **through the canvas** (Story 2.12, AC5).
 *
 * It used to press the retired progress panel's "Save progress" button. There is no manual save any
 * more: `attachAutosave` writes on every state change, so the seeding path is simply *playing* — one
 * reference taken off the reading room's shelf dispatches `source.inspected`, and the write follows.
 *
 * That makes this a stronger precondition than the one it replaces rather than a weaker one: it
 * exercises the autosave the offline release gate depends on, so a run that reaches the assertions
 * below has already proved the relocation works.
 */
const seedSavedProgressOnNormalRoute = async (page: Page): Promise<string> => {
    await page.goto('/');
    await enterTheLaboratory(page);
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', 'Library');

    await clickDesign(page, artifactAt(0));
    await waitForBookToOpen(page);
    await clickDesign(page, bookCloseControlCentre());
    await waitForBookToClose(page);

    // The write is serialized through a promise chain rather than awaited by the dispatch, so it is
    // polled for rather than assumed — and a seed that never arrives fails here, where the cause is,
    // instead of turning the isolation comparison below into `undefined === undefined`.
    let seeded: string | undefined;
    await expect(async () => {
        seeded = await readStoredYoungRecord(page);
        expect(seeded, 'the normal route must have persisted a record to isolate against').toBeDefined();
    }).toPass({ timeout: 5_000, intervals: [100, 200, 400, 800] });
    // And it holds the reading that was just recorded, so "unchanged" below is a claim about content
    // rather than about an empty record that could not have changed.
    expect(seeded).toContain('young-lecture-1801');
    return seeded as string;
};

test('runs an isolated Young validation session that leaves the saved learner record byte-for-byte untouched', async ({ page }) => {
    const seeded = await seedSavedProgressOnNormalRoute(page);

    await page.goto(`/?mode=validation`);

    // The retained boot frame, which is the non-Phaser surface the architecture keeps.
    const entryButton = page.getByTestId('enter-laboratory');
    await expect(entryButton).toBeVisible();

    /**
     * The facilitator disclosure, resolved through the i18n layer rather than hardcoded — and asserted
     * **before** entry, which is where it is now shown.
     *
     * It rides on the boot frame, and since Story 2.12 the frame is dismissed when the session starts
     * rather than standing beside the canvas for its duration. That is the right place for it: this is a
     * consent notice ("the application does not collect session responses"), and a consent notice is
     * read before the thing it consents to, not over the top of it. AC4's "on every render of the
     * validation route" is satisfied — it is mounted on every render of the route — but the *duration*
     * of its visibility did change, so it is called out here and in the story's completion notes rather
     * than left for a reader to infer from a moved assertion.
     */
    await expect(page.getByRole('region', { name: en['validation.session.title'] })).toContainText(
        en['validation.session.noCollection']
    );

    // **Not** `toHaveText(en['boot.enter'])`: `index.html` ships that exact string as pre-hydration
    // placeholder markup (ADR-010), so the assertion passed whether or not the app ever booted — the
    // vacuous check AC5 calls out. The status line is JS-only, so it is the one that can fail; the
    // French case below is where the label itself is proved to have been rewritten.
    await entryButton.click();
    await expect(page.locator('#boot-status')).toHaveText(en['boot.status.ready']);

    // Product isolation: the printable record is not mounted, because no repository was constructed.
    // Paired with its presence on the normal route below, so neither half is true on every route.
    await expect(printableRecord(page)).toHaveCount(0);

    // No later case is unlocked, relocked, or exposed — there is no campaign machinery to leak.
    await expect(page.getByRole('link', { name: /Morley|Hafele|Delft/i })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/Morley|Hafele|Delft/i);

    // A real, live session on a fresh state: the routed canvas starts in the Young context phase and
    // advances with the investigation, so the interaction below is not a no-op.
    await expectActiveScene(page, 'Library');
    for (let index = 0; index < 2; index += 1) {
        await clickDesign(page, artifactAt(index));
        await waitForBookToOpen(page);
        await clickDesign(page, bookCloseControlCentre());
        await waitForBookToClose(page);
    }
    // The same acts that seeded a record on the normal route. If the validation route had a repository,
    // this is exactly where it would have written one.
    await expectActiveScene(page, 'Library');

    // Nothing the session did reached the store the normal route owns. Compared once rather than
    // retried: `toPass` would settle on the first matching read and so could step over a write still
    // in flight, which is the failure this assertion exists to catch.
    expect(await readStoredYoungRecord(page)).toBe(seeded);

    // And the normal route still restores exactly what it saved — the second read also catches a late
    // write that the first one would have raced.
    await page.goto('/');
    await expectActiveScene(page, 'Library');
    expect(await readStoredYoungRecord(page)).toBe(seeded);

    // Byte-equality proves the record on disk is intact; it does not prove the app read it back.
    // `data-active-scene` cannot close that gap here — the seed sits at the `context` phase, which is
    // also where a completely fresh state routes, so `Library` is satisfied either way. A failed
    // restore is otherwise silent: `main.ts` falls back to `initialState` behind a polite status
    // message. So assert restored *content*, on the retained print view (ADR-007) rather than a
    // retiring panel: it lists inspected sources, and a fresh state renders the empty placeholder.
    // The other half of the isolation pair: mounted here, absent there. An `if (repository)` gate that
    // stopped working in either direction fails one of the two.
    await expect(printableRecord(page)).toHaveCount(1);
    await expect(printableRecord(page)).toContainText('Thomas Young’s 1801 lecture record');
    await expect(printableRecord(page)).not.toContainText(en['print.sources.empty']);
});

/**
 * NFR19 / AC4: a French moderated session must not be handed an English disclosure. The locale comes
 * from the browser and nothing else — there is no in-product selector for a facilitator to click — so
 * the browser context locale is the entire input, and the expected strings are imported from the
 * locale resource rather than restated here.
 */
test.describe('French browser', () => {
    // NFR1's viewport target, because French copy runs 15–25% longer than English and the disclosure
    // sits in a `max-width: 34rem` boot frame.
    test.use({ locale: 'fr-FR', viewport: { width: 1280, height: 720 } });

    test('renders the validation disclosure in French, fully readable without scrolling', async ({ page }) => {
        await page.goto('/?mode=validation');

        const disclosure = page.getByRole('region', { name: fr['validation.session.title'] });
        await expect(disclosure.getByRole('heading', { name: fr['validation.session.title'] })).toBeVisible();
        // The entry label really was rewritten by `renderBootShellText`, which is what the English case
        // cannot show: `index.html` ships the English string as static markup, so only the French one
        // can tell hydration from placeholder.
        await expect(page.getByTestId('enter-laboratory')).toHaveText(fr['boot.enter']);
        await expect(disclosure).toContainText(fr['validation.session.facilitatorHeld']);
        await expect(disclosure).toContainText(fr['validation.session.noCollection']);
        await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

        // Longer French copy cannot *clip* this disclosure, and asserting that it doesn't would be
        // asserting nothing: the section is an auto-height `display: grid` box with no `overflow` or
        // `max-height`, inside an auto-height `.boot-shell`, on a page that simply grows and scrolls.
        // Measured directly — `scrollHeight - clientHeight` stays 0 on both the section and the frame
        // even with 60× the real copy, so every containment assertion here passes for any text.
        //
        // What longer copy genuinely breaks is whether the statement is readable *without scrolling*:
        // the disclosure sits below the entry button, so extra lines push its tail past the fold and a
        // facilitator can brief a learner on a consent notice whose end neither of them has seen. So
        // assert the thing that matters and can actually fail — it fits in NFR1's viewport. Real FR copy
        // clears the fold by ~283px; 60× the copy misses it by ~1031px.
        const fit = await disclosure.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return {
                pixelsBelowFold: box.bottom - window.innerHeight,
                pixelsPastRightEdge: box.right - window.innerWidth,
                height: box.height
            };
        });
        expect(fit.height, 'the disclosure must actually render').toBeGreaterThan(0);
        expect(fit.pixelsBelowFold, 'the FR disclosure must be fully readable without scrolling at 1280×720').toBeLessThanOrEqual(0);
        expect(fit.pixelsPastRightEdge, 'the FR disclosure must not run past the viewport edge').toBeLessThanOrEqual(0);

        // The English strings must not survive anywhere in a French session.
        await expect(page.locator('body')).not.toContainText(en['validation.session.facilitatorHeld']);
        await expect(page.locator('body')).not.toContainText(en['validation.session.noCollection']);
    });
});
