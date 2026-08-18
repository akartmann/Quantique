import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import {
    advanceControlCentreOnBoard,
    submitConclusionControlCentre
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { bookCloseControlCentre } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
import { rivalLabReviseControlCentre } from '../../src/adapters/phaser/renderers/RivalLabRenderer';
// From `apparatusGeometry`, which imports Phaser not at all, so every click target is derived from the
// module that places the control rather than restated as a literal.
import {
    advanceToSynthesisControlCentre,
    startTheLightControlCentre,
    stepAffordanceCentre
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { libraryAdvanceControlCentre } from '../../src/adapters/phaser/scenes/libraryGeometry';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import {
    ARTIFACT_COUNT,
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    WALK_TO_DEBRIEF_COST_MS,
    artifactAt,
    canvas,
    clickDesign,
    clickUntilScene,
    chooseProposalThroughColleague,
    enterTheLaboratory,
    expectActiveScene,
    recordedObservations,
    startTheLightUntilRecorded,
    waitForBookToClose,
    waitForBookToOpen,
    waitForInputToSettle
} from './canvasHelpers';

test.setTimeout(30_000 + WALK_TO_DEBRIEF_COST_MS);

/** Which slot the screen-distance instrument stands in, from the authored control order. */
const SCREEN_DISTANCE_SLOT = (JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { apparatus: { primaryControls: { id: string }[] } })
    .apparatus.primaryControls.findIndex(({ id }) => id === 'screenDistanceM');

/**
 * AC1 and AC3 on the canvas — the only place the route into and out of the rival lab actually happens.
 *
 * What this reaches that no unit or integration test can: that the router really activates the scene
 * (`data-active-scene`), and that the submit and revise controls have live hit areas at the
 * coordinates their renderers place them at. Both click targets are **derived** from the renderers'
 * exported geometry rather than restated as literals — the rule the 1.12 review set after a spec
 * pinned a coordinate that had silently drifted into the gap between two cards.
 *
 * Canvas *text* is deliberately not asserted here: it cannot be read from the DOM, and
 * `french-typography.spec.ts` already measures every rival-lab string against its wrap bound in both
 * locales. What the French case proves is that the surface is reached and works under a French
 * browser, with the French bundle demonstrably live.
 */

const SUBMIT = submitConclusionControlCentre();
const REVISE = rivalLabReviseControlCentre(DESIGN_HEIGHT);
const ADVANCE = advanceToSynthesisControlCentre();


/**
 * Walks to the theory board on **thin evidence** — no comparison saved, no support selected — which
 * is the state that leaves every authored conclusion indefensible, so whichever card is clicked
 * draws a challenge.
 *
 * Two runs varying the **screen distance only**, since Story 2.6: the significant-measure gate needs
 * two distinct critical configurations to let anyone out of the laboratory, so a single run no longer
 * reaches the board at all. Varying the throw rather than the slit separation clears that gate while
 * leaving `conclusion-spacing-varies` (wants a varied `slitSpacingMm`) and `conclusion-both-settings`
 * (wants both) unmet, so every critique path stays exactly as reachable as it was.
 *
 * **Canvas-only since Story 2.12.** The reading, the prediction and the two runs used to go through
 * the retired `CuratedRecord`, `CaseContextAndPrediction` and `ApparatusControls` panels, all of which
 * are deleted. They go through the reading room, the colleague board and the bench now — the same
 * affordances a player has.
 *
 * `locale` is still a parameter because it selects the bundle the boot heading is asserted against,
 * which is what proves the browser really resolved the language under test before anything downstream
 * depends on it.
 */
const walkToTheoryBoardWithThinEvidence = async (
    page: import('@playwright/test').Page,
    locale: 'en' | 'fr'
): Promise<void> => {
    const labels = locale === 'fr' ? fr : en;
    await page.goto('/');
    // Proves the browser really resolved the locale under test before anything downstream depends on
    // it — the canvas resolves every string through the same store-held locale. Asserted **before**
    // entry, because the frame that carries this heading is dismissed by it; `enterTheLaboratory`'s own
    // wait accepts either bundle, so it cannot stand in for a claim about *which* one resolved.
    await expect(page.getByRole('heading', { name: labels['boot.title'] })).toBeVisible();
    await enterTheLaboratory(page);
    await expectActiveScene(page, 'Library');

    // Both references off the shelf in the reading room, which is what records `source.inspected` and
    // satisfies the context gate.
    for (let index = 0; index < ARTIFACT_COUNT; index += 1) {
        await clickDesign(page, artifactAt(index));
        await waitForBookToOpen(page);
        await clickDesign(page, bookCloseControlCentre());
        await waitForBookToClose(page);
    }
    await clickUntilScene(page, libraryAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT), 'Colleagues');

    await chooseProposalThroughColleague(page, 3);
    await clickDesign(page, advanceControlCentreOnBoard('prediction'));
    await expectActiveScene(page, 'Laboratory');

    await startTheLightUntilRecorded(page, startTheLightControlCentre(), 1);
    // The significant-measure gate refuses here, and the canvas answers with a colleague hint rather
    // than moving the player. Asserting the refusal keeps the walk honest: without it, a gate that
    // silently stopped working would still leave this helper passing.
    await clickDesign(page, ADVANCE);
    await expectActiveScene(page, 'Laboratory');

    // One authored step of the screen distance — a different configuration, which is what the gate
    // counts — through the bench's own discrete affordance.
    for (let press = 0; press < 4; press += 1) {
        await clickDesign(page, stepAffordanceCentre(SCREEN_DISTANCE_SLOT, 1));
        await waitForInputToSettle(page);
    }
    await startTheLightUntilRecorded(page, startTheLightControlCentre(), 2);

    await clickDesign(page, ADVANCE);
    await expectActiveScene(page, 'TheoryBoard');
};

/** Choosing and submitting are separate acts by design: choosing is freely revisable and draws nothing. */
const chooseAndSubmit = async (page: import('@playwright/test').Page): Promise<void> => {
    await chooseProposalThroughColleague(page, 3);
    await clickDesign(page, SUBMIT);
};

test('routes to the rival lab on an unsupported conclusion and back again on revising', async ({ page }) => {
    await walkToTheoryBoardWithThinEvidence(page, 'en');

    await chooseAndSubmit(page);

    await expectActiveScene(page, 'RivalLab');

    await clickDesign(page, REVISE);

    // Back to the phase's own scene, which never moved: the critique is a beat, not a setback, and the
    // investigation is exactly where the player left it. Observed through the record rather than the
    // deleted theory-board panel — the two observations that got the player here are still there.
    await expectActiveScene(page, 'TheoryBoard');
    await expect(recordedObservations(page)).toHaveCount(2);
});

test('leaves the board alone until the conclusion is actually submitted', async ({ page }) => {
    await walkToTheoryBoardWithThinEvidence(page, 'en');

    // Choosing on its own draws nothing — otherwise the choice would stop being freely revisable.
    await chooseProposalThroughColleague(page, 3);

    await expectActiveScene(page, 'TheoryBoard');
});

test.describe('French', () => {
    test.use({ locale: 'fr-FR' });

    test('reaches the rival lab and returns to the board under a French browser', async ({ page }) => {
        await walkToTheoryBoardWithThinEvidence(page, 'fr');

        await chooseAndSubmit(page);

        await expectActiveScene(page, 'RivalLab');

        await clickDesign(page, REVISE);

        await expectActiveScene(page, 'TheoryBoard');
    });
});
