import { expect, test } from '@playwright/test';
import { enterYoungExperiment } from './youngExperimentHelpers';

test('records authoritative Young observations, compares two runs, and retains their pair note', async ({ page }) => {
    await page.goto('/');
    await enterYoungExperiment(page);
    const run = page.getByRole('button', { name: 'Run experiment' });
    await run.click();
    await page.getByLabel('Screen distance (m)').press('ArrowUp');
    await run.click();
    const notebook = page.getByRole('region', { name: 'Measurement notebook' });
    await expect(notebook.getByText('Fringe spacing: 4.4 mm')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Select Observation 1 for comparison' }).check();
    await page.getByRole('checkbox', { name: 'Select Observation 2 for comparison' }).check();
    await page.getByLabel('Comparison note').fill('A longer screen distance produced a wider recorded fringe spacing.');
    await page.getByRole('button', { name: 'Save comparison note' }).click();
    await expect(notebook).toContainText('Comparison note saved.');
});
