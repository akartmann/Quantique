import { expect, test } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { artifactAt, clickDesign, waitForBookToOpen } from './canvasHelpers';

/**
 * The gate holds against the canvas, not just against the eye.
 *
 * Covering the surface is **not** sufficient and this asserts the difference. Phaser binds its pointer
 * listeners above the document rather than to the canvas element, so a click on the frame's background
 * is hit-tested against the scene underneath and reaches it: before `game.input.enabled = false`, this
 * exact click took a reference off the reading room's shelf and recorded it, invisibly, from the splash.
 *
 * Written against a *recorded consequence* rather than a repaint, because that is the half that is not
 * self-fulfilling — the reading appears on ADR-007's record or it does not.
 */
test('does not let a click on the boot frame reach the laboratory underneath it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', 'Library');

    const record = page.locator('.case-record-print-view');
    await expect(record).toContainText(en['print.sources.empty']);

    // The coordinate a spec would use to take the second reference off the shelf, issued while the
    // frame is still up.
    await clickDesign(page, artifactAt(1));
    await waitForBookToOpen(page);

    await expect(record).toContainText(en['print.sources.empty']);

    // And the same click works the moment the gate is passed, so this proves suppression rather than a
    // coordinate that was never going to hit anything.
    await page.getByRole('button', { name: en['boot.enter'] }).click();
    await clickDesign(page, artifactAt(1));
    await waitForBookToOpen(page);
    await expect(record).not.toContainText(en['print.sources.empty']);
});

/**
 * The entry gate (Story 2.12, AC10).
 *
 * Until this story the boot frame was a permanent column beside the canvas, and its button only wrote a
 * status string — the game booted on load regardless. A player therefore read "open the laboratory to
 * begin" alongside a laboratory that was already running, and the DOM kept a third of the viewport
 * forever, which is the residue that made the panel retirement look half-finished on screen.
 *
 * Proved here rather than in a unit test because this project runs no DOM unit environment: `tests/unit`
 * covers pure functions and every DOM behaviour is asserted against the real document. Adding `jsdom`
 * for one gate would be a new dependency, which this story's scope rules out.
 */
test('shows the boot frame first and reveals the laboratory only on entry', async ({ page }) => {
    await page.goto('/');

    const frame = page.locator('#boot-shell');
    const entryButton = page.getByRole('button', { name: en['boot.enter'] });
    await expect(entryButton).toBeVisible();

    /**
     * Before entry the frame *covers* the canvas, which is a claim about occlusion rather than about
     * CSS. `toBeHidden` would not prove it — Playwright reads layout and paint, not what is on top, so
     * a canvas underneath an opaque overlay is "visible" to it, and the assertion passed against the
     * old side-by-side layout too. Hit-testing the centre of the screen is the question actually being
     * asked: what would a click there reach?
     */
    await expect(frame).toBeVisible();
    const atCentre = () => page.evaluate(() => {
        const element = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        return element?.closest('#boot-shell, #game-container')?.id ?? null;
    });
    expect(await atCentre()).toBe('boot-shell');

    await entryButton.click();
    expect(await atCentre()).toBe('game-container');

    // And after it, the DOM frame is gone and the canvas has the viewport to itself.
    await expect(frame).toBeHidden();
    await expect(page.locator('#game-container canvas')).toBeVisible();

    /**
     * The *container* is measured, not the canvas. `Scale.FIT` letterboxes the 4:3 design surface into
     * whatever box it is given, so at 1280×720 the canvas is 960 wide by arithmetic and asserting it
     * fills the width would fail on a correct layout. What this story changed is how much room the
     * canvas is given, and that is the container: it used to be one cell of a two-column grid.
     */
    const viewport = page.viewportSize()!;
    const box = (await page.locator('#game-container').boundingBox())!;
    expect(box).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height });
});

/**
 * ADR-007's record is a *printable* one, and printable is not the same as displayed.
 *
 * It rendered on screen until Story 2.12 because nothing ever hid it — the `@media print` block existed
 * only to hide everything *else*. It stays in the document and in the accessibility tree on purpose:
 * `#game-container` is `aria-hidden="true"` and canvas a11y projection is still an open deferred item,
 * so this record is currently the only thing a screen reader can read about the investigation. Hiding it
 * with `display: none` would have taken it out of that tree as well as off the screen.
 */
test('keeps the printable record out of sight but in the document and the accessibility tree', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: en['boot.enter'] }).click();

    const record = page.getByRole('article', { name: en['print.ariaLabel'] });
    // In the accessibility tree: `getByRole` resolves it at all, which `display: none` would prevent.
    await expect(record).toBeAttached();
    // But off the screen: clipped to a pixel rather than removed.
    const box = await record.boundingBox();
    expect(box === null || (box.width <= 2 && box.height <= 2)).toBe(true);
});

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
    await expect(page.locator('#boot-status')).toHaveText('Laboratory shell ready.');
});

/**
 * AC2: a missing required root **fails loudly**.
 *
 * The guard this replaces was fifteen `querySelector` results in one `if` that `return`ed silently, and
 * `deferred-work.md` has carried it since the 2.4 review. It mattered less when eleven panels stood
 * behind it; with those deleted there is no fallback surface at all, so a silent return would leave the
 * player on `index.html`'s pre-hydration placeholder markup — which looks like a slow load rather than a
 * broken build, forever.
 *
 * The document is rewritten in flight rather than a root removed afterwards: `main.ts` runs on
 * `DOMContentLoaded`, so a script that deleted the element after boot would be testing teardown instead
 * of the guard.
 */
test('says so when the document is missing a required root', async ({ page }) => {
    await page.route('**/', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        await route.fulfill({
            response,
            body: body.replace('<div id="print-record"></div>', '')
        });
    });

    await page.goto('/');

    // A message the player can read, in the region that is guaranteed to be in the document.
    await expect(page.locator('#boot-status')).toHaveText('This page did not load correctly. Please reload it.');
    // And the game never started, which is what "returned silently" used to hide.
    await expect(page.locator('#game-container')).not.toHaveAttribute('data-active-scene', /.+/);
});
