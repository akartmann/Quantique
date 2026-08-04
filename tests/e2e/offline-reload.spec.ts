import { expect, test } from '@playwright/test';

test('keeps the cached production boot shell usable after an offline reload', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Offline reload is covered by the Chromium production-cache test.');

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();

    await page.waitForFunction(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    const entryButton = page.getByRole('button', { name: 'Enter laboratory' });
    await expect(entryButton).toBeVisible();
    await entryButton.click();
    await expect(page.getByRole('status')).toHaveText('Laboratory shell ready.');
});
