import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('keeps inquiry recognition semantic, non-intrusive, and available without audio', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const recognition = page.getByRole('region', { name: 'Inquiry recognition' });
    const updates = recognition.getByRole('status', { name: 'Inquiry recognition updates' });
    const statusElement = await updates.elementHandle();
    if (!statusElement) throw new Error('The inquiry recognition live region should be mounted at startup.');
    await expect(updates).toHaveText('');
    await expect(recognition).toContainText('Optional audio feedback is unavailable for this investigation. All feedback is available as text.');

    const curatedRecord = page.getByRole('region', { name: 'Curated Record' });
    const firstSource = curatedRecord.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' });
    await firstSource.focus();
    await firstSource.click();
    await expect(firstSource).toBeFocused();
    await curatedRecord.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await expect(recognition).toContainText('Source discipline recorded');
    await expect(updates).toHaveText('Source discipline recorded.');
    expect(await statusElement.evaluate((element) => element === document.querySelector('.inquiry-recognition-status'))).toBe(true);

    const observation = page.getByRole('button', { name: 'Record prepared observation' });
    await observation.click();
    await observation.click();
    await expect(recognition).toContainText('Replication recorded');
    await expect(recognition).not.toContainText('score');

    const results = await new AxeBuilder({ page }).include('.inquiry-recognition-panel').analyze();
    expect(results.violations).toEqual([]);
});
