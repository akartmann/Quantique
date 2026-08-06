import { expect, test, type Page } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';

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

/** The `if (repository)` gate in `main.ts` is what keeps both of these off the validation route. */
const PROGRESS_REGION = 'Save, export, import, and print';

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
        (caseId) =>
            new Promise<string | undefined>((resolve, reject) => {
                const request = indexedDB.open('quantique-progress', 1);
                request.onupgradeneeded = () => {
                    if (!request.result.objectStoreNames.contains('case-records')) {
                        request.result.createObjectStore('case-records');
                    }
                };
                request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
                request.onsuccess = () => {
                    const database = request.result;
                    if (!database.objectStoreNames.contains('case-records')) {
                        database.close();
                        resolve(undefined);
                        return;
                    }
                    const read = database.transaction('case-records', 'readonly').objectStore('case-records').get(caseId);
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
        YOUNG_CASE_ID
    );

/**
 * Seeds a real saved record through the only save affordance the product currently has. The progress
 * panel is retiring, but its presence on the normal route and absence on the validation route is
 * precisely the isolation contract under test — and the *proof* below reads IndexedDB directly, so it
 * survives the panel's deletion even though the seeding step will need a new home.
 */
const seedSavedProgressOnNormalRoute = async (page: Page): Promise<string> => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    const progress = page.getByRole('region', { name: PROGRESS_REGION });
    await progress.getByRole('button', { name: 'Save progress' }).click();
    await expect(progress.getByRole('status', { name: 'Progress status' })).toHaveText('Progress saved on this device.');

    const seeded = await readStoredYoungRecord(page);
    expect(seeded, 'the normal route must have persisted a record to isolate against').toBeDefined();
    return seeded as string;
};

test('runs an isolated Young validation session that leaves the saved learner record byte-for-byte untouched', async ({ page }) => {
    const seeded = await seedSavedProgressOnNormalRoute(page);

    await page.goto(`/?mode=validation`);

    // The retained boot frame, which is the non-Phaser surface the architecture keeps.
    const entryButton = page.getByTestId('enter-laboratory');
    await expect(entryButton).toBeVisible();
    await expect(entryButton).toHaveText(en['boot.enter']);
    await entryButton.click();
    await expect(page.locator('#boot-status')).toHaveText(en['boot.status.ready']);

    // The facilitator disclosure, resolved through the i18n layer rather than hardcoded.
    await expect(page.getByRole('region', { name: en['validation.session.title'] })).toContainText(
        en['validation.session.noCollection']
    );

    // Product isolation: neither progress surface is mounted, because no repository was constructed.
    await expect(page.getByRole('region', { name: PROGRESS_REGION })).toHaveCount(0);
    await expect(page.getByRole('article', { name: en['print.ariaLabel'] })).toHaveCount(0);

    // No later case is unlocked, relocked, or exposed — there is no campaign machinery to leak.
    await expect(page.getByRole('link', { name: /Morley|Hafele|Delft/i })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/Morley|Hafele|Delft/i);

    // A real, live session on a fresh state: the routed canvas starts in the Young context phase and
    // advances with the investigation, so the interaction below is not a no-op.
    await expectActiveScene(page, 'Library');
    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await page.getByRole('button', { name: 'Continue to prediction' }).click();
    await expectActiveScene(page, 'Colleagues');

    // Nothing the session did reached the store the normal route owns. Compared once rather than
    // retried: `toPass` would settle on the first matching read and so could step over a write still
    // in flight, which is the failure this assertion exists to catch.
    expect(await readStoredYoungRecord(page)).toBe(seeded);

    // And the normal route still restores exactly what it saved — the second read also catches a late
    // write that the first one would have raced.
    await page.goto('/');
    await expectActiveScene(page, 'Library');
    expect(await readStoredYoungRecord(page)).toBe(seeded);
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

    test('renders the validation disclosure in French without clipping', async ({ page }) => {
        await page.goto('/?mode=validation');

        const disclosure = page.getByRole('region', { name: fr['validation.session.title'] });
        await expect(disclosure.getByRole('heading', { name: fr['validation.session.title'] })).toBeVisible();
        await expect(disclosure).toContainText(fr['validation.session.facilitatorHeld']);
        await expect(disclosure).toContainText(fr['validation.session.noCollection']);
        await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

        // Not a snapshot: longer French copy must wrap inside the boot frame, not overflow it.
        const overflow = await disclosure.evaluate((element) => ({
            horizontal: element.scrollWidth - element.clientWidth,
            vertical: element.scrollHeight - element.clientHeight
        }));
        expect(overflow.horizontal).toBeLessThanOrEqual(1);
        expect(overflow.vertical).toBeLessThanOrEqual(1);

        // The English strings must not survive anywhere in a French session.
        await expect(page.locator('body')).not.toContainText(en['validation.session.facilitatorHeld']);
        await expect(page.locator('body')).not.toContainText(en['validation.session.noCollection']);
    });
});
