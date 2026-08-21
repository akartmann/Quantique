import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { debriefAdvanceControlCentre } from '../../src/adapters/phaser/scenes/debriefGeometry';
import {
    caseFileObservationPinCentre,
    caseFileRequestControlCentre,
    caseFileSaveControlCentre
} from '../../src/adapters/phaser/renderers/caseFileGeometry';
import { caseFileOpenControlCentre } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import {
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    WALK_TO_DEBRIEF_COST_MS,
    canvas,
    caseContent,
    clickDesign,
    completionSnapshot,
    expectActiveScene,
    pinTheSupport,
    recordedObservations,
    recordedRevisions,
    varyingInstrument,
    waitForInputToSettle,
    walkToDebrief,
    walkToTheBoard,
    YOUNG_CASE
} from './canvasHelpers';

/**
 * **The Morley–Miller debrief, reached and photographed** (Story 4.3, AC4 / AC5 / AC10).
 *
 * ## Why this file did not exist before
 *
 * `walkToDebrief` called `walkToTheBoard` with no case id, so it was Young always, and `pinTheSupport`
 * and `closeTheCase` were module-private — so no spec could reach a *second* case's debrief through the
 * shared helpers at all. That is why the code review of Story 4.1 verified that story's AC3/AC4 by
 * screenshot on the reading room and the case file and left the debrief unphotographed, and why
 * `docs/case-reviews/morley-miller-case-review.md` §4 claimed a by-eye confirmation that had no route.
 *
 * One correction to that account, since this file is where it would matter:
 * `morley-miller-prototype.spec.ts` **does** reach `Debrief` on this case, at the end of its first test,
 * by inlining its own copy of the pin-and-close steps and taking the *overclaim* conclusion. So the
 * honest statement is narrower than "no spec ever got there": no spec ever **asserted** anything about
 * this case's debrief, and no frame was ever captured. An inlined copy of a walk is not a route — it
 * cannot be reused, it drifts from the helper it copied, and it took the conclusion it took by accident:
 * `colleagueIndex` defaulted to slot 3, which on this case's conclusion board is `harriet-lowe`
 * (`conclude-instrument-broken`), not the overclaim anyone would have guessed from `colleagues[3]`. See
 * `colleagueIndexForConclusion` for why the two orderings differ and why they coincide on Young.
 *
 * ## What is asserted here, and what is asserted elsewhere
 *
 * The division `debrief-replay.spec.ts` documents applies unchanged: **canvas text cannot be read from a
 * spec**, so the debrief's authored copy — the summary, the 1907 comparison and both its numbers, the
 * provenance labels, the recognition account — is asserted in `MorleyMillerDebrief.test.ts`, which drives
 * the real `DebriefRenderer` over the real shipped case through `tests/unit/sceneSlice.ts` and reads the
 * text it actually wrote. What is observable *here* is routing, the still-mounted record projection, and
 * the pixels.
 */

const MORLEY_MILLER = 'morley-miller';

/**
 * This case's distinguishing control, at the value the model actually distinguishes.
 *
 * 90°, not the travel maximum: the model is `cos(2θ)` over an authored 0–180° range, so the two
 * endpoints are the *same* reading. `morley-miller-prototype.spec.ts` records the review that found the
 * walk asserting two distinguishing runs while recording one reading twice.
 */
const ROTATION = varyingInstrument(MORLEY_MILLER, 'rotationDeg', 90);

/**
 * Young's varying control, for the shared-band comparison below.
 *
 * The same derivation `canvasHelpers` uses for its module-private `YOUNG_THROW` — `varyingInstrument`
 * reads the authored control, so this is a second call to one function rather than a second copy of a
 * coordinate.
 */
const YOUNG_THROW = varyingInstrument(YOUNG_CASE, 'screenDistanceM');

/** The conclusion this case teaches, and the one the pinned evidence defends. */
const BOUNDED_NULL = 'conclude-bounded-null';
/** The conclusion the authored `peer-overreach` rule answers, made reachable by Story 4.3's AC1. */
const OVERCLAIM = 'conclude-ether-disproved';

