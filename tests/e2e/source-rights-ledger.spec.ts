import { expect, test, type Page } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';

/**
 * AC6: a reviewer opens `?ledger=1` and reads the ledger, for either shipped case.
 *
 * Two things are asserted that a unit test cannot see. The first is that the ledger is **visible** — the
 * boot frame and the canvas are both `position: fixed; inset: 0`, the frame at `z-index: 2`, so a ledger
 * mounted into normal flow beneath them is a blank screen with an "Enter laboratory" button on top of it.
 * That is precisely the defect class the 3.2 review found on the prototype's bench, where a renderer
 * resolved onto an empty surface behind a live animation and 1334 green tests could not see it. Asserted
 * with `toBeVisible`, which is a layout question, not a DOM-presence one.
 *
 * The second is that **no Phaser game starts**. The route returns before `StartGame`, so there is no
 * canvas and no `data-active-scene` — and that absence is the isolation, not a side effect of it.
 *
 * This route is deliberately **not** added to `tests/e2e/accessibility.spec.ts` (ADR-008). The markup is
 * semantic regardless — real `<table>` elements with `<th scope="col">` headers — because that costs
 * nothing when it is written correctly the first time.
 */

/** The row the ledger renders for one subject ID, in whichever of its four tables holds it. */
const ledgerRow = (page: Page, subject: string) => page.locator(`.source-rights-ledger tr[data-subject="${subject}"]`);

const openLedger = async (page: Page, query: string): Promise<void> => {
    await page.goto(query);
    await expect(page.locator('.source-rights-ledger')).toBeVisible();
};

test('opens the Young ledger on ?ledger=1, blocked and with every blocking row named', async ({ page }) => {
    await openLedger(page, '/?ledger=1');

    // Visible, not merely present: the two fixed layers above it must have come down.
    const banner = page.getByTestId('ledger-decision');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-decision', 'blocked');
    await expect(banner).toHaveText(en['ledger.decision.blocked']);

    // The honest answer today, and the correct one. The banner is not the assertion — the named rows are:
    // "blocked" with no statement of what blocks it is not visible blocking.
    const blockers = page.getByTestId('ledger-blockers').locator('li');
    await expect(blockers).toHaveCount(7);
    for (const subject of [
        'thea-young-portrait', 'elias-wren-portrait', 'marianne-cole-portrait',
        'samuel-hart-portrait', 'arthur-bell-portrait'
    ]) {
        const blocker = page.locator(`li[data-blocker="asset-rights-incomplete"][data-subject="${subject}"]`);
        await expect(blocker).toBeVisible();
        await expect(blocker).toContainText(subject);
    }
    await expect(page.locator('li[data-blocker="scholarly-review-pending"]')).toBeVisible();
    await expect(page.locator('li[data-blocker="educator-context-sheet-pending"]')).toBeVisible();

    // The case being audited is stated, so a reviewer knows which content this verdict is about.
    await expect(page.getByTestId('ledger-case')).toContainText('young-interference');

    // All four sections, each a real table with real headers.
    for (const testId of ['ledger-sources', 'ledger-assets', 'ledger-sign-off', 'ledger-references']) {
        const table = page.getByTestId(testId);
        await expect(table).toBeVisible();
        expect(await table.locator('thead th[scope="col"]').count()).toBeGreaterThan(0);
        expect(await table.locator('tbody tr').count()).toBeGreaterThan(0);
    }

    // Both sources and all six manifest assets, and the logo's cleared row beside the uncleared ones —
    // so a reviewer can see the gate is discriminating rather than refusing everything.
    await expect(page.getByTestId('ledger-sources').locator('tbody tr')).toHaveCount(2);
    await expect(page.getByTestId('ledger-assets').locator('tbody tr')).toHaveCount(6);
    await expect(ledgerRow(page, 'quantique-logo')).toContainText(en['source.rights.reviewed']);
    await expect(ledgerRow(page, 'thea-young-portrait')).toContainText(en['source.rights.incomplete']);

    // A de-scoped role is recorded with its decision, and never spelled as a sign-off (AC2).
    await expect(ledgerRow(page, 'accessibilityReviewer')).toContainText('De-scoped (ADR-008)');
    await expect(ledgerRow(page, 'accessibleControlsReference')).toContainText('De-scoped (ADR-008)');
    await expect(ledgerRow(page, 'scholarlyReviewer')).toContainText(en['ledger.reviewer.pending']);
});

