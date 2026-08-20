import { expect, test } from '@playwright/test';

import {
    DIALOGUE_PANEL_WIDTH,
    DIALOGUE_TOP,
    PROPOSAL_SURFACE_LEFT,
    boardDialogueAdvanceControlCentre,
    colleagueFigureProbe,
    proposalDetailPanelProbe
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { bookCloseControlCentre } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
import { libraryAdvanceControlCentre } from '../../src/adapters/phaser/scenes/libraryGeometry';
import { en } from '../../src/core/i18n/locales/en';
import { BOOT_NOTICE_MS } from '../../src/ui/BootShell';
import {
    ARTIFACT_COUNT,
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    artifactAt,
    canvas,
    clickDesign,
    clickUntilScene,
    enterTheLaboratory,
    gotoCase,
    waitForBookToClose,
    waitForBookToOpen
} from './canvasHelpers';

/**
 * Reaches the colleague board with canvas clicks only (Story 2.12).
 *
 * The context gate used to be satisfied through the retired `CuratedRecord` panel's inspect buttons and
 * `CaseContextAndPrediction`'s "Continue to prediction". Both are deleted; the reading room and its
 * advance control are what a player has.
 */
const reachTheColleagues = async (page: import('@playwright/test').Page): Promise<void> => {
    for (let index = 0; index < ARTIFACT_COUNT; index += 1) {
        await clickDesign(page, artifactAt(index));
        await waitForBookToOpen(page);
        await clickDesign(page, bookCloseControlCentre());
        await waitForBookToClose(page);
    }
    await clickUntilScene(page, libraryAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT), 'Colleagues');
};

/** What the retained printable record says the prediction is — the store field, projected. */
const recordedPrediction = (page: import('@playwright/test').Page) =>
    page.getByRole('article', { name: en['print.ariaLabel'] })
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: en['print.prediction.heading'], exact: true }) })
        .getByRole('definition');

/**
 * AC1's advance control, exercised on the canvas — the only place it can be.
 *
 * This is not a decorative check. Two defects that every unit and integration test passed through were
 * only reachable here: an advance that moved the widget's beat index without repainting the panel, so
 * the conversation appeared frozen; and a proposal card whose Phaser hit area kept the size it had at
 * construction after the card was resized, leaving it clickable in the gap below where it is drawn.
 *
 * The assertions are deliberately coarse — "the canvas changed", "the prediction did not" — because
 * pinning pixels or card bands would pin a layout that AC1 requires to move with the beat being read.
 */

/**
 * Derived from the **board**, never restated: the panel's gutters are the widget's business and the
 * panel's width is the board's.
 *
 * This used to call the widget helper with `PROPOSAL_SURFACE_WIDTH`, which was the panel's width right
 * up until Story 2.9 narrowed the panel so the control column could sit beside it instead of above it.
 * The click then landed on empty canvas and this spec failed — which is the good outcome, and the
 * reason the board exports one resolved point for both to read.
 */
const ADVANCE = boardDialogueAdvanceControlCentre();

/** Inside the last card wherever the band starts. Derived, never a mid-surface guess — see the helper. */
const FIRST_COLLEAGUE = colleagueFigureProbe(0);
const SECOND_COLLEAGUE = colleagueFigureProbe(1);
const DETAIL = proposalDetailPanelProbe(DESIGN_HEIGHT);

/**
 * A screenshot of just the dialogue panel's band, not the whole canvas.
 *
 * "Some pixel somewhere changed" is satisfied by any nondeterminism on the surface, independently of the
 * repaint under test — the assertion read stronger than it was (1.12 review). Clipping to the band the
 * widget owns means only a panel repaint can satisfy it. The band is derived from the widget's own
 * geometry, and is deliberately generous vertically so it covers the counter, the control, and a beat
 * body of any wrapped height.
 */
