import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';

test('has no automated accessibility violations in the boot shell, Curated Record, notebook comparison, or exposed Theory Board', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();

    const results = await new AxeBuilder({ page }).include('#boot-shell').analyze();

    expect(results.violations).toEqual([]);

    const curatedRecord = page.getByRole('region', { name: 'Curated Record' });
    await curatedRecord.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    const curatedRecordResults = await new AxeBuilder({ page }).include('.curated-record').analyze();

    expect(curatedRecordResults.violations).toEqual([]);

    const contextPredictionResults = await new AxeBuilder({ page }).include('.case-context-prediction').analyze();

    expect(contextPredictionResults.violations).toEqual([]);

    const recordObservation = page.getByRole('button', { name: 'Record prepared observation' });
    await recordObservation.click();
    await recordObservation.click();
    await page.getByRole('checkbox', { name: 'Select Observation 1 for comparison' }).check();
    await page.getByRole('checkbox', { name: 'Select Observation 2 for comparison' }).check();

    const notebookResults = await new AxeBuilder({ page })
        .include('.measurement-notebook')
        .include('.run-comparison')
        .analyze();

    expect(notebookResults.violations).toEqual([]);

    await curatedRecord.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    const theoryBoardResults = await new AxeBuilder({ page }).include('.theory-board').analyze();

    expect(theoryBoardResults.violations).toEqual([]);

    const reviewSurfaceResults = await new AxeBuilder({ page }).include('.review-panel').analyze();

    expect(reviewSurfaceResults.violations).toEqual([]);

    const recognitionResults = await new AxeBuilder({ page }).include('.inquiry-recognition-panel').analyze();

    expect(recognitionResults.violations).toEqual([]);

    const portabilityResults = await new AxeBuilder({ page })
        .include('.case-progress-panel')
        .include('.case-record-print-view')
        .analyze();

    expect(portabilityResults.violations).toEqual([]);
});

/**
 * Retained as-is under ADR-008: accessibility acceptance is no longer a release gate, so this axe run
 * is **supporting evidence only** and must never be recorded as a gate in
 * `docs/validation/young-technical-evidence.md`. Kept rather than deleted, and given no new
 * a11y-parity assertions.
 *
 * The expected strings are imported rather than restated: the disclosure now resolves them through the
 * i18n layer, and a literal copy here would keep passing against text the app no longer renders.
 */
test('exposes the validation disclosure through semantic text without automated accessibility violations', async ({ page }) => {
    await page.goto('/?mode=validation');

    const disclosure = page.getByRole('region', { name: en['validation.session.title'] });
    await expect(disclosure.getByRole('heading', { name: en['validation.session.title'] })).toBeVisible();
    await expect(disclosure).toContainText(en['validation.session.facilitatorHeld']);
    await expect(disclosure).toContainText(en['validation.session.noCollection']);

    const results = await new AxeBuilder({ page }).include('.validation-session-disclosure').analyze();
    expect(results.violations).toEqual([]);
});
