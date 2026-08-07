import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { caseFileRecordControlCentre } from '../../src/adapters/phaser/renderers/caseFileGeometry';
import { en } from '../../src/core/i18n/locales/en';
import {
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    WALK_TO_DEBRIEF_COST_MS,
    clickDesign,
    inTheCaseFile,
    recordedObservations,
    walkToTheBoard,
    waitForInputToSettle
} from './canvasHelpers';

/**
 * Export, import and print, driven from the canvas (Story 2.12, Task 2 / AC3 / AC5).
 *
 * This spec used to drive `src/ui/persistence/CaseProgressPanel.ts` — the free-text prediction, the
 * "Record prepared observation" button, and the panel's own export button and file input. All of it is
 * deleted. The **behaviour** is not: `createCaseRecordOperations` holds the same adapters the panel
 * called, and the case file's bottom row is where a player reaches them.
 *
 * Every assertion here is re-pointed rather than dropped. The round trip, the "player-only record"
 * shape, the neutral failure on an invalid file, the neutral failure on an incompatible version, and
 * "your current work is unchanged" after each — all still asserted, against the surfaces that own them
 * now. This is the offline/portability half of FR11 and NFR12.
 *
 * ## Two things had to change shape, and why
 *
 * - **The file chooser is transient.** `pickRecordFile` creates a hidden `<input type="file">`, uses
 *   it, and removes it — `exportCaseRecord`'s own transient-`<a>` pattern, pointed the other way. There
 *   is no persistent input to `setInputFiles` on, so the spec answers Playwright's `filechooser` event,
 *   which is what a player's own file dialog looks like from here.
 * - **The status line is canvas text**, which cannot be read from the DOM. So each outcome is asserted
 *   through the retained printable record instead — the store field the import did or did not replace,
 *   which is a stronger claim than the sentence beside it anyway.
 */

test.setTimeout(30_000 + WALK_TO_DEBRIEF_COST_MS);

const EXPORT = caseFileRecordControlCentre(0, DESIGN_WIDTH, DESIGN_HEIGHT);
const IMPORT = caseFileRecordControlCentre(1, DESIGN_WIDTH, DESIGN_HEIGHT);

/** What the record says the prediction is — the field each import below does or does not replace. */
const recordedPrediction = (page: Page) =>
    page.getByRole('article', { name: en['print.ariaLabel'] })
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: en['print.prediction.heading'], exact: true }) })
        .getByRole('definition');

/**
 * Offers one file to the transient chooser the import control opens.
 *
 * The listener is armed **before** the click, because the chooser opens synchronously inside the
 * handler: registering afterwards would race the dialog it is waiting for.
 */
const importFile = async (page: Page, name: string, contents: string): Promise<void> => {
    const chooser = page.waitForEvent('filechooser');
    await clickDesign(page, IMPORT);
    await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(contents) });
    await waitForInputToSettle(page);
};

test('exports only portable progress and recovers from invalid or incompatible imports', async ({ page }) => {
    await walkToTheBoard(page);

    // The record the walk built, read from ADR-007's retained print view.
    await expect(recordedObservations(page)).toHaveCount(2);
    const originalPrediction = await recordedPrediction(page).textContent();
    expect(originalPrediction).toBeTruthy();

    // --- export ----------------------------------------------------------------------------------
    let exported: Record<string, unknown> = {};
    await inTheCaseFile(page, async () => {
        const downloadPromise = page.waitForEvent('download');
        await clickDesign(page, EXPORT);
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('young-interference-progress-v3.json');
        const downloadPath = await download.path();
        if (!downloadPath) throw new Error('The exported record should be available to the test runner.');
        exported = JSON.parse(await readFile(downloadPath, 'utf8')) as Record<string, unknown>;
    });

    // The player's own record and nothing else: the immutable case definition never travels with it.
    expect(exported).toMatchObject({
        schemaVersion: 3,
        caseId: 'young-interference',
        runs: [{ id: expect.any(String) }, { id: expect.any(String) }]
    });
    expect(exported).not.toHaveProperty('caseDefinition');
    expect(exported).toMatchObject({ recognition: { version: 1 } });
    expect((exported.recognition as { items: readonly { id: string; achieved: boolean }[] }).items)
        .toContainEqual(expect.objectContaining({ id: 'source-discipline', achieved: true }));

    // --- a valid import replaces the session ------------------------------------------------------
    // The prediction is changed **and** its attribution dropped together, which is the only shape a
    // record with hand-written text can legitimately have: `validateCaseRecordForDefinition` rejects a
    // present proposal ID whose text no longer matches its proposal. It is also the shape a file
    // exported by a build older than the proposals actually has, so this is the compatibility path
    // rather than an invented one.
    await inTheCaseFile(page, async () => {
        await importFile(page, 'valid-progress.json', JSON.stringify({
            ...exported,
            prediction: 'An imported prediction.',
            selectedPredictionProposalId: undefined
        }));
    });
    await expect(recordedPrediction(page)).toHaveText('An imported prediction.');
    await expect(recordedObservations(page)).toHaveCount(2);

    // --- an unreadable file changes nothing --------------------------------------------------------
    await inTheCaseFile(page, async () => {
        await importFile(page, 'invalid-progress.json', '{');
    });
    await expect(recordedPrediction(page)).toHaveText('An imported prediction.');
    await expect(recordedObservations(page)).toHaveCount(2);

    // --- and neither does a record for another version of this investigation ------------------------
    await inTheCaseFile(page, async () => {
        await importFile(page, 'other-version.json', JSON.stringify({ ...exported, caseDefinitionVersion: '2.0.0' }));
    });
    await expect(recordedPrediction(page)).toHaveText('An imported prediction.');
    await expect(recordedObservations(page)).toHaveCount(2);
});

/**
 * Print reaches the browser dialog, and the record it opens over is the retained one (FR11, ADR-007).
 *
 * `window.print` is stubbed rather than allowed to open a real dialog, which would hang the run. What
 * is under test is that the canvas control reaches `openPrintDialog` at all — the trigger the epic's
 * AC1 left with no owner when it retained the print *view* and deleted the panel that opened it.
 */
test('opens the print dialog over the retained printable record, from the case file', async ({ page }) => {
    await page.addInitScript(() => {
        (window as unknown as { __printed: number }).__printed = 0;
        window.print = () => { (window as unknown as { __printed: number }).__printed += 1; };
    });
    await walkToTheBoard(page);

    await expect(page.getByRole('article', { name: en['print.ariaLabel'] })).toBeAttached();
    await inTheCaseFile(page, async () => {
        await clickDesign(page, caseFileRecordControlCentre(2, DESIGN_WIDTH, DESIGN_HEIGHT));
        await waitForInputToSettle(page);
    });

    expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
});
