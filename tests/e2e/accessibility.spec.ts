import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('has no automated accessibility violations in the boot shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();

    const results = await new AxeBuilder({ page }).include('#boot-shell').analyze();

    expect(results.violations).toEqual([]);
});
