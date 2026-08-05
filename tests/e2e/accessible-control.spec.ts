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

test('keeps the Phaser laboratory surface proportionate beside the populated Curated Record', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    const curatedRecord = page.getByRole('region', { name: 'Curated Record' });
    await expect(curatedRecord.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' })).toBeVisible();

    const canvas = page.locator('#game-container canvas');
    await expect(canvas).toBeVisible();
    const [recordBounds, canvasBounds] = await Promise.all([curatedRecord.boundingBox(), canvas.boundingBox()]);
    if (!recordBounds || !canvasBounds) {
        throw new Error('The laboratory surface did not render.');
    }

    expect(recordBounds.height).toBeGreaterThan(canvasBounds.height);
    expect(canvasBounds.height).toBeLessThanOrEqual(720);
    expect(canvasBounds.width / canvasBounds.height).toBeCloseTo(1024 / 768, 2);

    await page.mouse.wheel(0, 900);
    await expect(canvas).toBeVisible();
    const stickyBounds = await page.locator('#game-container').boundingBox();
    expect(stickyBounds?.y).toBeCloseTo(0, 0);
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

    const plusX = bounds.x + (540 / 1024) * bounds.width;
    const plusY = bounds.y + (603 / 768) * bounds.height;
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
        touchBounds.x + (540 / 1024) * touchBounds.width,
        touchBounds.y + (603 / 768) * touchBounds.height
    );
    await expect(touchControl).toHaveValue('0.3');
    await expect(touchPage.locator('#slitSpacingMm-readout')).toHaveText('0.30 mm');
    await touchContext.close();
});

test('keeps laboratory controls read-only on phones', async ({ browser }) => {
    const phoneContext = await browser.newContext({
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 }
    });
    const phonePage = await phoneContext.newPage();
    await phonePage.goto('/');

    const control = phonePage.getByLabel('Slit spacing (mm)');
    await expect(control).toBeDisabled();
    await expect(phonePage.locator('#apparatus-status')).toHaveText('Laboratory controls are read-only on phones.');

    const canvas = phonePage.locator('#game-container canvas');
    await expect(canvas).toBeVisible();
    const bounds = await canvas.boundingBox();
    if (!bounds) {
        throw new Error('The phone laboratory surface did not render.');
    }

    await phonePage.touchscreen.tap(
        bounds.x + (450 / 1024) * bounds.width,
        bounds.y + (180 / 768) * bounds.height
    );
    await expect(control).toHaveValue('0.25');
    await phoneContext.close();
});
