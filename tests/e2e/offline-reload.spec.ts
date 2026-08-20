import { expect, test } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import {
    PROGRESS_DATABASE_NAME,
    PROGRESS_DATABASE_VERSION,
    PROGRESS_STORE_NAME
} from '../../src/adapters/persistence/IndexedDbRepository';
import {
    WALK_TO_DEBRIEF_COST_MS,
    gotoCase,
    recordedComparisonNotes,
    recordedObservations,
    walkToTheBoard
} from './canvasHelpers';

/** What the record says the prediction is, read from ADR-007's retained print view. */
const recordedPrediction = (page: import('@playwright/test').Page) =>
    page.getByRole('article', { name: en['print.ariaLabel'] })
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: en['print.prediction.heading'], exact: true }) })
        .getByRole('definition');

const THEA_PORTRAIT_PATH = '/cases/young-interference/assets/characters/thea-young.png';

/** Waits on the serialized autosave itself instead of guessing how long IndexedDB needs. */
const waitForSavedBoardProgress = (page: import('@playwright/test').Page) => page.waitForFunction(async ({ databaseName, databaseVersion, storeName }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, databaseVersion);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    try {
        const record = await new Promise<{ phase?: unknown; comparison?: { notes?: unknown[] } } | undefined>((resolve, reject) => {
            const request = database.transaction(storeName, 'readonly').objectStore(storeName).get('young-interference');
            request.onsuccess = () => resolve(request.result as { phase?: unknown; comparison?: { notes?: unknown[] } } | undefined);
            request.onerror = () => reject(request.error);
        });
        return record?.phase === 'synthesis' && record.comparison?.notes?.length === 1;
    } finally {
        database.close();
    }
}, {
    databaseName: PROGRESS_DATABASE_NAME,
    databaseVersion: PROGRESS_DATABASE_VERSION,
    storeName: PROGRESS_STORE_NAME
});

/**
 * AC2's release gate: the interface language is right after an offline reload, not just online.
 *
 * The language comes from the browser, so Playwright's `locale` context option is the whole input —
 * it is what `navigator.language` reports. Kept as its own test, with its own French context, so the
 * locale gate is verified independently of the progress-restore flow below, which depends on the
 * notebook-recording path tracked in `deferred-work.md`.
 */
test.describe('French browser', () => {
    test.use({ locale: 'fr-FR' });

    test('boots in French and stays French after an offline reload', async ({ page, context }) => {
        await page.goto('/');
        await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
        // No in-game control: the browser is the only input, so there is nothing to click or store.
        await expect(page.getByTestId('language-selector')).toHaveCount(0);

        // `navigator.serviceWorker.ready` is a Promise, so it must be awaited inside the predicate —
        // returning it directly makes `waitForFunction` resolve on its first poll, because every
        // Promise is truthy. The worker caches per response as it fetches, so the warm-up has to
        // finish before the network is cut or this gate races on a slow machine.
        await page.waitForFunction(async () => {
            await navigator.serviceWorker.ready;
            return true;
        });
        await page.reload();
        await expect(page.getByRole('button', { name: fr['boot.enter'] })).toBeVisible();

        await context.setOffline(true);
        await page.reload();

        await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
        // The routed canvas really started offline, which is what the retired French panel heading
        // used to stand in for. `data-active-scene` is the app's own hook and the only honest one:
        // canvas text cannot be read from here.
        await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', 'Library');
        await page.getByRole('button', { name: fr['boot.enter'] }).click();
        await expect(page.locator('#boot-status')).toHaveText(fr['boot.status.ready']);
    });
});

