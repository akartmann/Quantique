import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('has no automated accessibility violations in the boot shell, Curated Record, notebook comparison, or exposed Theory Board', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();

    const results = await new AxeBuilder({ page }).include('#boot-shell').analyze();

    expect(results.violations).toEqual([]);

    const curatedRecord = page.getByRole('region', { name: 'Curated Record' });
    await curatedRecord.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    const curatedRecordResults = await new AxeBuilder({ page }).include('.curated-record').analyze();

    expect(curatedRecordResults.violations).toEqual([]);

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
});
