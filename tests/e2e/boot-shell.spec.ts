import { expect, test } from '@playwright/test';

test('makes the semantic laboratory entry interaction ready within five seconds', async ({ page, browserName }) => {
    await page.goto('/');

    const startedAt = Date.now();

    if (browserName === 'chromium') {
        await page.waitForFunction(() => navigator.serviceWorker.ready);
        await page.reload();
        await page.context().setOffline(true);
    }

    await page.reload();

    const entryButton = page.getByRole('button', { name: 'Enter laboratory' });
    await expect(entryButton).toBeVisible();
    expect(Date.now() - startedAt).toBeLessThan(5_000);

    await entryButton.click();
    await expect(page.getByRole('status')).toHaveText('Laboratory shell ready.');
});
