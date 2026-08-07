import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';

/**
 * Axe over the surfaces that still exist (Story 2.12, §Spec fallout).
 *
 * **Reduced, not deleted.** ADR-008 de-scoped accessibility acceptance as a release gate, and the
 * project rule that followed it is explicit: keep the existing a11y specs, add no new parity
 * assertions, and delete none without saying what covers them now. What this file used to scan was
 * eight DOM panels; all eight are gone, and with them the eight `include()` calls. What is left is
 * everything that still ships outside the canvas — the boot frame, the facilitator disclosure, and
 * ADR-007's printable record — and every one of them is scanned here.
 *
 * The results are **supporting evidence only** and must never be recorded as a gate in
 * `docs/validation/young-technical-evidence.md`.
 *
 * The canvas itself is deliberately not scanned. Axe reads the accessibility tree, a `<canvas>` has
 * none, and asserting that an element with no semantics has no semantic violations is the decorative
 * kind of check this project's testing rules single out.
 */
test('has no automated accessibility violations in the surfaces that remain outside the canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: en['boot.enter'] })).toBeVisible();

    const bootShell = await new AxeBuilder({ page }).include('#boot-shell').analyze();
    expect(bootShell.violations).toEqual([]);

    // ADR-007's portable record, mounted on every normal-route session and the one non-Phaser surface
    // the architecture keeps. It is a projection: it dispatches nothing, so there is nothing to drive
    // before scanning it.
    await expect(page.getByRole('article', { name: en['print.ariaLabel'] })).toBeAttached();
    const printRecord = await new AxeBuilder({ page }).include('.case-record-print-view').analyze();
    expect(printRecord.violations).toEqual([]);
});

/**
 * The reduced-motion guard, which survives the a11y de-scope.
 *
 * It is the retained no-flashing / photosensitivity requirement rather than an accessibility-parity
 * assertion, and `project-context.md` names it as a standing requirement in as many words. Asserted
 * where it is observable: the routed scene really starts under `reduce`, so the boot path does not
 * depend on an animation that never runs.
 */
test('boots and routes under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', 'Library');
});

/**
 * Retained as-is under ADR-008: accessibility acceptance is no longer a release gate, so this axe run
 * is **supporting evidence only** and must never be recorded as a gate in
 * `docs/validation/young-technical-evidence.md`. Kept rather than deleted, and given no new
 * a11y-parity assertions.
 *
 * The expected strings are imported rather than restated: the disclosure now resolves them through the
 * i18n layer, and a literal copy here would keep passing against text the app no longer renders.
 */
test('exposes the validation disclosure through semantic text without automated accessibility violations', async ({ page }) => {
    await page.goto('/?mode=validation');

    const disclosure = page.getByRole('region', { name: en['validation.session.title'] });
    await expect(disclosure.getByRole('heading', { name: en['validation.session.title'] })).toBeVisible();
    await expect(disclosure).toContainText(en['validation.session.facilitatorHeld']);
    await expect(disclosure).toContainText(en['validation.session.noCollection']);

    const results = await new AxeBuilder({ page }).include('.validation-session-disclosure').analyze();
    expect(results.violations).toEqual([]);
});
