import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

// From `apparatusGeometry`, which imports Phaser not at all — the module exists so a spec can derive
// a click target instead of restating one (Story 2.10).
import { stepAffordanceCentre } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';
import { enterYoungExperiment } from './youngExperimentHelpers';

/** Which slot the slit-spacing instrument stands in, from the authored control order. */
const SLIT_SPACING_SLOT = (JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { apparatus: { primaryControls: { id: string }[] } })
    .apparatus.primaryControls.findIndex(({ id }) => id === 'slitSpacingMm');

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

// Named for the routed surface rather than the laboratory: every assertion here is about the
// game-level canvas (aspect ratio, sticky position), which is phase-independent. Since Story 1.10 the
// laboratory scene only runs in the experiment phase, so a laboratory-specific claim would be false —
// at `/` the router has activated the Library scene on this same canvas.
test('keeps the routed Phaser surface proportionate beside the populated Curated Record', async ({ page }) => {
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
    // The apparatus lives in the routed laboratory scene, which the SceneRouter activates in the
    // experiment phase.
    await enterYoungExperiment(page);

    const control = page.getByLabel('Slit spacing (mm)');
    await expect(control).toHaveValue('0.25');

    const canvas = page.locator('#game-container canvas');
    await expect(canvas).toBeVisible();
    const bounds = await canvas.boundingBox();
    if (!bounds) {
        throw new Error('The laboratory surface did not render.');
    }

    // Derived from the module that places the control (Story 2.10). It was `(540, 603)` against the
    // retired `+` text button, with a private `1024`/`768` pair beside it — the coordinate stopped
    // describing anything the day the bench grew instruments. What this spec is *about* is unchanged:
    // a canvas gesture reaching the store, observed through whatever surface is still mounted.
    const step = stepAffordanceCentre(SLIT_SPACING_SLOT, 1);
    await page.mouse.click(
        bounds.x + (step.x / DESIGN_WIDTH) * bounds.width,
        bounds.y + (step.y / DESIGN_HEIGHT) * bounds.height
    );
    await expect(control).toHaveValue('0.3');

    const touchContext = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 720 } });
    const touchPage = await touchContext.newPage();
    await touchPage.goto('/');
    await enterYoungExperiment(touchPage);

    const touchControl = touchPage.getByLabel('Slit spacing (mm)');
    const touchCanvas = touchPage.locator('#game-container canvas');
    await expect(touchCanvas).toBeVisible();
    const touchBounds = await touchCanvas.boundingBox();
    if (!touchBounds) {
        throw new Error('The touch laboratory surface did not render.');
    }

    await touchPage.touchscreen.tap(
        touchBounds.x + (step.x / DESIGN_WIDTH) * touchBounds.width,
        touchBounds.y + (step.y / DESIGN_HEIGHT) * touchBounds.height
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
    // Reach the laboratory scene so the canvas tap below has a live apparatus to reject.
    await enterYoungExperiment(phonePage);

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
