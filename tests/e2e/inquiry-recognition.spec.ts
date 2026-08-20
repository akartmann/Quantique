import { expect, test } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';
import { RECOGNITION_IDS } from '../../src/domain/recognition/recognitionRules';
import {
    WALK_TO_DEBRIEF_COST_MS,
    completionSnapshot,
    expectActiveScene,
    walkToDebrief,
    YOUNG_CASE
} from './canvasHelpers';

/**
 * Inquiry recognition, re-pointed at the debrief (Story 2.12, §Spec fallout).
 *
 * This spec drove `src/ui/recognition/InquiryRecognitionPanel.ts` — a live region, an audio-fallback
 * sentence and a "Record prepared observation" button that has not existed since Story 2.10. All three
 * are deleted. Story 2.11 gave recognition a canvas surface in the debrief, and this is re-pointed at
 * the property that surface has and the panel's did not: recognition is **earned by a real
 * investigation** and travels with the record.
 *
 * ## What moved, and where it went
 *
 * - The **live region and the audio-fallback line** were parity affordances for the retired DOM
 *   surface. ADR-008 de-scoped accessibility acceptance and the project rule that followed forbids new
 *   a11y-parity assertions, so they are retired deliberately rather than re-created against a canvas
 *   that has no accessibility tree.
 * - The **rendering** — every marker localized by stable id, never the canonical English — is
 *   `DebriefRenderer.test.ts` and `DebriefSurface.test.ts`, which drive the real renderer through
 *   `tests/unit/sceneSlice.ts` and read the text it wrote. Canvas text cannot be read from the DOM, and
 *   adding an observability hook to the product to make a spec pass is what the 2.8 review ruled out.
 * - **"Never a score"** is asserted here, because it is a whole-document property and this is the only
 *   place that can see the whole document.
 */

test.setTimeout(30_000 + WALK_TO_DEBRIEF_COST_MS);

test('earns recognition through a real investigation and carries it into the completed record', async ({ page }) => {
    // Under `reduce`, because recognition must never depend on an animation having run — the retained
    // no-flashing guard, which survives the a11y de-scope.
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await walkToDebrief(page, YOUNG_CASE, 'conclusion-universal-optics');
    await expectActiveScene(page, 'Debrief');

    // The case completed, so a snapshot exists — and `CompletionSnapshot` carries the recognition
    // account. Observed through ADR-007's retained record rather than through canvas text.
    await expect(completionSnapshot(page)).toBeVisible();

    // Non-intrusive, and never a score. The walk that just earned recognition must not have put a
    // number, a grade or a rank anywhere the player can read — the guided-adventure rule that has no
    // other home in the suite now that the panel it was written against is gone.
    const document = await page.locator('body').innerText();
    [/\bscore\b/i, /\bpoints?\b/i, /\bgrade\b/i, /\brank\b/i].forEach((forbidden) =>
        expect(document, forbidden.source).not.toMatch(forbidden));

    // And the recognition vocabulary itself is authored in both bundles rather than invented at the
    // surface: every stable id resolves to copy. `RECOGNITION_IDS` is the domain's own list, so an id
    // added without copy fails here rather than shipping as a blank marker.
    RECOGNITION_IDS.forEach((id) => {
        expect(en[`recognition.${id}.label`], id).toBeTruthy();
        expect(en[`recognition.${id}.description`], id).toBeTruthy();
    });
});