const DEBRIEF_REPLAY = debriefAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT);

test.setTimeout(30_000 + WALK_TO_DEBRIEF_COST_MS);

/**
 * Writes a frame through `testInfo.outputPath` and prints where it went.
 *
 * The pattern `young-canvas-experiment.spec.ts`'s "AC1 by eye" block established, and the answer to the
 * AC9 finding of 4.2's review — nine screenshots with no address and no spec left to re-take them. The
 * `list` reporter keeps no attachment bodies, so a frame attached inline is a frame nobody can open.
 */
const capture = async (page: Page, testInfo: TestInfo, name: string): Promise<void> => {
    const shotPath = testInfo.outputPath(`${name}.png`);
    await canvas(page).screenshot({ path: shotPath });
    await testInfo.attach(name, { path: shotPath, contentType: 'image/png' });
    console.log(`[by-eye] ${shotPath}`);
};

test('reaches this case\'s debrief on the bounded conclusion and keeps the record through a replay', async ({ page }) => {
    test.slow();

    await walkToDebrief(page, MORLEY_MILLER, BOUNDED_NULL, ROTATION);
    await expectActiveScene(page, 'Debrief');

    // The case completed, so a snapshot was written — observed through ADR-007's retained printable
    // record, which renders its completion section only when there is one.
    await expect(completionSnapshot(page)).toBeVisible();
    const recordedDecision = await completionSnapshot(page).locator('p').first().textContent();
    expect(recordedDecision).toBeTruthy();

    // The replay, from the canvas. A replay is a fresh investigation, not a re-reading of the finished one.
    await clickDesign(page, DEBRIEF_REPLAY);
    await expectActiveScene(page, 'Library');
    await expect(recordedObservations(page)).toHaveCount(0);

    // **And the completed record is still there, byte for byte** — the same three things
    // `debrief-replay.spec.ts` asserts for Young, now asserted for the case that had no route.
    await expect(completionSnapshot(page)).toBeVisible();
    expect(await completionSnapshot(page).locator('p').first().textContent()).toBe(recordedDecision);
});

/**
 * The overclaim reaches the debrief too, and that is the design rather than an oversight.
 *
 * FR16 and NFR8 forbid a hard fail, a penalty or a lockout: a weak conclusion earns revision feedback and
 * still finishes the case. `reduceDebriefComplete` deliberately does not inspect the standing issues, and
 * §SS11 names keeping it that way. What the player does *not* get is the calibrated-conclusion
 * recognition, which is asserted on the painted frame in `MorleyMillerDebrief.test.ts`.
 */
test('reaches the debrief on the overclaim as well, because a refusal is never a lockout', async ({ page }) => {
    test.slow();

    await walkToDebrief(page, MORLEY_MILLER, OVERCLAIM, ROTATION);
    await expectActiveScene(page, 'Debrief');
    await expect(completionSnapshot(page)).toBeVisible();
});

/**
 * Leaves the walk standing at `review` with the peer-review pane up and this case's issues showing.
 *
 * Stops short of `closeTheCase`, which requests *and saves* and then advances: the pane is only on screen
 * in `review`, and saving is what ends the state this frame is of.
 *
 * **The overlay is left open**, which is the whole reason this does not use `inTheCaseFile`: that helper
 * brackets an interaction and closes the case file on the way out, and the pane is what the frame is of.
 *
 * `unpinOne` produces the worst combination ordinary play can reach, which is what AC5 asks to be
 * measured. `reduceTheorySupportRun` carries **no phase gate**, so a player standing at `review` can
 * unpin an observation — `withTheory` clears the standing feedback and `caseFile.review.clearedBySupport`
 * says so — and asking again then stands `missing-evidence` (`minimum-runs`) beside `overreach`. Three at
 * once would need an `unsupported-support` code, which ordinary play cannot produce because there is no
 * way to delete a recorded run.
 */
/**
 * One authored peer-review rule's feedback, in the reader's language, read from `case.json`.
 *
 * Read rather than written, so an authored copy edit moves the expectation with the content instead of
 * turning a spec red for saying what the case used to say.
 */
