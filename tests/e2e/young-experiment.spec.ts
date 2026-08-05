import { expect, test } from '@playwright/test';

const enterExperiment = async (page: import('@playwright/test').Page): Promise<void> => {
    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await page.getByRole('button', { name: 'Continue to prediction' }).click();
    await page.getByLabel('Tentative prediction').fill('A longer screen distance should spread the fringes apart.');
    await page.getByRole('button', { name: 'Record a prediction' }).click();
    await page.getByRole('button', { name: 'Continue to experimentation' }).click();
};

test('runs the bounded Young experiment through its semantic controls and preserves its scientific record', async ({ page }) => {
    await page.goto('/');
    const slitSpacing = page.getByLabel('Slit spacing (mm)');
    const screenDistance = page.getByLabel('Screen distance (m)');
    await expect(slitSpacing).toHaveAttribute('step', '0.05');
    await expect(screenDistance).toHaveAttribute('step', '0.25');
    await expect(page.getByRole('button', { name: 'Run experiment' })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: 'Run experiment' }).click();
    await expect(page.locator('#apparatus-status')).toHaveText('Enter the experiment phase before running the apparatus.');
    await expect(page.getByRole('img', { name: /Run an experiment to record/ })).toBeVisible();

    await enterExperiment(page);
    await screenDistance.focus();
    await screenDistance.press('ArrowUp');
    await expect(screenDistance).toHaveValue('2.25');
    await page.getByRole('button', { name: 'Run experiment' }).click();
    await expect(page.locator('#apparatus-status')).toContainText('Experiment recorded: 4.95 mm fringe spacing.');
    await expect(slitSpacing).toBeEnabled();
    await expect(screenDistance).toBeEnabled();
    await expect(page.getByRole('img', { name: /Latest recorded pattern: 4.95 mm/ })).toHaveClass(/is-running/);
    await screenDistance.press('ArrowDown');
    await expect(screenDistance).toHaveValue('2');
    await expect(page.getByRole('region', { name: 'Measurement notebook' }).getByText('Fringe spacing: 4.95 mm')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Measurement notebook' }).getByText('Wavelength', { exact: true })).toBeVisible();
    await expect(page.getByText('Optional comparison unlocks after 1 more saved fixed-550-nm run.')).toBeVisible();

    await slitSpacing.fill('0.2'); await slitSpacing.press('Enter');
    await page.getByRole('button', { name: 'Run experiment' }).click();
    const wavelength = page.getByLabel('Optional wavelength comparison (nm)');
    await expect(wavelength).toBeEnabled();
    await wavelength.selectOption('650');
    await page.getByRole('button', { name: 'Run experiment' }).click();
    await expect(page.getByRole('region', { name: 'Measurement notebook' }).getByText('650 nm (advanced path)')).toBeVisible();

    await page.getByRole('button', { name: 'Reset apparatus' }).click();
    await expect(slitSpacing).toHaveValue('0.25');
    await expect(screenDistance).toHaveValue('2');
    await expect(page.getByRole('heading', { name: 'Observation 3' })).toBeVisible();
});