test('starts no Phaser game on the ledger route, and mounts no player session machinery', async ({ page }) => {
    await openLedger(page, '/?ledger=1');

    // The isolation itself. `StartGame` is never reached, so there is no canvas to letterbox and no
    // scene to route — `data-active-scene` is the hook the router writes on every activation.
    await expect(page.locator('#game-container canvas')).toHaveCount(0);
    await expect(page.locator('#game-container')).not.toHaveAttribute('data-active-scene', /.*/);

    // Neither fixed layer is on screen: the boot frame would cover the ledger, and the canvas container
    // would paint over it.
    await expect(page.locator('#boot-shell')).toBeHidden();
    await expect(page.locator('#game-container')).toBeHidden();

    // No printable record is mounted, because no repository is built — the same isolation the validation
    // route already has, and the reason a reviewer's browser is not autosaved over.
    await expect(page.locator('.case-record-print-view')).toHaveCount(0);
    // And the entry button is not reachable, so there is no way to fall through into a live session.
    await expect(page.getByTestId('enter-laboratory')).toBeHidden();
});

test('audits the Morley–Miller prototype on ?ledger=1&case=morley-miller', async ({ page }) => {
    await openLedger(page, '/?ledger=1&case=morley-miller');

    await expect(page.getByTestId('ledger-case')).toContainText('morley-miller');
    await expect(page.getByTestId('ledger-decision')).toHaveAttribute('data-decision', 'blocked');

    // Its two open roles and nothing else: the prototype's single asset is the cleared logo, and both of
    // its sources are reviewed. A count assertion rather than a presence one, so a portrait row leaking
    // in from Young's ledger would fail here.
    await expect(page.getByTestId('ledger-blockers').locator('li')).toHaveCount(2);
    await expect(page.locator('li[data-blocker="scholarly-review-pending"][data-subject="morley-miller"]')).toBeVisible();
    await expect(page.locator('li[data-blocker="educator-context-sheet-pending"][data-subject="morley-miller"]')).toBeVisible();

    await expect(page.getByTestId('ledger-assets').locator('tbody tr')).toHaveCount(1);
    // The prototype's two sources carry both roles — the 1887 paper is primary material and the 1905
    // report is a reconstruction restating it.
    await expect(ledgerRow(page, 'michelson-morley-1887')).toContainText(en['ledger.role.primary']);
    await expect(ledgerRow(page, 'morley-miller-1905-reconstruction')).toContainText(en['ledger.role.secondary']);

    await expect(page.locator('#game-container canvas')).toHaveCount(0);
});

test('renders the ledger in French for a French browser', async ({ browser }) => {
    // French is not a follow-up (the lesson from 3.2's `de Écartement des fentes`), and the locale comes
    // from the browser rather than from a selector, so this needs its own context.
    const context = await browser.newContext({ locale: 'fr-FR' });
    const page = await context.newPage();
    try {
        await openLedger(page, '/?ledger=1');

        await expect(page.getByTestId('ledger-decision')).toContainText('BLOQUÉE');
        await expect(page.getByTestId('ledger-blockers').locator('li')).toHaveCount(7);
        await expect(ledgerRow(page, 'accessibilityReviewer')).toContainText('Hors périmètre (ADR-008)');
        // The authored replacement plan reads in French too — the row a reviewer is being asked to act on.
        await expect(ledgerRow(page, 'thea-young-portrait')).toContainText('L’examen des droits doit décider');
    } finally {
        await context.close();
    }
});