// Declared rather than inherited: without it this asserts against whatever locale the Playwright
// project or the CI runner happens to supply. The two cases below are also deliberately separate —
// an English browser *matching* and an unsupported language *falling back* are different behaviours
// that both end at `en`, and one assertion cannot tell them apart.
test.describe('browser-locale resolution at boot', () => {
    test.use({ locale: 'en-GB' });

    test('boots an English browser in English', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByRole('heading', { name: en['boot.title'] })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
});

test.describe('unsupported browser language', () => {
    test.use({ locale: 'de-DE' });

    test('falls back to English rather than rendering a raw locale', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByRole('heading', { name: en['boot.title'] })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
});

/**
 * **The offline release gate.** Progress recorded on the canvas survives a reload with no network.
 *
 * This is the spec Story 2.12 was most likely to break, and the reason `AC3` exists: the autosave was
 * `CaseProgressPanel`'s `store.subscribe`, and the panel is deleted. `attachAutosave` holds that
 * subscription now — same selector, same repository, same `pendingWrite` serialization — and `main.ts`
 * wires it inside the `if (repository)` branch that already governed the panel.
 *
 * **There is no "Save progress" click any more, and that is the point.** The manual save went with the
 * panel; what has to survive is the *automatic* write on every state change. So the walk below saves
 * nothing explicitly, and the restore afterwards is proof the subscription is wired — if it were not,
 * nothing would have been written and the reload would come back empty.
 *
 * What is observed is the retained printable record (ADR-007), which is the only DOM projection of the
 * store that still exists. It is a shipped feature, not an observability hook.
 */
test('restores canvas-recorded progress after an offline reload, with no manual save', async ({ page, context }) => {
    test.setTimeout(30_000 + WALK_TO_DEBRIEF_COST_MS);

    // Named, not `/`: the warm-up has to load the case this test then walks, because it waits on
    // *Thea's* portrait — a Young asset a Morley–Miller boot never fetches (Story 4.1 flipped the
    // campaign default). The three locale assertions above deliberately stay at the root.
    await gotoCase(page);
    await expect(page.getByRole('button', { name: en['boot.enter'] })).toBeVisible();
    await page.waitForFunction(async () => {
        await navigator.serviceWorker.ready;
        return navigator.serviceWorker.controller !== null;
    });

    // The first load registers the worker. Reload online once it controls this page, then observe the
    // real preloader response for an authored portrait before taking the network away.
    const onlinePortraitResponse = page.waitForResponse((response) =>
        new URL(response.url()).pathname === THEA_PORTRAIT_PATH && response.status() === 200
    );
    await page.reload();
    await onlinePortraitResponse;
    await expect(page.getByRole('button', { name: en['boot.enter'] })).toBeVisible();

    // Two observations, a comparison note, and a prediction — all recorded with canvas clicks only.
    await walkToTheBoard(page);
    await expect(recordedObservations(page)).toHaveCount(2);
    const savedPrediction = await recordedPrediction(page).textContent();
    expect(savedPrediction).toBeTruthy();

    // The write is serialized through a promise chain rather than awaited by a canvas dispatch. Poll
    // the persisted record's consequence rather than adding a load-sensitive sleep before offline.
    await waitForSavedBoardProgress(page);

    await context.setOffline(true);
    const offlinePortraitResponse = page.waitForResponse((response) =>
        new URL(response.url()).pathname === THEA_PORTRAIT_PATH && response.status() === 200
    );
    await page.reload();
    const warmedPortraitResponse = await offlinePortraitResponse;
    expect(warmedPortraitResponse.fromServiceWorker()).toBe(true);

    const entryButton = page.getByRole('button', { name: en['boot.enter'] });
    await expect(entryButton).toBeVisible();
    await entryButton.click();
    await expect(page.locator('#boot-status')).toHaveText(en['boot.status.ready']);

    // The restored session, offline: the observations, the prediction, and the comparison note the
    // walk saved are all back, and the router put the player in the phase they left.
    await expect(recordedObservations(page)).toHaveCount(2);
    await expect(recordedPrediction(page)).toHaveText(savedPrediction!);
    await expect(recordedComparisonNotes(page)).toHaveCount(1);
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', 'TheoryBoard');
});

test('loads the cached validation route after an online warm-up without progress controls', async ({ page, context }) => {
    const disclosure = page.getByRole('region', { name: en['validation.session.title'] });

    await page.goto('/?mode=validation');
    await expect(page.getByTestId('enter-laboratory')).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.ready);
    await page.reload();
    // The worker caches as it fetches, so let the warm-up finish loading the case content
    // (case.json and asset-manifest.json) before the network is cut.
    await expect(disclosure).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    await expect(disclosure).toBeVisible();
    await expect(page.getByTestId('enter-laboratory')).toBeVisible();
    // The validation route builds no repository, so it wires no autosave, mounts no printable record,
    // and offers no export or import — offline included. The print view is the assertion that still
    // means something now that the progress panel it stood beside is deleted.
    await expect(page.getByRole('article', { name: en['print.ariaLabel'] })).toHaveCount(0);
});
