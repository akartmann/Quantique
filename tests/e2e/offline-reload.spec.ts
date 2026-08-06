import { expect, test } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';

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
        await expect(page.getByRole('region', { name: fr['curatedRecord.heading'] })).toBeVisible();
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

test('restores saved progress and decision history after an offline reload', async ({ page, context }) => {

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();

    await page.waitForFunction(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();

    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    const contextPanel = page.getByRole('region', { name: 'Young context and prediction' });
    await contextPanel.getByRole('button', { name: 'Continue to prediction' }).click();
    await contextPanel.getByLabel('Tentative prediction').fill('A stable pattern may appear.');
    await contextPanel.getByRole('button', { name: 'Record a prediction' }).click();
    await contextPanel.getByRole('button', { name: 'Continue to experimentation' }).click();
    const recordObservation = page.getByRole('button', { name: 'Record prepared observation' });
    await recordObservation.click();
    await recordObservation.click();
    const board = page.getByRole('region', { name: 'Theory board' });
    await board.getByRole('checkbox', { name: 'Select Observation 1 as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Observation 2 as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Thomas Young’s 1801 lecture record as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Opticks reference as conclusion support' }).check();
    await board.getByLabel('Conclusion', { exact: true }).fill('The prepared observations support a bounded conclusion.');
    await board.getByLabel('Limitation or alternative explanation').fill('The prepared evidence does not resolve every alternative explanation.');
    await board.getByRole('button', { name: 'Continue investigation to synthesis' }).click();
    await board.getByRole('button', { name: 'Request review' }).click();
    const peerReview = page.getByRole('region', { name: 'Peer review' });
    await peerReview.getByRole('button', { name: 'Request peer feedback' }).click();
    await peerReview.getByRole('button', { name: 'Save reviewed revision' }).click();
    const progress = page.getByRole('region', { name: 'Save, export, import, and print' });
    await progress.getByRole('button', { name: 'Save progress' }).click();
    await expect(progress.getByRole('status', { name: 'Progress status' })).toHaveText('Progress saved on this device.');

    await context.setOffline(true);
    await page.reload();

    const entryButton = page.getByRole('button', { name: 'Enter laboratory' });
    await expect(entryButton).toBeVisible();
    await entryButton.click();
    await expect(page.locator('#boot-status')).toHaveText('Laboratory shell ready.');
    await expect(page.getByRole('region', { name: 'Measurement notebook' }).getByText('Observed result')).toHaveCount(2);
    await expect(page.getByRole('region', { name: 'Young context and prediction' }).getByLabel('Tentative prediction')).toHaveValue('A stable pattern may appear.');
    await expect(page.getByRole('region', { name: 'Decision history' }).getByRole('heading', { name: 'Version 1' })).toBeVisible();
    const recognition = page.getByRole('region', { name: 'Inquiry recognition' });
    await expect(recognition).toContainText('Source discipline recorded');
    await expect(recognition).toContainText('Replication recorded');
    await expect(recognition).toContainText('Calibrated conclusion recorded');
    await page.getByRole('region', { name: 'Curated Record' }).getByRole('button', { name: 'Read the lecture record' }).click();
    const reader = page.getByRole('region', { name: 'Young context and prediction' }).getByRole('article', { name: 'Read the lecture record' });
    await expect(reader.locator('.contextual-text-section')).toHaveCount(2);
    await expect(reader.getByRole('status')).toHaveText('Book spread 1 of 19.');
    await reader.getByRole('button', { name: 'Next page' }).click();
    await expect(reader.getByRole('status')).toHaveText('Book spread 2 of 19.');
    await reader.getByRole('button', { name: 'Close book' }).click();

    await page.getByRole('region', { name: 'Curated Record' }).getByRole('button', { name: 'Read the Opticks reference' }).click();
    const opticksReader = page.getByRole('region', { name: 'Young context and prediction' }).getByRole('article', { name: 'Read the Opticks reference' });
    await expect(opticksReader.locator('.contextual-source-pages')).toHaveText(['Source page 371.', 'Source page 372.']);
    await expect(opticksReader.getByRole('status')).toHaveText('Book spread 1 of 3.');
    await opticksReader.getByRole('button', { name: 'Next page' }).click();
    await expect(opticksReader.getByRole('status')).toHaveText('Book spread 2 of 3.');
});

test('loads the cached validation route after an online warm-up without progress controls', async ({ page, context }) => {
    await page.goto('/?mode=validation');
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.ready);
    await page.reload();
    // The worker caches as it fetches, so let the warm-up finish loading the case content
    // (case.json and asset-manifest.json) before the network is cut.
    await expect(page.getByRole('region', { name: 'Young validation session' })).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('region', { name: 'Young validation session' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Save, export, import, and print' })).toHaveCount(0);
});