const authoredFeedback = (caseId: string, kind: string, locale: 'en' | 'fr'): string => {
    // `WalkableCase` deliberately narrows to what the walk needs, and peer-review prose is not part of
    // it, so the rules are read here with a local shape rather than by widening the shared type.
    const { peerReviewRules } = caseContent(caseId) as unknown as {
        peerReviewRules: readonly { predicate: { kind: string }; feedback: { en: string; fr: string } }[];
    };
    const rule = peerReviewRules.find(({ predicate }) => predicate.kind === kind);
    if (!rule) throw new Error(`The authored case ${caseId} must carry a ${kind} peer-review rule.`);
    return rule.feedback[locale];
};

const atReviewWithIssues = async (
    page: Page,
    unpinOne: boolean,
    caseId: string = MORLEY_MILLER,
    conclusionProposalId: string = OVERCLAIM,
    instrument: ReturnType<typeof varyingInstrument> = ROTATION
): Promise<void> => {
    await walkToTheBoard(page, caseId, instrument);
    await pinTheSupport(page, caseId, conclusionProposalId);

    // **`pinTheSupport` has already advanced `synthesis → review`** — its last two statements are this same
    // click and this same scene assertion. The duplicate that stood here was refused rather than harmful:
    // at `review` the board's advance control is `advance.closeTheCase`, and `case.debriefCompleted` is
    // refused until a reviewed revision has been saved, so the second click reached a control that said no.
    // Removed by Story 4.3's code review, which found it while proving what the capture tests below
    // actually guarantee.
    //
    // **What guarantees the pane has answered is `records both standing issues…` below, not this walk.**
    // The four capture tests assert nothing at all — `capture(...)` photographs whatever is there — so
    // without that test a refused `peerReview.requested` would paint an empty pane and every capture would
    // still pass while writing a PNG named for two standing issues. The assertion test drives this same
    // helper and reads the reviewers' answer out of the printable record, so the shared walk is pinned by
    // an assertion instead of by a filename.
    await expectActiveScene(page, 'TheoryBoard');

    await clickDesign(page, caseFileOpenControlCentre());
    await waitForInputToSettle(page);
    if (unpinOne) {
        await clickDesign(page, caseFileObservationPinCentre(0, DESIGN_WIDTH));
        await waitForInputToSettle(page);
    }
    await clickDesign(page, caseFileRequestControlCentre(DESIGN_WIDTH));
    await waitForInputToSettle(page);
};

/**
 * **AC5 / AC10 by eye: the three bands nothing has measured, at the real surface size.**
 *
 * A height claim proven in `tests/unit/sceneSlice.ts` is arithmetic and not a measurement — every text
 * object there reports a constant `height: 18` and `measureText` approximates width as `length * 7`, so a
 * clamp's shrink loop and its `setCrop` branch are unreachable from a unit test. The debrief comparison
 * band, the case file's peer-review pane and the debrief's cited-source rows all shrink-then-crop with no
 * visible clipping, which is precisely why they are captured rather than asserted.
 *
 * Four frames, both locales, 1280×720 — the viewport `project-context.md` names.
 */
