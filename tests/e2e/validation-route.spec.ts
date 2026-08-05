import { expect, test } from '@playwright/test';

test('opens an isolated Young validation route without changing normal learner progress', async ({ page }) => {
    await page.goto('/');
    const normalRecord = page.getByRole('region', { name: 'Curated Record' });
    await normalRecord.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    const normalProgress = page.getByRole('region', { name: 'Save, export, import, and print' });
    await normalProgress.getByRole('button', { name: 'Save progress' }).click();
    await expect(normalProgress.getByRole('status', { name: 'Progress status' })).toHaveText('Progress saved on this device.');

    await page.goto('/?mode=validation');

    const entryButton = page.getByRole('button', { name: 'Enter laboratory' });
    await expect(entryButton).toBeVisible();
    await entryButton.click();
    await expect(page.locator('#boot-status')).toHaveText('Laboratory shell ready.');
    await expect(page.getByRole('region', { name: 'Young validation session' })).toContainText(
        'The application does not collect session responses.'
    );
    await expect(page.getByRole('region', { name: 'Save, export, import, and print' })).toHaveCount(0);
    await expect(page.getByRole('article', { name: 'Printable investigation record' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Morley|Hafele|Delft/i })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/Morley|Hafele|Delft/i);

    const validationRecord = page.getByRole('region', { name: 'Curated Record' });
    await expect(validationRecord.getByText('Inspection recorded')).toHaveCount(0);
    await validationRecord.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await expect(validationRecord.getByText('Inspection recorded')).toHaveCount(1);

    await page.goto('/');
    await expect(normalRecord.getByText('Inspection recorded')).toHaveCount(1);
    await expect(normalRecord.getByText('Thomas Young’s 1801 lecture record').locator('..')).toContainText('Inspection recorded');
});
