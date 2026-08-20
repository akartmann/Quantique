import { expect, test, type Page } from '@playwright/test';

import { stepAffordanceCentre } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { debriefAdvanceControlCentre } from '../../src/adapters/phaser/scenes/debriefGeometry';
import { en } from '../../src/core/i18n/locales/en';
import { resolveCampaignEntryCaseId } from '../../src/domain/cases/campaignOrder';
import {
    clickDesign,
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    expectActiveScene,
    gotoCase,
    recordedObservations,
    recordedSetting,
    waitForInputToSettle,
    WALK_TO_DEBRIEF_COST_MS,
    walkToDebrief,
    walkToTheBoard,
    YOUNG_CASE
} from './canvasHelpers';

/**
 * The router: the active scene mirrors the authoritative phase, and nothing else moves it (ADR-009).
 *
 * **Rewritten canvas-only** (Story 2.12). This file drove forty-three DOM locators — a free-text
 * prediction, `Run experiment`, four support checkboxes, the notebook's comparison controls, and a probe
 * that typed into the theory board's conclusion and limitation fields. Every one of those controls is
 * deleted, and the three free-text actions behind them are removed from `AppAction` (D5).
 *
 * ## Where the typed-field probe went
 *
 * `:112-126` used to prove, through those two fields, that a stray canvas click cannot leave the draft
 * carrying one proposal's claim beside another's limitation. **That property survives the deletion and
 * its evidence did not** — with no free-text path there is no second writer, but "no blend, no partial
 * write" is still the rule the one remaining writer has to obey. It is re-asserted at the store, in
 * `tests/integration/ProposalSelection.test.ts`, where it can be checked against *every* authored
 * proposal rather than against whichever one a click happened to land on.
 *
 * What is left here is what only a browser can say: that the router really activates and tears down
 * scenes, that a torn-down scene stops responding, and that a reload lands the player back in the phase
 * they left.
 */

test.setTimeout(30_000 + WALK_TO_DEBRIEF_COST_MS);

/** The slot the slit-spacing instrument stands in, derived rather than fixed at zero. */
const SLIT_SPACING_SLOT = 0;
const SLIT_SPACING_STEP_UP = stepAffordanceCentre(SLIT_SPACING_SLOT, 1);

/** What the record says the slit spacing reads — the bench's own state, observed from the record. */
const slitSpacing = (page: Page) => recordedSetting(page, 'Slit spacing');

test('walks the Young scene sequence, keeping the active scene mirroring the case phase', async ({ page }) => {
    await walkToDebrief(page, YOUNG_CASE, 'conclusion-universal-optics');

    // Every transition on the way is asserted inside the walk itself; arriving here is the last one.
    await expectActiveScene(page, 'Debrief');

    // A counterfactual replay returns the case to context, and the scene follows it back.
    await clickDesign(page, debriefAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT));
    await expectActiveScene(page, 'Library');
    // A replay is a fresh investigation rather than a re-reading of the finished one.
    await expect(recordedObservations(page)).toHaveCount(0);
});

/**
 * A scene the router stopped really stopped: its controls no longer reach the store.
 *
 * This is the half of the old typed-field probe that genuinely needed a browser, kept and sharpened.
 * The bench's step affordance is clicked at its **derived** coordinate after the player has left the
 * laboratory; if the scene were still live the slit spacing would move, and the record would say so.
 *
 * It is not trivially true: the same click at the same coordinate moves the setting while the bench is
 * up, which is asserted first — so a coordinate that had drifted into empty space would fail the
 * positive half rather than pass the negative one by accident.
 */
test('stops responding to a scene the router has torn down', async ({ page }) => {
    await walkToTheBoard(page);
    await expectActiveScene(page, 'TheoryBoard');

    const afterLeaving = await slitSpacing(page).textContent();
    expect(afterLeaving).toBeTruthy();

    await clickDesign(page, SLIT_SPACING_STEP_UP);
    await waitForInputToSettle(page);

    await expect(slitSpacing(page)).toHaveText(afterLeaving!);
    await expectActiveScene(page, 'TheoryBoard');
});

test('restores a reloaded session into the scene matching the persisted phase', async ({ page }) => {
    await gotoCase(page, YOUNG_CASE);
    await expectActiveScene(page, 'Library');
    await expect(page.getByRole('heading', { name: en['boot.title'] })).toBeVisible();

    await walkToTheBoard(page);
    await expectActiveScene(page, 'TheoryBoard');
    // **No manual save.** The autosave `attachAutosave` wires is what has to have written, which is
    // exactly what this reload then reads back (Story 2.12, AC3).
    await page.waitForTimeout(500);

    await page.reload();

    await expectActiveScene(page, 'TheoryBoard');
    await expect(recordedObservations(page)).toHaveCount(2);
});

/**
 * **The origin root reaches a playable case — the one path Story 4.1 built and no e2e walked.**
 *
 * The flip moved about forty `goto('/')` sites onto `?case=`, and every one of them takes
 * `resolveCaseId`'s *first* precedence branch. So a regression in the campaign default at the origin
 * root — in `readCompletedCampaignCaseIds`, in the argument ordering in `main.ts`, or in the precedence
 * inside `resolveCaseId` — left the whole migrated suite green (code review of 4.1). The only root-boot
 * coverage was `subpath-hosting.spec.ts`, which asserts a request and no 4xx under the *subpath* origin
 * and never reaches a scene.
 *
 * Named against `resolveCampaignEntryCaseId([])` rather than a literal, following the subpath spec, so
 * this states "the campaign entry becomes playable at `/`" and moves with the campaign.
 *
 * The other direction — completing the entry case and having `/` advance to the next — is proved in
 * `CampaignOrder.test.ts` and `MorleyMillerPrototype.test.ts` against the real repository contract, and
 * is **not** walked end to end here: seeding a completed record into IndexedDB from a spec means
 * building a valid `CaseRecord` in the browser context. That residual is recorded in `deferred-work.md`.
 */
test('boots the campaign entry into a playable scene at the origin root', async ({ page }) => {
    const entryCaseId = resolveCampaignEntryCaseId([]);
    const failures: string[] = [];
    page.on('response', (response) => {
        if (response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });

    await page.goto('/');

    // A scene, not a request: `content-unavailable` also fetches, and the boot shell it leaves behind is
    // exactly the dead end the review found reachable offline. Reaching `Library` — the entry case's
    // `context` phase — is what says the case loaded, validated and routed.
    //
    // No `boot.enter` click, following this file's other tests: the shell hands off on its own and
    // clicking it dismisses the heading, which is what made the first version of this test fail.
    await expectActiveScene(page, 'Library');

    const requested = await page.evaluate(() => performance.getEntriesByType('resource')
        .map((entry) => new URL(entry.name).pathname));
    expect(requested).toContain(`/cases/${entryCaseId}/case.json`);
    expect(failures, 'no request may fail on the campaign default route').toEqual([]);
});