for (const locale of ['en-GB', 'fr-FR'] as const) {
    const tag: 'en' | 'fr' = locale.startsWith('fr') ? 'fr' : 'en';

    test.describe(`AC5 by eye: the debrief bands in ${tag}`, () => {
        test.use({ viewport: { width: 1280, height: 720 }, locale });

        test(`captures this case's debrief — comparison band and cited-source rows [${tag}]`, async ({ page }, testInfo) => {
            test.slow();

            await walkToDebrief(page, MORLEY_MILLER, BOUNDED_NULL, ROTATION);
            await expectActiveScene(page, 'Debrief');
            // The entry notice is long gone by here — `enterTheLaboratory` waits it out inside the walk —
            // but the record projection is the signal that the scene has real content in it rather than a
            // first frame.
            await expect(completionSnapshot(page)).toBeVisible();
            await waitForInputToSettle(page);

            await capture(page, testInfo, `morley-miller-debrief-${tag}`);
        });
    });

    test.describe(`AC5 by eye: the peer-review pane in ${tag}`, () => {
        test.use({ viewport: { width: 1280, height: 720 }, locale });

        /**
         * **What makes the four capture tests below trustworthy**, and the only test in this describe
         * that can fail on the state rather than on the pixels.
         *
         * `atReviewWithIssues` ends with a `peerReview.requested` click, which the reducer **refuses**
         * outside `review`. So if the `synthesis → review` advance were ever missed, the pane would be
         * empty and the captures would go on passing, because a `capture(...)` call asserts nothing. This
         * drives the identical helper and then reads the reviewers' answer out of the printable record —
         * `print.history.item` composes it through `localizedFeedback`, resolved by `ruleId` — so the
         * shared walk is pinned by an assertion instead of by a filename.
         *
         * Both codes, by their authored prose in the reader's own language: `overreach` because the
         * adopted conclusion is the overclaim, and `missing-evidence` because `unpinOne` removed one of
         * the two supporting observations, which is the worst pair ordinary play can reach.
         *
         * **Named change that breaks this:** removing the advance click from `atReviewWithIssues`, or
         * reverting D1's claim reword so `peer-overreach` stops matching.
         */
        test(`records both standing issues the captured pane shows [${tag}]`, async ({ page }) => {
            test.slow();

            await atReviewWithIssues(page, true);

            // Saving is what writes the reviewed revision into `decisionHistory`; the pane the captures
            // photograph is the same evaluation, one dispatch earlier.
            await clickDesign(page, caseFileSaveControlCentre(DESIGN_WIDTH));
            await waitForInputToSettle(page);

            const overreach = authoredFeedback(MORLEY_MILLER, 'overreach', tag);
            const missingEvidence = authoredFeedback(MORLEY_MILLER, 'missing-evidence', tag);

            await expect(recordedRevisions(page)).toHaveCount(1);
            const revision = await recordedRevisions(page).first().textContent();
            expect(revision, `expected the ${tag} overreach prose in the recorded revision`).toContain(overreach);
            expect(revision, `expected the ${tag} missing-evidence prose`).toContain(missingEvidence);
        });

        test(`captures the case file at review with one issue standing [${tag}]`, async ({ page }, testInfo) => {
            test.slow();

            await atReviewWithIssues(page, false);
            await capture(page, testInfo, `morley-miller-review-pane-one-issue-${tag}`);
        });

        test(`captures the case file at review with two issues standing [${tag}]`, async ({ page }, testInfo) => {
            test.slow();

            await atReviewWithIssues(page, true);
            await capture(page, testInfo, `morley-miller-review-pane-two-issues-${tag}`);
        });

        /**
         * **The same shared band, holding Young's prose, which is the longer of the two.**
         *
         * `CASE_FILE_ISSUES_HEIGHT` is not per case, so the reserve's real obligation is the *longest*
         * composed pair either case can stand — and that is Young's, not this one's: 204 + 234 French
         * characters against Morley–Miller's 162 + 184. Measuring only the case a story happens to be
         * about is how a shared reserve gets sized to the shorter tenant, and §SS8 named this frame as
         * the one likely to go red.
         *
         * `conclusion-wave-settled` is Young's overclaim — its claim contains the authored phrase
         * `proves`, which is why Young's `review-overreach` has always been reachable while this case's
         * was not.
         *
         * Young's instrument is **constructed rather than defaulted to**: `canvasHelpers` keeps its
         * `YOUNG_THROW` module-private, and passing `undefined` to reach a default would land on
         * `ROTATION` instead — this parameter has one, so `undefined` triggers it. That is a control
         * Young does not author, and the drag would have failed several steps later at a readout that
         * never moved.
         */
        test(`captures Young's case file at review with two issues standing [${tag}]`, async ({ page }, testInfo) => {
            test.slow();

            await atReviewWithIssues(page, true, YOUNG_CASE, 'conclusion-wave-settled', YOUNG_THROW);
            await capture(page, testInfo, `young-review-pane-two-issues-${tag}`);
        });
    });
}
