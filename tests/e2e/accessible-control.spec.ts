import { expect, test } from '@playwright/test';

test('offers the authored slit-spacing control outside the canvas and announces normalized keyboard changes', async ({ page }) => {
    await page.goto('/');

    const control = page.getByLabel('Slit spacing (mm)');
    await expect(control).toBeVisible();
    await expect(control).toHaveAttribute('min', '0.1');
    await expect(control).toHaveAttribute('max', '0.5');
    await expect(control).toHaveAttribute('step', '0.05');
    await expect(page.getByText('Valid range: 0.1–0.5 mm, in 0.05 mm steps.')).toBeVisible();

    await control.focus();
    await control.press('ArrowUp');
    await expect(control).toHaveValue('0.3');
    await expect(page.locator('#slitSpacingMm-readout')).toHaveText('0.30 mm');
    await expect(page.locator('#apparatus-status')).toHaveText('Slit spacing set to 0.30 mm.');

    await control.fill('0.23');
    await control.press('Enter');
    await expect(control).toHaveValue('0.25');
    await expect(page.locator('#slitSpacingMm-readout')).toHaveText('0.25 mm');
    await expect(page.locator('#apparatus-status')).toHaveText('Slit spacing set to 0.25 mm.');
});

test('projects Phaser pointer and touch changes through the same semantic readout', async ({ page, browser }) => {
    await page.goto('/');

    const control = page.getByLabel('Slit spacing (mm)');
    await expect(control).toHaveValue('0.25');

    const canvas = page.locator('#game-container canvas');
    await expect(canvas).toBeVisible();
    const bounds = await canvas.boundingBox();
    if (!bounds) {
        throw new Error('The laboratory surface did not render.');
    }

    const plusX = bounds.x + (450 / 1024) * bounds.width;
    const plusY = bounds.y + (180 / 768) * bounds.height;
    await page.mouse.click(plusX, plusY);
    await expect(control).toHaveValue('0.3');

    const touchContext = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 720 } });
    const touchPage = await touchContext.newPage();
    await touchPage.goto('/');

    const touchControl = touchPage.getByLabel('Slit spacing (mm)');
    const touchCanvas = touchPage.locator('#game-container canvas');
    await expect(touchCanvas).toBeVisible();
    const touchBounds = await touchCanvas.boundingBox();
    if (!touchBounds) {
        throw new Error('The touch laboratory surface did not render.');
    }

    await touchPage.touchscreen.tap(
        touchBounds.x + (450 / 1024) * touchBounds.width,
        touchBounds.y + (180 / 768) * touchBounds.height
    );
    await expect(touchControl).toHaveValue('0.3');
    await expect(touchPage.locator('#slitSpacingMm-readout')).toHaveText('0.30 mm');
    await touchContext.close();
});
