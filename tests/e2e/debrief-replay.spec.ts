import { expect, test } from '@playwright/test';

import { debriefAdvanceControlCentre } from '../../src/adapters/phaser/scenes/debriefGeometry';
import {
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    WALK_TO_DEBRIEF_COST_MS,
    clickDesign,
    completionSnapshot,
    expectActiveScene,
    recordedObservations,
    walkToDebrief
} from './canvasHelpers';

/**
 * The debrief and the replay, **on the canvas** (Story 2.11, AC8).
 *
 * This spec drove thirteen DOM controls until 2.11 — `Run experiment`, four support checkboxes, the
 * conclusion and limitation fields, the two peer-review buttons and the panel's own replay button —
 * every one of which Story 2.12 deletes. It is rewritten around {@link walkToDebrief}, which reaches
 * the debrief with canvas clicks only and asserts each transition on the way. No assertion was deleted
 * to make it green; each was re-pointed at something the canvas build can actually be held to.
 *
 * ## What is asserted here, and what is asserted elsewhere
 *
 * **Canvas text cannot be read from the DOM.** So the debrief's own copy — the authored summary, the
 * historical comparison, the provenance labels, the recognition account, the challenge history, the
 * counterfactual warning — is asserted where it can be: `DebriefRenderer.test.ts` drives the renderer
 * through `tests/unit/sceneSlice.ts` and reads the text it actually wrote, `I18n.test.ts` pins the
 * bundle completeness, `CaseDefinition.test.ts` pins the authored EN+FR, and
 * `french-typography.spec.ts` measures the French widths. That division is the one
 * `canvas-transitions.spec.ts` documents in its own header.
 *
 * The optional deeper-theory layer is the clearest case of it: opening it changes only painted text,
 * suppresses nothing, and routes nowhere, so there is no honest DOM signal for it at all — and adding
 * an observability hook to the product to make a test pass is the thing the 2.8 review explicitly
 * ruled out. It is covered by mutation in `DebriefRenderer.test.ts` instead.
 *
 * What **is** observable here is routing and the still-mounted record projection: that the debrief is
 * reached at all, that the replay is dispatchable from the canvas, that a replay clears the
 * investigation, and that it leaves the completed record standing. The last of those is AC2's "never
 * rewrites the historical outcome" and AC4's "preserves the completed historical record", and it is
 * the one that would fail if `reduceDebriefComplete`'s counterfactual branch were dropped.
 */

test.setTimeout(30_000 + WALK_TO_DEBRIEF_COST_MS);

const DEBRIEF_REPLAY = debriefAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT);

/**
 * The record's own account of `completion.finalDecision`.
 *
 * Re-pointed from the deleted `Historical debrief` panel to ADR-007's retained printable record, which
 * projects the same snapshot and renders its section **only when there is one** — so this still tells
 * "the case completed" from "the debrief scene was reached" (Story 2.12).
 */
const completedConclusion = completionSnapshot;

test('reaches the debrief with canvas clicks only and keeps the record through a counterfactual replay', async ({ page }) => {
    await walkToDebrief(page);
    await expectActiveScene(page, 'Debrief');

    // The case completed, so a snapshot was written. Observed through the record's projection rather
    // than through canvas text, which cannot be read from here.
    await expect(completedConclusion(page)).toBeVisible();
    const recordedDecision = await completedConclusion(page).locator('p').first().textContent();
    expect(recordedDecision).toBeTruthy();

    // --- the replay, from the canvas -------------------------------------------------------------
    await clickDesign(page, DEBRIEF_REPLAY);
    await expectActiveScene(page, 'Library');

    // A replay is a fresh investigation, not a re-reading of the finished one.
    await expect(recordedObservations(page)).toHaveCount(0);

    // **And the completed record is still there, byte for byte.** `reduceDebriefComplete` keeps the
    // original snapshot across a counterfactual replay, so the historical record the debrief shows can
    // never be rewritten by what the player does on the second pass. Held by the reducer, asserted
    // here rather than re-implemented in a surface.
    await expect(completedConclusion(page)).toBeVisible();
    expect(await completedConclusion(page).locator('p').first().textContent()).toBe(recordedDecision);
});