const panelShot = async (page: import('@playwright/test').Page): Promise<Buffer> => {
    const bounds = await canvas(page).boundingBox();
    if (!bounds) throw new Error('The routed Phaser surface did not render.');
    const scaleX = bounds.width / DESIGN_WIDTH;
    const scaleY = bounds.height / DESIGN_HEIGHT;
    return page.screenshot({
        clip: {
            x: bounds.x + (PROPOSAL_SURFACE_LEFT * scaleX),
            y: bounds.y + (DIALOGUE_TOP * scaleY),
            width: DIALOGUE_PANEL_WIDTH * scaleX,
            height: 120 * scaleY
        }
    });
};

test('advances the authored conversation on the canvas without touching the investigation', async ({ page }) => {
    await gotoCase(page);
    await enterTheLaboratory(page);

    await reachTheColleagues(page);

    // The record says no prediction is chosen yet. Read from ADR-007's retained print view, which
    // replaced the deleted context panel's textarea as the only DOM projection of the store.
    const prediction = recordedPrediction(page);
    await expect(prediction).toHaveText(en['print.prediction.empty']);

    /**
     * The entry notice has expired before the first pixel is compared.
     *
     * This is the only spec in the suite that compares canvas pixels, and `page.screenshot` captures the
     * *composited page* — so anything the browser draws over the clip band is in the shot. The entry
     * confirmation is a fixed bar across the top of the viewport that clears itself after
     * `BOOT_NOTICE_MS`, and the dialogue band sits under it: without this wait, a shot taken while it
     * was up and a shot taken after it went differed, and the "nothing changed yet" assertion below
     * failed on firefox and webkit while passing on the faster chromium.
     */
    await expect(page.locator('#boot-status')).toBeEmpty({ timeout: BOOT_NOTICE_MS + 2_000 });

    const firstBeat = await panelShot(page);

    // A click that misses the control must not satisfy the repaint assertion below, so prove the shot is
    // stable when nothing has been advanced. Without this the whole check could pass on canvas noise.
    expect(Buffer.compare(await panelShot(page), firstBeat)).toBe(0);

    await clickDesign(page, ADVANCE);

    // The panel repainted: a widget that moved its index without redrawing left this identical.
    await expect(async () => {
        expect(Buffer.compare(await panelShot(page), firstBeat)).not.toBe(0);
    }).toPass();
    // And advancing is not choosing. The advance control sits above the cards, so a click falling
    // through to one — or a card whose hit area still covered the panel — would adopt a proposal here.
    await expect(prediction).toHaveText(en['print.prediction.empty']);
});

test('opens one colleague proposal after the conversation completes, then chooses it', async ({ page }) => {
    await gotoCase(page);
    await enterTheLaboratory(page);

    await reachTheColleagues(page);

    // Conversation is authored in three beats. Only its completion hands the room to the direct
    // colleague controls, so an early figure click cannot silently choose a proposal.
    await clickDesign(page, FIRST_COLLEAGUE);
    await expect(recordedPrediction(page)).toHaveText(en['print.prediction.empty']);
    for (let beat = 0; beat < 4; beat += 1) await clickDesign(page, ADVANCE);
    await clickDesign(page, FIRST_COLLEAGUE);
    await clickDesign(page, DETAIL);

    const prediction = recordedPrediction(page);
    await expect(prediction).not.toHaveText(en['print.prediction.empty']);
    // Adopted verbatim from the authored set, not blended or partially written.
    const authored = await page.evaluate(async () => {
        const response = await fetch('/cases/young-interference/case.json');
        const definition = await response.json() as { predictionProposals: { text: { en: string } }[] };
        return definition.predictionProposals.map(({ text }) => text.en);
    });
    expect((await prediction.textContent())?.trim()).toBe(authored[0]);

    // Opening another colleague replaces the one detail panel, and the original action remains
    // revisable rather than being latched after the first choice.
    await clickDesign(page, SECOND_COLLEAGUE);
    await clickDesign(page, DETAIL);
    await expect(prediction).toHaveText(authored[1]!);
});
