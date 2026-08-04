import { expect, test } from '@playwright/test';

test('makes the semantic laboratory entry interaction ready within five seconds', async ({ page }) => {
    const startedAt = Date.now();

    await page.goto('/');
    const entryButton = page.getByRole('button', { name: 'Enter laboratory' });
    await expect(entryButton).toBeVisible();
    expect(Date.now() - startedAt).toBeLessThan(5_000);

    await entryButton.click();
    await expect(page.getByRole('status')).toHaveText('Laboratory shell ready.');
});
