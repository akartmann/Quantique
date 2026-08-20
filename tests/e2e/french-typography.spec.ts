import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { BOOK_FONT_STACK, FRENCH_GLYPH_SAMPLE, UI_FONT_STACK } from '../../src/adapters/phaser/textStyles';
import {
    BOARD_GUIDE_FONT_SIZE,
    BOARD_GUIDE_MAX_LINES,
    BOARD_GUIDE_WRAP_WIDTH,
    BOARD_TEXT_WRAP,
    CASE_FILE_CONTROL_FONT_SIZE as BOARD_CASE_FILE_FONT_SIZE,
    CASE_FILE_CONTROL_LABEL_WRAP as BOARD_CASE_FILE_LABEL_WRAP,
    PROPOSAL_SURFACE_WIDTH,
    SUBMIT_CONTROL_FONT_SIZE,
    SUBMIT_CONTROL_LABEL_WRAP,
    boardAdvanceControlLabelWrap,
    boardProposalMarkerWrap,
    boardProposalTextWrapWidth,
    DIALOGUE_PANEL_WIDTH
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
// The two surfaces Story 2.11 adds. Both geometry modules are Phaser-free, so this spec reads the
// bounds the rooms actually draw at rather than restating them — the rule the 2.8 review set after six
// private `LibraryRenderer` font sizes were copied into this file.
import {
    CASE_FILE_CONTROL_FONT_SIZE,
    CASE_FILE_META_FONT_SIZE,
    caseFileActionLabelWrap,
    caseFilePageControlLabelWrap,
    caseFileRecordControlLabelWrap,
    caseFilePinLabelWrap,
    caseFileRightTextWrap
} from '../../src/adapters/phaser/renderers/caseFileGeometry';
import {
    DEBRIEF_BODY_FONT_SIZE,
    DEBRIEF_META_FONT_SIZE,
    DEBRIEF_PAGE_CONTROL_FONT_SIZE,
    DEBRIEF_SECTION_TITLE_FONT_SIZE,
    DEBRIEF_SUMMARY_FONT_SIZE,
    DEBRIEF_TOGGLE_FONT_SIZE,
    debriefLeftTextWrap,
    debriefPageControlLabelWrap,
    debriefRecognitionStatusWrap,
    debriefToggleStateWrap
} from '../../src/adapters/phaser/scenes/debriefGeometry';
// From `apparatusGeometry`, not `ApparatusRenderer`: that renderer imports Phaser as a *value*
// (`BlendModes`), Phaser touches `window` at import time, and these specs run in Node.
import {
    ADVANCE_CONTROL_FONT_SIZE,
    ADVANCE_CONTROL_LABEL_WRAP,
    HINT_LINE_FONT_SIZE,
    HINT_SPEAKER_FONT_SIZE,
    HINT_TEXT_WRAP
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { advanceControlLabelWrap } from '../../src/adapters/phaser/ui/AdvanceControl';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';
import { bookCloseControlCentre } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
import {
    artifactAt,
    clickDesign,
    enterTheLaboratory,
    gotoCase,
    waitForBookToClose,
    waitForBookToOpen,
    YOUNG_CASE
} from './canvasHelpers';
// The room's own type sizes, read from the renderer that draws them rather than restated. The 2.8
// review found six of them copied into this table as literals — the same shape of defect that
// produced `CONTROL_INNER_WIDTH = 134` and that AC7 exists to close.
import {
    ARTIFACT_LABEL_FONT_SIZE,
    ARTIFACT_READ_FONT_SIZE,
    DETAIL_META_FONT_SIZE,
    DETAIL_RELATIONSHIP_FONT_SIZE,
    GUIDE_FONT_SIZE,
    HEADING_FONT_SIZE
} from '../../src/adapters/phaser/renderers/LibraryRenderer';
// `LectureBookRenderer` imports Phaser as a *type* only, so its exported geometry is readable here.
import { BOOK_CONTROL_MIN_FONT_SIZE, bookControlLabelWrap } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
// `libraryGeometry` imports Phaser not at all — `LibraryScene` and `LibraryRenderer` both import it as
// a value, which is exactly why the room's layout lives in its own module (Story 2.8).
import {
    ARTIFACT_LABEL_PADDING,
    ARTIFACT_SPINE_WIDTH,
    GATE_LINE_FONT_SIZE,
    detailTextWrap,
    gateLineTextWrap,
    libraryArtifactLabelBand,
    libraryArtifactPlacements,
    libraryShelfBand
} from '../../src/adapters/phaser/scenes/libraryGeometry';
import {
    REFERENCE_CONTROL_FONT_SIZE,
    REFERENCE_CONTROL_LABEL_WRAP,
    REFERENCE_HEADING_FONT_SIZE,
    SIDE_COLUMN_WIDTH
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
// The bench itself (Story 2.10). Every one of these is a *fixed* rectangle — an instrument's readout
// slot, a wavelength choice, the start control, the notebook's own chrome — so each belongs in the
// whole-string sweep below as well as in the per-token one, and each reads its bound from the module
// that places it rather than from a literal that would drift.
import {
    BENCH_CONTROL_FONT_SIZE,
    BENCH_MESSAGE_FONT_SIZE,
    BENCH_MESSAGE_WRAP,
    INSTRUMENT_READOUT_FONT_SIZE,
    INSTRUMENT_READOUT_WRAP,
    NOTEBOOK_ACTION_FONT_SIZE,
    NOTEBOOK_ACTION_LABEL_WRAP,
    BENCH_CONTROL_LABEL_WRAP,
    NOTEBOOK_GUIDE_FONT_SIZE,
    NOTEBOOK_HEADING_FONT_SIZE,
    NOTEBOOK_NOTE_FONT_SIZE,
    NOTEBOOK_NOTE_TEXT_WRAP,
    NOTEBOOK_PADDING,
    NOTEBOOK_PAGE_CONTROL_WIDTH,
    NOTEBOOK_PANEL_WIDTH,
    NOTEBOOK_ROW_FONT_SIZE,
    NOTEBOOK_ROW_META_FONT_SIZE,
    NOTEBOOK_ROW_TEXT_WRAP,
    NOTEBOOK_STATUS_TEXT_WRAP,
    NOTEBOOK_SELECT_WIDTH,
    WAVELENGTH_CHOICE_FONT_SIZE,
    WAVELENGTH_CHOICE_LABEL_WRAP,
    WAVELENGTH_COLUMN_WIDTH,
    WAVELENGTH_HEADING_FONT_SIZE
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import {
    RIVAL_LAB_BODY_FONT_SIZE,
    RIVAL_LAB_CONTROL_FONT_SIZE,
    RIVAL_LAB_CONTROL_LABEL_WRAP,
    RIVAL_LAB_GUIDE_FONT_SIZE,
    RIVAL_LAB_HEADING_FONT_SIZE,
    RIVAL_LAB_SPEAKER_FONT_SIZE,
    RIVAL_LAB_STAGE_COLUMN_WIDTH,
    rivalLabTextWrapWidth
} from '../../src/adapters/phaser/renderers/RivalLabRenderer';
import {
    DIALOGUE_CONTROL_FONT_SIZE,
    DIALOGUE_CONTROL_LABEL_WRAP,
    DIALOGUE_COUNTER_FONT_SIZE,
    DIALOGUE_COUNTER_WRAP,
    DIALOGUE_BODY_FONT_SIZE,
    DIALOGUE_SPEAKER_FONT_SIZE,
    dialogueBodyWrapWidth,
    dialogueSpeakerWrapWidth
} from '../../src/adapters/phaser/ui/DialogueBox';
import {
    BODY_MAX_LINES,
    LIMITATION_MAX_LINES,
    PROPOSAL_ATTRIBUTION_FONT_SIZE,
    PROPOSAL_LIMITATION_FONT_SIZE,
    PROPOSAL_MARKER_FONT_SIZE,
    PROPOSAL_BODY_FONT_SIZE
} from '../../src/adapters/phaser/ui/ProposalChoice';
// The name-and-role plaque under each staged figure (Story 2.9). The role is the longest French label
// in the game after the prose, and it sits in a fixed slot — so it belongs in both sweeps.
import {
    FIGURE_BADGE_FONT_SIZE,
    FIGURE_NAME_FONT_SIZE,
    FIGURE_ROLE_FONT_SIZE,
    presentColleagueIds
} from '../../src/adapters/phaser/renderers/characterStageView';
import { FIGURE_STAGING_SCENE_KEYS } from '../../src/domain/cases/ScenarioScript';
import { KNOWN_CASE_IDS } from '../../src/schemas/CaseDefinitionSchema';

/**
 * AC4: French renders without missing glyphs or clipping at 1280×720.
 *
 * Measured rather than snapshotted. A screenshot baseline is brittle across CI font rendering, while
 * `CanvasRenderingContext2D.measureText` exercises exactly the text pipeline `Phaser.GameObjects.Text`
 * uses — Phaser draws through the canvas 2D API, so glyph resolution is the browser's, not Phaser's.
 */

// NFR1's viewport target (the 1024×768 canvas is mapped into it by Scale.FIT), and a French browser
// — which is the only way the interface language is chosen.
test.use({ viewport: { width: 1280, height: 720 }, locale: 'fr-FR' });

/** Every French-specific glyph the interface can render, plus the guillemets and the œ ligature. */
const FRENCH_GLYPHS = [...'éèêëàâçîïôûùÿœŒÉÈÊÀÂÇÎÏÔÛÙ«»’—'];

/**
 * Derived from the widgets and their hosts rather than restated as literals: these bounds are a
 * function of the surface width and the gutters the host actually passes, and a layout change that did
 * not update a hard-coded copy here would leave the check measuring against a bound the game no longer
 * uses.
 *
 * **The board's resolved bound, not the widget's default** (Story 2.9).
 *
 * The two are the same number today — the figures stand in the room rather than in a column carved out
 * of the cards — which is exactly why the indirection stays. `SUBMIT_WIDTH` and `ADVANCE_CONTROL_WIDTH`
 * were also the same number, right up until one of them moved and this file went on measuring a
 * rectangle nothing painted.
 *
 * The helper now resolves through `PROPOSAL_CARD_GUTTERS` — the same object the board hands the widget
 * — rather than calling `proposalTextWrapWidth(width)` with no gutters and returning the widget default
 * while claiming to be the board's bound. It was the failure it was written to prevent, in miniature
 * (2.9 review).
 */
const CARD_TEXT_WRAP_WIDTH = boardProposalTextWrapWidth();
const CARD_MARKER_WRAP = boardProposalMarkerWrap();
/**
 * Every case this build ships, from the route gate's own closed list rather than a second copy of it.
 * A third case joins the sweeps below by being added there, which is the point.
 */
const SHIPPED_CASE_IDS: readonly string[] = KNOWN_CASE_IDS;

/**
 * The slot one figure's plaque occupies: the proposal surface divided by the number of figures the
 * board actually stages — **the narrowest such slot across every shipped figure-staging scene**.
 *
 * It used to divide by `colleagues.length`, which was the same number only by accident. The renderer
 * divides by `presentColleagueIds(...).length`, and Story 3.4's authored `scenarioScript.scenes[].cast`
 * is what makes the two diverge: a scene may now stage a subset. `deferred-work.md` recorded that this
 * file would go on measuring a plaque slot nothing paints the moment that landed — "the failure mode
 * this file has already been patched for twice" — so the count now comes from the production rule.
 *
 * The **narrowest** slot, i.e. the largest staged count, because the narrow case is the one that clips
 * and the strings bounded by this are interface strings (`colleague.role.*`, `stage.speaking`) that
 * every case renders. Both shipped cases are swept for the same reason: a plaque bound is not Young's.
 */
const stagedFigureCounts = (): readonly number[] => SHIPPED_CASE_IDS.flatMap((caseId) => {
    const definition = JSON.parse(
        readFileSync(new URL(`../../public/cases/${caseId}/case.json`, import.meta.url), 'utf-8')
    ) as {
        colleagues: { id: string }[];
        predictionProposals: { colleagueId: string }[];
        conclusionProposals: { colleagueId: string }[];
        scenarioScript: { scenes: { phase: string; sceneKey: string; cast?: string[]; dialogueBeats?: { speakerId: string }[] }[] };
    };

    return definition.scenarioScript.scenes
        .filter(({ sceneKey }) => (FIGURE_STAGING_SCENE_KEYS as readonly string[]).includes(sceneKey))
        .map(({ phase, cast, dialogueBeats }) => presentColleagueIds({
            // Keyed on **phase**, which is how `stageCast` and `selectDialogueBeats` key it. This used
            // to select by scene key with a comment claiming the pairing was "asserted against the
            // source in `ScenarioAuthoringContract`" — no such assertion existed, and the schema
            // happily accepts a script routing `prediction` to `TheoryBoard`, at which point a
            // key-based lookup reads one board's proposals for the other's and this sweep bounds a
            // slot nothing paints. That is the defect this file has now been patched for three times.
            proposerIds: (phase === 'prediction' ? definition.predictionProposals : definition.conclusionProposals)
                .map(({ colleagueId }) => colleagueId),
            speakerIds: (dialogueBeats ?? []).map(({ speakerId }) => speakerId),
            castIds: definition.colleagues.map(({ id }) => id),
            authoredCast: cast
        }).length);
});

const stagedCounts = stagedFigureCounts();
// `Math.max()` of an empty list is `-Infinity`, which would make every bound below compare against a
// negative width and either fail uninterpretably or pass on nothing. Its sibling sweeps guard this
// shape three times over; this one did not.
if (stagedCounts.length === 0) throw new Error('No shipped case stages a figure column — the slot bound would be meaningless.');
const FIGURE_SLOT_WIDTH = PROPOSAL_SURFACE_WIDTH / Math.max(...stagedCounts);
/**
 * The dialogue panel is narrower than the surface since Story 2.9 — it shares its row with the control
 * column instead of stacking below it, which is what bought the room its height. Both bounds are
 * derived from the width the board actually passes the widget.
 */
const DIALOGUE_BODY_WRAP_WIDTH = dialogueBodyWrapWidth(DIALOGUE_PANEL_WIDTH);
const DIALOGUE_SPEAKER_WRAP_WIDTH = dialogueSpeakerWrapWidth(DIALOGUE_PANEL_WIDTH);
const RIVAL_LAB_TEXT_WRAP_WIDTH = rivalLabTextWrapWidth();

/**
 * How many references a shipped case puts on the shelf — the **most** any of them does.
 *
 * Read from the content, because every bound below that depends on it narrows as it grows. This was a
 * Young-only parse whose docstring was edited in Story 4.1 to read as if the count came from the
 * cross-case sweep; it did not (code review of 4.1). Harmless while both cases author two artifacts and
 * `MAX_CONTEXTUAL_ARTIFACTS` pins that at two — but it feeds `LIBRARY_ARTIFACT_LABEL_WRAP`, the
 * narrowest band in the room and the one the story's single mutation proof depends on, so it should not
 * be the one number here that is measured against a single case.
 *
 * Its own parse rather than `SHIPPED_CASES`, only because it is needed above the bounds table.
 */
const LIBRARY_ARTIFACT_COUNT = Math.max(...SHIPPED_CASE_IDS.map((caseId) => (JSON.parse(
    readFileSync(new URL(`../../public/cases/${caseId}/case.json`, import.meta.url), 'utf-8')
) as { contextualArtifacts: unknown[] }).contextualArtifacts.length));

/**
 * The reading room's bounds (Story 2.8), derived from `libraryGeometry` at the shipped canvas size.
 *
 * The geometry module takes the canvas size as arguments rather than closing over it (AC7), so this
 * spec has to supply it — from `designSurface.ts`, the module that states it once, and never as a
 * literal of its own. The 2.8 review found this file declaring a fresh `1024`/`768` pair in the same
 * commit that created `designSurface.ts` to stop exactly that, while `deferred-work.md` recorded the
 * item as fully closed.
 */
const LIBRARY_CANVAS_WIDTH = DESIGN_WIDTH;
const LIBRARY_CANVAS_HEIGHT = DESIGN_HEIGHT;
const LIBRARY_ROOM_WRAP = libraryShelfBand(LIBRARY_CANVAS_WIDTH).width;
const LIBRARY_DETAIL_WRAP = detailTextWrap(LIBRARY_CANVAS_WIDTH, LIBRARY_CANVAS_HEIGHT);
const LIBRARY_GATE_WRAP = gateLineTextWrap(LIBRARY_CANVAS_WIDTH);
/**
 * The title strip on an object, at the count the shipped case actually draws.
 *
 * The count comes from `case.json`, not from a literal: objects narrow as the count grows, so a case
 * that shipped three would leave this measuring a 218px bound against a room drawing 144px, and every
 * French title would clip while this check stayed green. `library-reading.spec.ts` reads the count the
 * same way.
 */
const LIBRARY_ARTIFACT_LABEL_WRAP = libraryArtifactLabelBand(
    libraryArtifactPlacements(LIBRARY_ARTIFACT_COUNT, LIBRARY_CANVAS_WIDTH)[0]!
).width;

/**
 * The board the read marker has to itself, right-anchored at the fore-edge.
 *
 * The marker carries no `wordWrap`, so the plaque's bound does not apply to it: what constrains it is
 * the width of the front board, less the inset it is anchored at. Measuring it against the plaque's
 * wrap — as this spec did — checked a bound the object never uses.
 */
const LIBRARY_READ_MARKER_BOUND = (() => {
    const placement = libraryArtifactPlacements(LIBRARY_ARTIFACT_COUNT, LIBRARY_CANVAS_WIDTH)[0]!;
    return placement.width - ARTIFACT_SPINE_WIDTH - ARTIFACT_LABEL_PADDING;
})();

/**
 * Every in-scene advance control, with the bound of the host that draws it (Story 2.7).
 *
 * **Three bounds, not one, and each is read from the host that draws it.** The laboratory's control
 * fills its side column; the two boards draw at `SUBMIT_WIDTH`, the width of the control column they
 * share with the submit control; the two placeholder shells take the widget's own default. The boards
 * and the default are the same number today, which is exactly why this table must not take the
 * default for them: `advanceControlLabelWrap()` and `boardAdvanceControlLabelWrap()` agreeing by
 * coincidence is how a narrowed submit column would keep this check green while the label clipped on
 * screen — the "two numbers that agree by accident" failure this file exists to make impossible.
 *
 * This list replaces the single `lab.advance` entry. It is the same control, six times over.
 */
const ADVANCE_CONTROLS = [
    { key: 'advance.toColleagues', bound: advanceControlLabelWrap() },
    { key: 'advance.toBench', bound: boardAdvanceControlLabelWrap('prediction') },
    { key: 'advance.toTheoryBoard', bound: ADVANCE_CONTROL_LABEL_WRAP },
    { key: 'advance.toReviewers', bound: boardAdvanceControlLabelWrap('conclusion') },
    { key: 'advance.closeTheCase', bound: boardAdvanceControlLabelWrap('conclusion') },
    { key: 'advance.replay', bound: advanceControlLabelWrap() }
] as const;

/**
 * Each wrapped Phaser `Text` that holds authored French copy, with the wrap bound and font size
 * declared in the renderer. Phaser word-wrap cannot break inside a word, so a single token wider
 * than its bound is the overflow that actually clips.
 */
const WRAPPED_SURFACES = [
    ...ADVANCE_CONTROLS.map(({ key, bound }) => ({
        key, font: UI_FONT_STACK, fontSize: ADVANCE_CONTROL_FONT_SIZE, wrapWidth: bound
    })),
    { key: 'lab.guide', font: UI_FONT_STACK, fontSize: 15, wrapWidth: 900 },
    { key: 'lab.result.emptyHint', font: UI_FONT_STACK, fontSize: 19, wrapWidth: BENCH_MESSAGE_WRAP },
    { key: 'lab.result.recorded', font: UI_FONT_STACK, fontSize: 19, wrapWidth: BENCH_MESSAGE_WRAP },
    { key: 'lab.result.stale', font: UI_FONT_STACK, fontSize: 19, wrapWidth: BENCH_MESSAGE_WRAP },
    // The wavelength-free readout, for a case whose model records no optical inputs (Story 3.2).
    { key: 'lab.result.recordedPlain', font: UI_FONT_STACK, fontSize: 19, wrapWidth: BENCH_MESSAGE_WRAP },
    // `lab.preview` became `lab.idle` in Story 2.10: the painted fringe preview it promised is gone —
    // AC4 forbids a screen pattern before a run — and the sentence is now the in-scene invitation to
    // start the light.
    { key: 'lab.idle', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 620 },
    // One per authored control, composed into `lab.idle` and into the notebook row (Story 3.2). The
    // sentence used to name Young's two quantities in its own template; the settings are now a list
    // over `apparatus.primaryControls`, so the fragment is what carries a bound rather than the sentence.
    { key: 'lab.idle.setting', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 620 },
    { key: 'lab.running', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 620 },
    { key: 'lab.pattern.recorded', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 620 },
    // The readout is bounded by its **instrument's slot**, not by the bench: one wrapped at the bench's
    // width would run straight under the neighbouring knob. It was 330 against the retired step-button
    // row, which is a bound nothing draws any more.
    { key: 'lab.control.readout', font: UI_FONT_STACK, fontSize: INSTRUMENT_READOUT_FONT_SIZE, wrapWidth: INSTRUMENT_READOUT_WRAP },
    // The bench's own chrome and its refusal slot (Story 2.10).
    { key: 'lab.wavelength.heading', font: UI_FONT_STACK, fontSize: WAVELENGTH_HEADING_FONT_SIZE, wrapWidth: WAVELENGTH_COLUMN_WIDTH },
    { key: 'error.advanced-wavelength-locked', font: UI_FONT_STACK, fontSize: BENCH_MESSAGE_FONT_SIZE, wrapWidth: BENCH_MESSAGE_WRAP },
    { key: 'error.experiment-phase-required', font: UI_FONT_STACK, fontSize: BENCH_MESSAGE_FONT_SIZE, wrapWidth: BENCH_MESSAGE_WRAP },
    // The bench notebook overlay (Story 2.10, AC8).
    { key: 'notebook.heading', font: UI_FONT_STACK, fontSize: NOTEBOOK_HEADING_FONT_SIZE, wrapWidth: NOTEBOOK_PANEL_WIDTH - (2 * NOTEBOOK_PADDING) },
    { key: 'notebook.guide', font: UI_FONT_STACK, fontSize: NOTEBOOK_GUIDE_FONT_SIZE, wrapWidth: NOTEBOOK_PANEL_WIDTH - (2 * NOTEBOOK_PADDING) },
    { key: 'notebook.empty', font: UI_FONT_STACK, fontSize: NOTEBOOK_GUIDE_FONT_SIZE, wrapWidth: NOTEBOOK_PANEL_WIDTH - (2 * NOTEBOOK_PADDING) },
    { key: 'notebook.observation', font: UI_FONT_STACK, fontSize: NOTEBOOK_ROW_FONT_SIZE, wrapWidth: NOTEBOOK_ROW_TEXT_WRAP },
    // The separator alone is three characters; measuring it was not coverage of the row it joins. The
    // composed row is swept as a literal below, because it is built from `case.json` rather than from a
    // single bundle key (review 2026-08-19).
    { key: 'notebook.row.settingsSeparator', font: UI_FONT_STACK, fontSize: NOTEBOOK_ROW_FONT_SIZE, wrapWidth: NOTEBOOK_ROW_TEXT_WRAP },
    { key: 'notebook.row.result', font: UI_FONT_STACK, fontSize: NOTEBOOK_ROW_META_FONT_SIZE, wrapWidth: NOTEBOOK_ROW_TEXT_WRAP },
    { key: 'notebook.row.meta', font: UI_FONT_STACK, fontSize: NOTEBOOK_ROW_META_FONT_SIZE, wrapWidth: NOTEBOOK_ROW_TEXT_WRAP },
    { key: 'notebook.note.label', font: UI_FONT_STACK, fontSize: NOTEBOOK_GUIDE_FONT_SIZE, wrapWidth: NOTEBOOK_NOTE_TEXT_WRAP },
    { key: 'notebook.note.empty', font: UI_FONT_STACK, fontSize: NOTEBOOK_NOTE_FONT_SIZE, wrapWidth: NOTEBOOK_NOTE_TEXT_WRAP },
    // Both of these are drawn **into the note field**, by `renderNote`, at the note field's own size —
    // not at the row-meta size this sweep used to measure `pairRequired` at (review 2026-08-07). One
    // string measured at a size nothing draws it in is a bound that does not describe the surface.
    { key: 'notebook.pairRequired', font: UI_FONT_STACK, fontSize: NOTEBOOK_NOTE_FONT_SIZE, wrapWidth: NOTEBOOK_NOTE_TEXT_WRAP },
    { key: 'book.caption.spread', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 770 },
    { key: 'book.caption.summary', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 770 },
    { key: 'book.summary.heading', font: BOOK_FONT_STACK, fontSize: 20, wrapWidth: 770 },
    { key: 'book.sourcePage.many', font: UI_FONT_STACK, fontSize: 12, wrapWidth: 372 },
    { key: 'book.printedPage', font: BOOK_FONT_STACK, fontSize: 14, wrapWidth: 372 },
    // Colleague cast and proposals (Story 1.11). The bounds are `ColleagueRenderer`'s: the chrome
    // wraps at the full card width, everything inside a card at `TEXT_WRAP_WIDTH`, and the choice
    // marker at its own narrow right-hand column.
    // All four narrower than the surface: Story 2.5 gave the conclusion heading's row to the submit
    // control, and Story 2.7 turned that into a permanent right-hand control column on **both** boards,
    // so every heading and guide now wraps against what is left rather than running underneath it.
    { key: 'colleagues.heading', font: UI_FONT_STACK, fontSize: 25, wrapWidth: BOARD_TEXT_WRAP },
    { key: 'colleagues.guide', font: UI_FONT_STACK, fontSize: 15, wrapWidth: BOARD_TEXT_WRAP },
    { key: 'theoryBoard.heading', font: UI_FONT_STACK, fontSize: 25, wrapWidth: BOARD_TEXT_WRAP },
    { key: 'theoryBoard.guide', font: UI_FONT_STACK, fontSize: 15, wrapWidth: BOARD_TEXT_WRAP },
    { key: 'theoryBoard.submit', font: UI_FONT_STACK, fontSize: SUBMIT_CONTROL_FONT_SIZE, wrapWidth: SUBMIT_CONTROL_LABEL_WRAP },
    // Rival lab (Story 2.5). The prose wraps against the surface less the accent column; the revise
    // control is a fixed hit target, so its label is bounded by the control rather than by the surface.
    { key: 'rivalLab.heading', font: UI_FONT_STACK, fontSize: RIVAL_LAB_HEADING_FONT_SIZE, wrapWidth: RIVAL_LAB_TEXT_WRAP_WIDTH },
    { key: 'rivalLab.guide', font: UI_FONT_STACK, fontSize: RIVAL_LAB_GUIDE_FONT_SIZE, wrapWidth: RIVAL_LAB_TEXT_WRAP_WIDTH },
    { key: 'rivalLab.role', font: UI_FONT_STACK, fontSize: RIVAL_LAB_SPEAKER_FONT_SIZE, wrapWidth: RIVAL_LAB_TEXT_WRAP_WIDTH },
    { key: 'rivalLab.revise', font: UI_FONT_STACK, fontSize: RIVAL_LAB_CONTROL_FONT_SIZE, wrapWidth: RIVAL_LAB_CONTROL_LABEL_WRAP },
    // The card bound, which is the tighter of the two places an attribution line is drawn. The dialogue
    // speaker line is measured against its own narrower bound in the authored-beat test below, because
    // this table is keyed by translation key and cannot hold two bounds for one key.
    { key: 'colleague.attribution', font: UI_FONT_STACK, fontSize: PROPOSAL_ATTRIBUTION_FONT_SIZE, wrapWidth: CARD_TEXT_WRAP_WIDTH },
    { key: 'colleague.unattributed', font: UI_FONT_STACK, fontSize: PROPOSAL_ATTRIBUTION_FONT_SIZE, wrapWidth: CARD_TEXT_WRAP_WIDTH },
    // The dialogue speaker slot's own fallback, which is a different string from the card's above.
    { key: 'colleague.unattributedSpeaker', font: UI_FONT_STACK, fontSize: DIALOGUE_SPEAKER_FONT_SIZE, wrapWidth: DIALOGUE_SPEAKER_WRAP_WIDTH },
    { key: 'proposal.limitation', font: UI_FONT_STACK, fontSize: PROPOSAL_LIMITATION_FONT_SIZE, wrapWidth: CARD_TEXT_WRAP_WIDTH },
    { key: 'proposal.selected', font: UI_FONT_STACK, fontSize: PROPOSAL_MARKER_FONT_SIZE, wrapWidth: CARD_MARKER_WRAP },
    { key: 'proposal.choose', font: UI_FONT_STACK, fontSize: PROPOSAL_MARKER_FONT_SIZE, wrapWidth: CARD_MARKER_WRAP },
    // The role on each figure's plaque. `colleague.role.builder` is the longest of the four in French
    // and the plaque's slot is fixed, so this is the bound most likely to clip on the whole surface.
    { key: 'colleague.role.lead', font: UI_FONT_STACK, fontSize: FIGURE_ROLE_FONT_SIZE, wrapWidth: FIGURE_SLOT_WIDTH },
    { key: 'colleague.role.builder', font: UI_FONT_STACK, fontSize: FIGURE_ROLE_FONT_SIZE, wrapWidth: FIGURE_SLOT_WIDTH },
    { key: 'colleague.role.analyst', font: UI_FONT_STACK, fontSize: FIGURE_ROLE_FONT_SIZE, wrapWidth: FIGURE_SLOT_WIDTH },
    { key: 'colleague.role.communicator', font: UI_FONT_STACK, fontSize: FIGURE_ROLE_FONT_SIZE, wrapWidth: FIGURE_SLOT_WIDTH },
    // Dialogue widget chrome (Story 1.12). The advance control is a fixed hit target, so its label is
    // bounded by the control rather than by the panel; the counter has its own narrow column.
    { key: 'dialogue.advance', font: UI_FONT_STACK, fontSize: DIALOGUE_CONTROL_FONT_SIZE, wrapWidth: DIALOGUE_CONTROL_LABEL_WRAP },
    { key: 'dialogue.end', font: UI_FONT_STACK, fontSize: DIALOGUE_CONTROL_FONT_SIZE, wrapWidth: DIALOGUE_CONTROL_LABEL_WRAP },
    { key: 'dialogue.counter', font: UI_FONT_STACK, fontSize: DIALOGUE_COUNTER_FONT_SIZE, wrapWidth: DIALOGUE_COUNTER_WRAP },
    // The reading room (Story 2.8). The chrome wraps at the shelf's own width; the detail panel's
    // metadata rows and the colleague's gate line each wrap at their band's derived bound. Every one
    // of these bounds is read from `libraryGeometry`, which is Phaser-free precisely so this spec can.
    { key: 'library.heading', font: UI_FONT_STACK, fontSize: HEADING_FONT_SIZE, wrapWidth: LIBRARY_ROOM_WRAP },
    { key: 'library.guide', font: UI_FONT_STACK, fontSize: GUIDE_FONT_SIZE, wrapWidth: LIBRARY_ROOM_WRAP },
    { key: 'library.detail.creator', font: UI_FONT_STACK, fontSize: DETAIL_META_FONT_SIZE, wrapWidth: LIBRARY_DETAIL_WRAP },
    { key: 'library.detail.classification', font: UI_FONT_STACK, fontSize: DETAIL_META_FONT_SIZE, wrapWidth: LIBRARY_DETAIL_WRAP },
    { key: 'library.detail.rights', font: UI_FONT_STACK, fontSize: DETAIL_META_FONT_SIZE, wrapWidth: LIBRARY_DETAIL_WRAP },
    { key: 'library.artifact.unavailable', font: UI_FONT_STACK, fontSize: GATE_LINE_FONT_SIZE, wrapWidth: LIBRARY_GATE_WRAP },
    { key: 'library.artifact.noRendition', font: UI_FONT_STACK, fontSize: GATE_LINE_FONT_SIZE, wrapWidth: LIBRARY_GATE_WRAP },
    // The bench's reference shelf heading, in the laboratory's side column.
    { key: 'lab.reference.heading', font: UI_FONT_STACK, fontSize: REFERENCE_HEADING_FONT_SIZE, wrapWidth: SIDE_COLUMN_WIDTH },
    // The read marker on an object's corner. It is created with **no** `wordWrap` and anchored to the
    // fore-edge, so the plaque's wrap bound was never its constraint — it is measured against the clear
    // board between the spine and the corner it sits in, which is the bound it actually has.
    { key: 'library.artifact.read', font: UI_FONT_STACK, fontSize: ARTIFACT_READ_FONT_SIZE, wrapWidth: LIBRARY_READ_MARKER_BOUND }
] as const;

/** Book controls are a fixed hit-test width and shrink to fit down to 10px before they would clip. */
const BOOK_CONTROLS = ['book.previous', 'book.next', 'book.close', 'book.summary.show', 'book.summary.close'] as const;

/**
 * The runtime values that fill each interpolated surface. Measuring the raw `{label}` / `{value}`
 * tokens would be a guaranteed pass that says nothing: the string that actually clips is
 * `"Écartement des fentes : 0,25 mm"`, not `{label}`. Authored source names come from `case.json`
 * so this cannot drift from the content, and the measurement values carry the real U+202F separator
 * `formatMeasurement` emits in French.
 */
type ShippedCase = {
    contextualArtifacts: { id: string; displayName: { en: string; fr: string }; caseRelationship: { en: string; fr: string } }[];
    readingGateHints: { id: string; line: { en: string; fr: string } }[];
    colleagueHints: { id: string; line: { en: string; fr: string } }[];
    apparatus: { primaryControls: { label: { fr: string }; inlineLabel: { fr: string } }[] };
    // The bench's authored wavelengths and its model version, both of which reach a fixed-height
    // label or a fixed row on the notebook (Story 2.10).
    experiment: {
        modelVersion: string;
        wavelengthComparison?: { fixedMinimumPathNm: number; advancedChoicesNm: number[] };
    };
    colleagues: { id: string; name: string; role: 'lead' | 'builder' | 'analyst' | 'communicator' }[];
    rivalLab: { name: string; critiques: { id: string; line: { en: string; fr: string } }[] };
    predictionProposals: { text: { en: string; fr: string } }[];
    conclusionProposals: { claim: { en: string; fr: string }; limitation: { en: string; fr: string } }[];
    scenarioScript: { scenes: { phase: string; dialogueBeats?: { id: string; text: { en: string; fr: string } }[] }[] };
    // The three blocks Story 4.1 rewrote and no sweep read (code review of 4.1). AC7 names "the debrief
    // prose" explicitly, and the debrief's comparison and summary are the two surfaces the story's own
    // Debug Log records as having overrun their bands — found by eye, because nothing measured them.
    debrief: {
        summary: { en: string; fr: string };
        historicalComparison: { title: { en: string; fr: string }; text: { en: string; fr: string } };
        deeperTheory: { title: { en: string; fr: string }; text: { en: string; fr: string } };
    };
    consultationRules: {
        id: string;
        layers: {
            observation: { en: string; fr: string };
            plainLanguage: { en: string; fr: string };
            technicalDetail: { en: string; fr: string };
        };
    }[];
};

/**
 * **Every shipped case, not Young alone (Story 4.1, AC7).**
 *
 * Until this story every content sample below derived from one Young-only parse, so the prototype's
 * authored prose was bilingual and schema-validated and measured against no band — while 3.2's own
 * review had already caught a French readiness line at 425px in a 372px column, exactly the class this
 * sweep exists to catch. `project-context.md` §Testing named this file, and named this story as owner.
 *
 * The shape is the one this file already used twice, for `CASE_TITLES` and `stagedFigureCounts`:
 * iterate `SHIPPED_CASE_IDS` — which *is* `KNOWN_CASE_IDS`, so a third case joins these sweeps by being
 * added there — and carry the case id into every sample label, so a failure names which case overflowed
 * instead of leaving a reviewer to grep for the string.
 *
 * The bounds do **not** become per-case, and must not: a wrap width is a property of the widget, not of
 * the content, so one bound measured against every case's prose is the point rather than a compromise.
 */
const SHIPPED_CASES: readonly { caseId: string; definition: ShippedCase }[] = SHIPPED_CASE_IDS.map((caseId) => ({
    caseId,
    definition: JSON.parse(
        readFileSync(new URL(`../../public/cases/${caseId}/case.json`, import.meta.url), 'utf-8')
    ) as ShippedCase
}));

/**
 * Every authored string of one kind, across every case, for a `longestFrench`-style reduction.
 *
 * Only for the samples that fill an *interpolated interface key*, where one representative string is
 * what the surface holds. Every sample that is authored prose in its own right is swept string by
 * string instead — `longestFrench` by character count is not enough where the pass condition is
 * per-token pixel width, which this file records twice.
 */
const allAcrossCases = (select: (definition: ShippedCase) => readonly string[]): readonly string[] =>
    SHIPPED_CASES.flatMap(({ definition }) => select(definition));

/**
 * One authored bilingual list per case, flattened into labelled samples in both locales.
 *
 * Both locales for the reason this file states at the dialogue beats: the pass condition is per-token
 * pixel width and an unbreakable token overflows in whatever language it was written, and width
 * measurement does not depend on the page locale.
 */
const bilingualAcrossCases = <T>(
    select: (definition: ShippedCase) => readonly T[],
    // The index is passed as well as the item, and it is not decoration: dropping it was how the
    // cross-case conversion left two overflowing proposals of the same case printing the *same* label
    // (code review of 4.1), which defeats the reason the case id was threaded through in the first
    // place — a reviewer is back to grepping for the string inside the case.
    describe: (item: T, index: number) => string,
    line: (item: T) => { en: string; fr: string }
): readonly { label: string; text: string }[] => SHIPPED_CASES.flatMap(({ caseId, definition }) =>
    select(definition).flatMap((item, index) => (['fr', 'en'] as const).map((locale) => ({
        label: `${caseId} ${describe(item, index)} [${locale}]`,
        text: line(item)[locale]
    }))));

/**
 * Whitespace Phaser may wrap at — everything except the no-break spaces. French keeps `0,25` and its
 * unit on one line with U+202F, so `"0,25 mm"` is a single unbreakable token and must be measured as
 * one; a plain `\s+` split would quietly halve it.
 */
const BREAKABLE_WHITESPACE = /[^\S\u00A0\u202F]+/;

const longestFrench = (values: readonly string[]): string =>
    values.reduce((longest, value) => (value.length > longest.length ? value : longest), '');

/**
 * **Every case's string, not the longest one across cases (code review of 4.1).**
 *
 * Story 4.1 converted these from a Young-only parse to `longestFrench(allAcrossCases(...))`, which
 * reads as cross-case coverage and is not: `longestFrench` reduces to **one** string by character
 * count, and Young wins every one of these six — control label 21 characters against 19, inline label
 * 23 against 22, the composed idle clause 63 against 60, the notebook row 62 against 58, source name
 * 56 against 43, limitations 143 against 125. The extension was therefore a byte-for-byte no-op for
 * the prototype, whose widest single token (`Température`, 11) is *wider* than Young's (`Écartement`,
 * 10) and was measured by nothing at all. That is why the extended sweep reported no overflow on the
 * case it had just been extended to cover (code review of 4.1).
 *
 * This is the defect this file already records twice — "`longestFrench` by character count is not
 * enough where the pass condition is per-token pixel width" — so the fix is the rule the file already
 * states: keep every string and let the per-token split measure them all. `SAMPLE_PARAMS` therefore
 * holds an **array** of parameter sets per key and `fillParams` returns one filled string per set.
 */
const SOURCE_NAMES = allAcrossCases(({ contextualArtifacts }) => contextualArtifacts.map(({ displayName }) => displayName.fr));
const CONTROL_LABELS = allAcrossCases(({ apparatus }) => apparatus.primaryControls.map(({ label }) => label.fr));
/**
 * The widest authored *inline* label, and the whole composed settings clause.
 *
 * `lab.idle` was sampled as `` `${CONTROL_LABEL} : 0,25 mm` `` with a comment claiming it was "the same
 * shape `ApparatusRenderer` builds from `apparatus.primaryControls`". It was not: that is
 * `lab.control.readout`'s shape, reversed, and it carried **one** control where the renderer joins one
 * fragment per authored control. The sampled string was roughly half the length of the sentence that
 * actually renders, so the 620px bound was never exercised against it (review 2026-08-19).
 */
const CONTROL_INLINE_LABELS = allAcrossCases(({ apparatus }) => apparatus.primaryControls.map(({ inlineLabel }) => inlineLabel.fr));
/** One composed clause **per case** — the sentence `ApparatusRenderer` builds from that case's own controls. */
const IDLE_SETTINGS_CLAUSES = SHIPPED_CASES.map(({ definition }) => definition.apparatus.primaryControls
    .map(({ inlineLabel }) => `0,25 mm ${inlineLabel.fr}`)
    .join(fr['list.separator']));
/** Every shipped case's authored title, in both locales — the surface that replaced `lab.title`. */
const CASE_TITLES = SHIPPED_CASE_IDS.flatMap((caseId) => {
    const definition = JSON.parse(
        readFileSync(new URL(`../../public/cases/${caseId}/case.json`, import.meta.url), 'utf-8')
    ) as { title: { en: string; fr: string } };
    return (['en', 'fr'] as const).map((locale) => ({ caseId, locale, text: definition.title[locale] }));
});

/** The notebook's settings row: one readout per authored control, at the row's own size and wrap. */
const NOTEBOOK_SETTINGS_ROWS = SHIPPED_CASES.map(({ caseId, definition }) => ({
    caseId,
    row: definition.apparatus.primaryControls
        .map(({ label }) => `${label.fr} : 0,25 mm`)
        .join(fr['notebook.row.settingsSeparator'])
}));
const SPACING = '0,2200 mm';

const COLLEAGUE_NAMES = allAcrossCases(({ colleagues }) => colleagues.map(({ name }) => name));
/**
 * Every colleague's name at the size and slot the **figure plaque** draws it (Story 2.9).
 *
 * Not an entry in `WRAPPED_SURFACES`: that table is keyed by translation key and cannot hold two
 * bounds for one key, and `colleague.unattributedSpeaker` already sits there against the *dialogue*
 * speaker slot. These are authored proper nouns rather than interface copy anyway, so they belong with
 * the rest of the content sweep.
 */
const FIGURE_PLAQUE_NAMES = SHIPPED_CASES.flatMap(({ caseId, definition }) =>
    definition.colleagues.map(({ name }) => ({ label: `${caseId} colleague`, text: name })));
const ROLE_LABEL = longestFrench([
    fr['colleague.role.lead'], fr['colleague.role.builder'], fr['colleague.role.analyst'], fr['colleague.role.communicator']
]);
/**
 * The authored copy the proposal cards actually hold. Measuring only the interface keys would miss
 * the strings most likely to overflow — a French conclusion claim is the longest run of text on the
 * theory board, and it lives in `case.json`, not in `fr.ts`.
 *
 * *Every* proposal, not the longest one per set: the pass condition below is per-token width, and the
 * widest unbreakable token has no reason to live in the longest string. Sampling by character count
 * let a short proposal carrying one long token through unmeasured.
 */
const PROPOSAL_TEXTS = bilingualAcrossCases(({ predictionProposals }) => predictionProposals, (_, index) => `prediction text ${index + 1}`, ({ text }) => text);
const CONCLUSION_CLAIMS = bilingualAcrossCases(({ conclusionProposals }) => conclusionProposals, (_, index) => `conclusion claim ${index + 1}`, ({ claim }) => claim);
const CONCLUSION_LIMITATIONS = bilingualAcrossCases(({ conclusionProposals }) => conclusionProposals, (_, index) => `conclusion limitation ${index + 1}`, ({ limitation }) => limitation);
/** French only, for the `proposal.limitation` template — every one of them, not a representative. */
const FRENCH_LIMITATIONS = allAcrossCases(({ conclusionProposals }) => conclusionProposals.map(({ limitation }) => limitation.fr));

/**
 * Every authored dialogue beat, flattened across the scenes that author one, **in both locales**.
 *
 * Read from `case.json` for the same reason the proposal copy is: the strings most likely to overflow the
 * dialogue panel are the authored beats, and they live in the case, not in `fr.ts`.
 *
 * English as well as French, which this spec did not do before the 1.12 review. Its whole reason to
 * exist is French, but the pass condition is *per-token pixel width* and an unbreakable token overflows
 * whatever language it is written in — a URL, a hyphen-free compound, an instrument name. Measuring only
 * `text.fr` left every English beat unchecked by the entire suite, since no other spec measures text at
 * all. Width measurement does not depend on the page locale, so both fit in this one pass.
 */
/**
 * The debrief's authored prose, and the case file's consultation layers — every case, both locales.
 *
 * AC7 enumerates "the debrief prose" and the sweep read none of it, for either case (code review of
 * 4.1). That is the surface the story's own Debug Log records as having overrun: the French historical
 * comparison and the summary were both authored down after being caught **by eye**, which is the check
 * this file exists to replace for everything a width bound can decide.
 *
 * Width only, and the distinction matters. A per-token width bound is what this sweep can prove; how
 * many *lines* the wrapped prose then occupies inside `DEBRIEF_COMPARISON_BAND_HEIGHT` is a height
 * claim, and this file's own rule is that a height claim proven in the structural harness is an
 * assertion about arithmetic rather than about what is painted. So the reserve stays the guarantee and
 * the eye stays the check for it; what is automated here is that no single token can overflow.
 */
const DEBRIEF_PROSE = SHIPPED_CASES.flatMap(({ caseId, definition: { debrief } }) =>
    (['fr', 'en'] as const).flatMap((locale) => [
        { label: `${caseId} debrief summary [${locale}]`, fontSize: DEBRIEF_SUMMARY_FONT_SIZE, text: debrief.summary[locale] },
        { label: `${caseId} debrief comparison title [${locale}]`, fontSize: DEBRIEF_SECTION_TITLE_FONT_SIZE, text: debrief.historicalComparison.title[locale] },
        { label: `${caseId} debrief comparison text [${locale}]`, fontSize: DEBRIEF_BODY_FONT_SIZE, text: debrief.historicalComparison.text[locale] },
        { label: `${caseId} debrief deeper-theory title [${locale}]`, fontSize: DEBRIEF_SECTION_TITLE_FONT_SIZE, text: debrief.deeperTheory.title[locale] },
        { label: `${caseId} debrief deeper-theory text [${locale}]`, fontSize: DEBRIEF_BODY_FONT_SIZE, text: debrief.deeperTheory.text[locale] }
    ]));

/**
 * The consultation layers, which render as three joined lines in the case file's right column.
 *
 * Added with the debrief prose and for the same reason: Story 4.1 rewrote a `layers.observation` in
 * both locales and nothing measured it. The review of 4.1 also found a stale `plainLanguage` here that
 * still described a retired artifact — a content defect a width sweep cannot catch, which is precisely
 * why the sweep should at least be measuring the field.
 */
const CONSULTATION_LAYERS = SHIPPED_CASES.flatMap(({ caseId, definition }) =>
    definition.consultationRules.flatMap(({ id, layers }) =>
        (['observation', 'plainLanguage', 'technicalDetail'] as const).flatMap((layer) =>
            (['fr', 'en'] as const).map((locale) => ({
                label: `${caseId} ${id} ${layer} [${locale}]`, text: layers[layer][locale]
            })))));

const DIALOGUE_BEATS = SHIPPED_CASES.flatMap(({ caseId, definition }) =>
    definition.scenarioScript.scenes.flatMap(({ phase, dialogueBeats }) =>
        (dialogueBeats ?? []).flatMap(({ id, text }) => [
            { label: `${caseId} ${phase} beat ${id} [fr]`, text: text.fr },
            { label: `${caseId} ${phase} beat ${id} [en]`, text: text.en }
        ])));
/**
 * Every authored rival-lab critique, in both locales, for the same reason the dialogue beats are swept
 * that way: the pass condition is per-token pixel width, and an unbreakable token overflows in whatever
 * language it was written. These are the longest single runs of prose on any surface in the game.
 */
const RIVAL_LAB_CRITIQUES = bilingualAcrossCases(
    ({ rivalLab }) => rivalLab.critiques,
    ({ id }) => `rival-lab critique ${id}`,
    ({ line }) => line
);
/**
 * Every authored colleague hint, in both locales (Story 2.6).
 *
 * Added in review: the hints shipped as the sixth authored-prose surface and the first to skip this
 * sweep, though `HINT_TEXT_WRAP` is the *narrowest* prose bound in the game — narrower than the
 * proposal cards, the dialogue panel, and the rival lab. Each of those joined the sweep with the
 * story that introduced it, and each joined it because a review found the gap.
 */
const COLLEAGUE_HINTS = bilingualAcrossCases(
    ({ colleagueHints }) => colleagueHints,
    ({ id }) => `colleague hint ${id}`,
    ({ line }) => line
);

/**
 * Every authored reading-gate line, in both locales (Story 2.8).
 *
 * The seventh authored-prose surface, joining this sweep with the story that introduces it rather than
 * with the review that would otherwise have found the gap — which is how the previous six arrived.
 */
const READING_GATE_LINES = bilingualAcrossCases(
    ({ readingGateHints }) => readingGateHints,
    ({ id }) => `reading-gate line ${id}`,
    ({ line }) => line
);

/**
 * Every authored artifact display name and case relationship, in both locales (Story 2.8).
 *
 * These were content nothing measured: `SOURCE_NAME` fed one interpolated interface key and nothing
 * checked the names against the surfaces that now draw them directly. The reading room draws each name
 * twice — once in a title strip on the object, which is the narrowest bound in the game, and once at
 * the head of the detail panel — and the bench's reference shelf draws it a third time.
 */
const LIBRARY_ARTIFACT_TEXTS = SHIPPED_CASES.flatMap(({ caseId, definition }) =>
    definition.contextualArtifacts.flatMap(({ id, displayName, caseRelationship }) => [
        { label: `${caseId} artifact name ${id} [fr]`, text: displayName.fr, wrapWidth: LIBRARY_ARTIFACT_LABEL_WRAP, fontSize: ARTIFACT_LABEL_FONT_SIZE },
        { label: `${caseId} artifact name ${id} [en]`, text: displayName.en, wrapWidth: LIBRARY_ARTIFACT_LABEL_WRAP, fontSize: ARTIFACT_LABEL_FONT_SIZE },
        { label: `${caseId} artifact name ${id} on the bench [fr]`, text: displayName.fr, wrapWidth: REFERENCE_CONTROL_LABEL_WRAP, fontSize: REFERENCE_CONTROL_FONT_SIZE },
        { label: `${caseId} artifact relationship ${id} [fr]`, text: caseRelationship.fr, wrapWidth: LIBRARY_DETAIL_WRAP, fontSize: DETAIL_RELATIONSHIP_FONT_SIZE },
        { label: `${caseId} artifact relationship ${id} [en]`, text: caseRelationship.en, wrapWidth: LIBRARY_DETAIL_WRAP, fontSize: DETAIL_RELATIONSHIP_FONT_SIZE }
    ]));

const LONGEST_CONVERSATION = Math.max(
    1,
    ...SHIPPED_CASES.flatMap(({ definition }) =>
        definition.scenarioScript.scenes.map(({ dialogueBeats }) => dialogueBeats?.length ?? 0))
);

/**
 * The widest authored wavelength, for the chooser's three fixed-height labels.
 *
 * Read from `experiment.wavelengthComparison` rather than written as 650: a case authoring a
 * four-digit comparison would widen every one of those labels, and a literal here would go on
 * measuring the case that used to ship.
 */
const WAVELENGTH_SAMPLE = Math.max(
    ...SHIPPED_CASES.flatMap(({ definition }) => [
        definition.experiment.wavelengthComparison?.fixedMinimumPathNm ?? 550,
        ...(definition.experiment.wavelengthComparison?.advancedChoicesNm ?? [])
    ])
);

// `notebookReadout` lived here until Story 3.2. The settings row no longer has a template of its own:
// it is one `lab.control.readout` per authored control joined by `notebook.row.settingsSeparator`, and
// both of those are swept above at this surface's own size — so the composed row's widest token is
// already measured, by the entry that owns it.

/**
 * The parameter sets each interpolated key is measured with — **an array per key, not one set**.
 *
 * One set per key measured one string, which is why six cross-case samples above collapsed to Young
 * (code review of 4.1). A key whose content varies by case now carries one set per case, and
 * `fillParams` returns one filled string per set so the existing per-token split measures every one.
 */
const SAMPLE_PARAMS: Readonly<Record<string, readonly Readonly<Record<string, string | number>>[]>> = {
    'lab.result.recorded': [{ value: SPACING, wavelength: 550, mode: fr['lab.wavelengthMode.minimum'] }],
    'lab.result.stale': [{ value: SPACING }],
    // The composed settings clause: one `lab.idle.setting` per authored control, joined with
    // `list.separator` — the shape `ApparatusRenderer` actually builds. This was
    // `` `${CONTROL_LABEL} : 0,25 mm` ``, which is `lab.control.readout`'s shape reversed and carried
    // one control where the renderer joins all of them, so the 620px bound was never exercised against
    // the sentence that renders (review 2026-08-19).
    'lab.idle': IDLE_SETTINGS_CLAUSES.map((settings) => ({ settings })),
    // `inlineLabel`, not `label`: the template takes the authored inline form now, and a stale `label`
    // key here would leave `{inlineLabel}` unsubstituted and measure the placeholder.
    'lab.idle.setting': CONTROL_INLINE_LABELS.map((inlineLabel) => ({ value: '0,25 mm', inlineLabel })),
    'lab.pattern.recorded': [{ label: fr['experiment.result.fringeSpacing'], value: SPACING }],
    'lab.control.readout': CONTROL_LABELS.map((label) => ({ label, value: '0,25 mm' })),
    'lab.wavelength.fixed': [{ value: WAVELENGTH_SAMPLE }],
    'lab.wavelength.comparison': [{ value: WAVELENGTH_SAMPLE }],
    'lab.wavelength.comparisonLocked': [{ value: WAVELENGTH_SAMPLE }],
    'notebook.observation': [{ order: 12 }],
    // AC7's two counted readiness lines. Measuring the bare `{count}` token would be a guaranteed pass
    // that says nothing — the same trap the wavelength choices are filled for above.
    'conclusion.missing.minimum-runs': [{ count: 2 }],
    'conclusion.missing.minimum-sources': [{ count: 2 }],
    'lab.result.recordedPlain': [{ label: fr['experiment.result.fringeDisplacement'], value: SPACING }],
    // The localized label, because a model-derived run gets one — `CaseRecordPrintView` makes the
    // same substitution, and it is the string a French player actually reads on this row.
    'notebook.row.result': [{ label: fr['experiment.result.fringeSpacing'], value: SPACING }],
    'notebook.row.meta': allAcrossCases(({ experiment }) => [experiment.modelVersion]).map((version) => ({
        timestamp: '2026-08-07T10:20:30.000Z',
        wavelength: WAVELENGTH_SAMPLE,
        mode: fr['lab.wavelengthMode.advanced'],
        version
    })),
    'notebook.page.counter': [{ from: 1, to: 4, total: 12 }],
    'book.caption.spread': SOURCE_NAMES.map((source) => ({ source, index: 19, total: 19 })),
    'book.caption.summary': SOURCE_NAMES.map((source) => ({ source })),
    'book.sourcePage.many': [{ pages: '138, 139' }],
    'book.printedPage': [{ pages: '138, 139' }],
    'colleague.attribution': COLLEAGUE_NAMES.map((name) => ({ name, role: ROLE_LABEL })),
    // The widest the counter ever gets in the authored content: the last beat of the longest conversation.
    'dialogue.counter': [{ index: LONGEST_CONVERSATION, total: LONGEST_CONVERSATION }],
    // Every limitation, not the longest: the template's own wrap is measured per token, and the widest
    // token has no reason to live in the longest string — the rule this file states at the proposals.
    'proposal.limitation': FRENCH_LIMITATIONS.map((limitation) => ({ limitation }))
};

/** One filled string per parameter set — `[fr[key]]` when the key takes no interpolation. */
const fillParams = (key: string): readonly string[] =>
    (SAMPLE_PARAMS[key] ?? [{}]).map((params) => Object.entries(params)
        .reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), fr[key as keyof typeof fr]));

/**
 * AC7's readiness lines, **derived from the bundle** rather than transcribed.
 *
 * `MissingConclusionRequirementCode` is a type union with no runtime counterpart, so the roster cannot
 * be swept from the type — but every member ships a `conclusion.missing.<code>` key, and reading them
 * off the bundle means a twelfth code joins this sweep the day it is authored. Transcribing a roster
 * that the source can extend was a 2.8 review patch.
 */
const MISSING_REQUIREMENT_KEYS = (Object.keys(fr) as (keyof typeof fr)[])
    .filter((key) => key.startsWith('conclusion.missing.'));

/** {@link fillParams}'s English twin — same substitutions, the other bundle. */
const fillEnglishParams = (key: string): readonly string[] =>
    (SAMPLE_PARAMS[key] ?? [{}]).map((params) => Object.entries(params)
        .reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), en[key as keyof typeof en]));

type Measurement = Readonly<{ font: string; fontSize: number; text: string }>;

const measure = (page: import('@playwright/test').Page, samples: readonly Measurement[]): Promise<number[]> =>
    page.evaluate((toMeasure) => {
        const context = document.createElement('canvas').getContext('2d');
        if (!context) throw new Error('Canvas 2D is unavailable.');
        return toMeasure.map(({ font, fontSize, text }) => {
            context.font = `${fontSize}px ${font}`;
            return context.measureText(text).width;
        });
    }, samples as unknown as Measurement[]);

test('renders the full French glyph set without tofu at 1280×720', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // U+FFFF is a permanent non-character: it always resolves to the missing-glyph box. A French
    // glyph that measures the same width is being rendered as that same box.
    const [tofuWidth, ...glyphWidths] = await measure(page, [
        { font: UI_FONT_STACK, fontSize: 24, text: '￿' },
        ...FRENCH_GLYPHS.map((glyph) => ({ font: UI_FONT_STACK, fontSize: 24, text: glyph }))
    ]);

    const missing = FRENCH_GLYPHS.filter((_, index) => {
        const width = glyphWidths[index];
        return width === 0 || width === tofuWidth;
    });
    expect(missing).toEqual([]);
});

test('renders the French pangram at a plausible width in both font stacks', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // What a fully-tofu render of this pangram would measure: every glyph replaced by the
    // missing-glyph box. Comparing against *that* is the assertion — an `x`-repeat control is not,
    // because a tofu box is roughly as wide as a 16px `x`, so a tofu run would sit comfortably
    // inside any ratio bound drawn against it.
    const [uiWidth, bookWidth, tofuWidth] = await measure(page, [
        { font: UI_FONT_STACK, fontSize: 16, text: FRENCH_GLYPH_SAMPLE },
        { font: BOOK_FONT_STACK, fontSize: 16, text: FRENCH_GLYPH_SAMPLE },
        { font: UI_FONT_STACK, fontSize: 16, text: '￿' }
    ]);

    const allTofuWidth = tofuWidth * FRENCH_GLYPH_SAMPLE.length;
    for (const width of [uiWidth, bookWidth]) {
        expect(width).toBeGreaterThan(FRENCH_GLYPH_SAMPLE.length * 3);
        // Proportional text is narrower than a column of identical boxes, and the pangram is dense
        // with narrow letters. A run that measured at or near the all-tofu width is not being drawn.
        expect(width).toBeLessThan(allTofuWidth * 0.9);
    }
});

test('keeps every French string inside the wrap bound of the surface that holds it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // Placeholders are filled with the values the surface actually renders before splitting, because
    // Phaser word-wrap cannot break inside a token and the widest token is usually an interpolated
    // one — a formatted measurement or an authored French source name, never `{value}`.
    const samples = WRAPPED_SURFACES.flatMap(({ key, font, fontSize }) =>
        fillParams(key).flatMap((filled) =>
            filled.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ key, font, fontSize, text: token }))));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index] }))
        .filter((sample) => {
            const bound = WRAPPED_SURFACES.find(({ key }) => key === sample.key)!.wrapWidth;
            return sample.width > bound;
        })
        .map(({ key, text, width }) => `${key}: "${text}" (${Math.round(width)}px)`);

    expect(overflowing).toEqual([]);
});

/**
 * The plaque under each staged figure (Story 2.9) — the surface AC1 is satisfied on.
 *
 * Whole strings, not tokens: the plaque reserves the height of **one** line for the name and one for
 * the role, so a label that wraps to two is drawn over the figure below it or over the guide. The
 * roles are swept as interface copy in the fixed-height table; these are the authored proper nouns.
 */
/**
 * The two surfaces whose bounds this sweep lost when their key changed.
 *
 * `lab.title` was removed from the bundle in the review of 3.2 — the laboratory shows the case's own
 * authored `title` — so the entry measuring it was measuring a string nothing draws, which is the exact
 * failure this file's own comment warns about ("One string measured at a size nothing draws it in is a
 * bound that does not describe the surface"). The authored titles that replaced it were unmeasured, in
 * **both** cases, and a second case is precisely where a longer title arrives.
 *
 * The notebook's settings row is composed from `case.json` rather than from one bundle key, so it is
 * swept here as a literal: `notebook.row.settingsSeparator` had replaced a composed two-readout sample
 * with the three-character separator, and the row it joins had no width coverage at all.
 */
test('keeps the authored case titles and the composed notebook settings row inside their bounds', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    const titles = CASE_TITLES.flatMap(({ caseId, locale, text }) =>
        text.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({
            label: `${caseId}.title.${locale}`, bound: 900,
            sample: { font: UI_FONT_STACK, fontSize: 24, text: token }
        })));
    // Every case's composed row, not the longest across cases: the row Morley–Miller composes is shorter
    // in characters than Young's and carries a wider token (code review of 4.1).
    const settingsRow = NOTEBOOK_SETTINGS_ROWS.flatMap(({ caseId, row }) =>
        row.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({
            label: `${caseId} composed notebook settings row`, bound: NOTEBOOK_ROW_TEXT_WRAP,
            sample: { font: UI_FONT_STACK, fontSize: NOTEBOOK_ROW_FONT_SIZE, text: token }
        })));
    const cases = [...titles, ...settingsRow];
    const widths = await measure(page, cases.map(({ sample }) => sample));

    const overflowing = cases
        .map((entry, index) => ({ ...entry, width: widths[index] }))
        .filter(({ width, bound }) => width > bound)
        .map(({ label, sample, width }) => `${label}: "${sample.text}" (${Math.round(width)}px)`);

    expect(overflowing).toEqual([]);
});

/**
 * **The non-vacuity floor: every cross-case list must actually contain every case.**
 *
 * A sweep whose per-case iteration yields nothing for one case still passes, and the run still reads as
 * "measured across every case" — the shape the code review of 4.1 found in a different guise, where six
 * samples reduced to one case by character count. Only `FIGURE_PLAQUE_NAMES` carried a floor before
 * this, and that floor was global (`length > 0`) rather than per case, so it could not have caught it.
 *
 * This is the one place the *coverage* is asserted rather than the widths, so a case authoring an empty
 * `colleagueHints`, `readingGateHints`, `predictionProposals` or `rivalLab.critiques` fails here with
 * the list named, instead of quietly contributing zero samples to a green run.
 */
test('samples every shipped case in every cross-case sweep', () => {
    const sweeps: Readonly<Record<string, readonly { label: string }[]>> = {
        PROPOSAL_TEXTS, CONCLUSION_CLAIMS, CONCLUSION_LIMITATIONS, DIALOGUE_BEATS,
        FIGURE_PLAQUE_NAMES, DEBRIEF_PROSE, CONSULTATION_LAYERS
    };

    const missing = Object.entries(sweeps).flatMap(([name, samples]) =>
        SHIPPED_CASES
            .filter(({ caseId }) => !samples.some(({ label }) => label.startsWith(caseId)))
            .map(({ caseId }) => `${name} has no sample for ${caseId}`));

    expect(missing).toEqual([]);
});

/**
 * The debrief's authored prose and the consultation layers, at the sizes and wraps that hold them.
 *
 * AC7 named the debrief prose and nothing swept it (code review of 4.1). Both surfaces shrink-then-crop
 * rather than clipping visibly — `DebriefRenderer` clamps toward `DEBRIEF_MIN_FONT_SIZE` and then
 * `setCrop`s, `CaseFilePresenter` clamps the consultation block the same way — so an over-wide token
 * costs the player the end of a sentence with nothing failing anywhere. Both locales, for this file's
 * standing reason: the pass condition is per-token pixel width and an unbreakable token overflows in
 * whatever language it was written.
 */
test('keeps the debrief prose and the consultation layers inside their bands, in both locales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    const authored = [
        ...DEBRIEF_PROSE.map(({ label, fontSize, text }) => ({
            label, fontSize, wrapWidth: debriefLeftTextWrap(DESIGN_WIDTH), text
        })),
        ...CONSULTATION_LAYERS.map(({ label, text }) => ({
            label, fontSize: CASE_FILE_META_FONT_SIZE, wrapWidth: caseFileRightTextWrap(), text
        }))
    ];
    const samples = authored.flatMap(({ label, fontSize, wrapWidth, text }) =>
        text.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({
            label, font: UI_FONT_STACK, fontSize, wrapWidth, text: token
        })));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index]! }))
        .filter(({ width, wrapWidth }) => width > wrapWidth)
        .map(({ label, text, width, wrapWidth }) =>
            `${label}: "${text}" (${Math.round(width)}px > ${Math.round(wrapWidth)}px)`);

    expect(overflowing).toEqual([]);
    // The floor, for the same reason the dialogue sweep carries one.
    expect(authored.length).toBeGreaterThan(0);
});

test('keeps every colleague name on one line of its figure plaque', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    const widths = await measure(page, FIGURE_PLAQUE_NAMES.map(({ text }) => ({
        font: UI_FONT_STACK, fontSize: FIGURE_NAME_FONT_SIZE, text
    })));

    const overflowing = FIGURE_PLAQUE_NAMES
        .map((entry, index) => ({ ...entry, width: widths[index]! }))
        .filter(({ width }) => width > FIGURE_SLOT_WIDTH)
        .map(({ label, text, width }) => `${label} "${text}" (${Math.round(width)}px > ${Math.round(FIGURE_SLOT_WIDTH)}px)`);

    expect(overflowing).toEqual([]);
    expect(FIGURE_PLAQUE_NAMES.length).toBeGreaterThan(0);
});

test('keeps the authored proposal copy inside the colleague card, in both locales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // `ProposalChoice`'s in-card wrap bound, derived from the widget. The body and the limitation are
    // drawn at different sizes, so each authored string is measured at the size the card uses for it.
    const authored = [
        ...PROPOSAL_TEXTS.map((sample) => ({ ...sample, fontSize: PROPOSAL_BODY_FONT_SIZE })),
        ...CONCLUSION_CLAIMS.map((sample) => ({ ...sample, fontSize: PROPOSAL_BODY_FONT_SIZE })),
        ...CONCLUSION_LIMITATIONS.map((sample) => ({ ...sample, fontSize: PROPOSAL_LIMITATION_FONT_SIZE }))
    ];
    const samples = authored.flatMap(({ label, fontSize, text }) =>
        text.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ label, font: UI_FONT_STACK, fontSize, text: token })));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index] }))
        .filter(({ width }) => width > CARD_TEXT_WRAP_WIDTH)
        .map(({ label, text, width }) => `${label}: "${text}" (${Math.round(width)}px)`);

    expect(overflowing).toEqual([]);
});

/**
 * The truncation guard (Story 2.9, AC7) — the arbiter of the card's width budget.
 *
 * **A per-token sweep provably cannot catch this.** The test above measures each word against the wrap
 * bound, which catches an unbreakable token wider than the card; it says nothing about how many *lines*
 * the whole string takes. `ProposalChoice` sets `maxLines: BODY_MAX_LINES`, and Phaser's `maxLines`
 * **clips** — a claim that needs a third line simply loses it, with no error, no overflow, and nothing
 * visible in a token-width check.
 *
 * Every bound is read rather than restated: the wrap from the board that paints it, the line limit from
 * the widget that enforces it. If this fails, **narrow something other than the text** — do not raise
 * `BODY_MAX_LINES` and do not shrink the 16px body, which is already at the floor a 1024×768 `FIT`
 * surface allows at 1280×720.
 *
 * **The stated limitation is measured against the guide slot, not the card** (2.9 review). It left the
 * card so the cast could stand on the conclusion board at all, and it is now drawn for the *chosen*
 * proposal in the guide line above the cards — a different width, a different font size, and a
 * different line budget, all of which this has to follow or it would be guarding a rectangle nothing
 * paints. The prefix goes in too: what the player reads is `proposal.limitation` with the text
 * interpolated, and measuring the bare string would under-count by the label.
 *
 * Verified by mutation while it was written: dropping `PROPOSAL_CARD_HEIGHT` far enough to force a
 * third claim line fails this on the longest French prediction text, and restoring it passes again.
 */
test('keeps every authored claim inside its clipped lines at the surface that actually draws it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    const authored = [
        ...PROPOSAL_TEXTS.map((sample) => ({ ...sample, fontSize: PROPOSAL_BODY_FONT_SIZE, maxLines: BODY_MAX_LINES, wrap: CARD_TEXT_WRAP_WIDTH })),
        ...CONCLUSION_CLAIMS.map((sample) => ({ ...sample, fontSize: PROPOSAL_BODY_FONT_SIZE, maxLines: BODY_MAX_LINES, wrap: CARD_TEXT_WRAP_WIDTH })),
        // In the guide slot, as the player reads it: the label with the text interpolated, at the
        // guide's own size and bound. Both locales, each through its own label, across every case.
        ...SHIPPED_CASES.flatMap(({ caseId, definition }) =>
            definition.conclusionProposals.flatMap(({ limitation }, index) => (
                [['fr', limitation.fr] as const, ['en', limitation.en] as const]
            ).map(([locale, text]) => ({
                label: `${caseId} conclusion limitation ${index + 1} in the guide slot (${locale})`,
                fontSize: BOARD_GUIDE_FONT_SIZE,
                maxLines: BOARD_GUIDE_MAX_LINES,
                wrap: BOARD_GUIDE_WRAP_WIDTH,
                text: (locale === 'fr' ? fr : en)['proposal.limitation'].replace('{limitation}', text)
            }))))
    ];

    // Greedy word wrap at the card's bound, which is what Phaser's `advancedWordWrap: false` does:
    // break at whitespace, never inside a token, and start a new line when the next word would exceed
    // the bound. Measured in the page so the metrics are the browser's own, exactly as elsewhere here.
    // Each sample carries **its own** wrap, because they no longer share a surface: the claims wrap at
    // the card's bound and the stated limitations at the guide's.
    const lineCounts = await page.evaluate(({ samples, font }) => {
        const context = document.createElement('canvas').getContext('2d');
        if (!context) throw new Error('Canvas 2D is unavailable.');
        return samples.map(({ fontSize, text, wrap }) => {
            context.font = `${fontSize}px ${font}`;
            let lines = 1;
            let current = '';
            for (const word of text.split(/[^\S  ]+/).filter(Boolean)) {
                const candidate = current ? `${current} ${word}` : word;
                if (current && context.measureText(candidate).width > wrap) {
                    lines += 1;
                    current = word;
                } else {
                    current = candidate;
                }
            }
            return lines;
        });
    }, { samples: authored.map(({ fontSize, text, wrap }) => ({ fontSize, text, wrap })), font: UI_FONT_STACK });

    const clipped = authored
        .map((sample, index) => ({ ...sample, lines: lineCounts[index]! }))
        .filter(({ lines, maxLines }) => lines > maxLines)
        .map(({ label, lines, maxLines, wrap, text }) => `${label}: ${lines} lines > ${maxLines} at ${wrap}px — "${text}"`);

    expect(clipped).toEqual([]);
    // A guard on the sweep: an empty list would make the assertion above vacuously true, which is how
    // a spec starts passing because the content it measures stopped being found.
    expect(authored.length).toBeGreaterThan(0);
});

test('keeps the authored dialogue inside the panel that holds it, in both locales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // *Every* beat in *both* locales, not the longest French one: the pass condition is per-token width,
    // the widest unbreakable token has no reason to live in the longest string, and an over-wide token
    // clips whatever language it is in. The speaker line is measured at its own bound, which is narrower
    // than the card's because the counter and the advance control share its row.
    const authored = [
        ...DIALOGUE_BEATS.map(({ label, text }) => ({
            label, fontSize: DIALOGUE_BODY_FONT_SIZE, wrapWidth: DIALOGUE_BODY_WRAP_WIDTH, text
        })),
        // One per authored colleague across every case, not one representative: `fillParams` returns a
        // filled string per parameter set now, and the widest name is not necessarily the longest.
        ...fillParams('colleague.attribution').map((text, index) => ({
            label: `dialogue speaker ${index + 1}`,
            fontSize: DIALOGUE_SPEAKER_FONT_SIZE,
            wrapWidth: DIALOGUE_SPEAKER_WRAP_WIDTH,
            text
        }))
    ];
    const samples = authored.flatMap(({ label, fontSize, wrapWidth, text }) =>
        text.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ label, font: UI_FONT_STACK, fontSize, wrapWidth, text: token })));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index] }))
        .filter(({ width, wrapWidth }) => width > wrapWidth)
        .map(({ label, text, width, wrapWidth }) => `${label}: "${text}" (${Math.round(width)}px > ${wrapWidth}px)`);

    expect(overflowing).toEqual([]);
    // A guard on the sweep itself: an empty list would make the assertion above vacuous, which is how
    // a spec starts passing because the content it measures stopped being found.
    expect(DIALOGUE_BEATS.length).toBeGreaterThan(0);
});

test('keeps the authored rival-lab critiques inside the surface that holds them, in both locales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // The critique body has no `maxLines` — truncating the objection is the one thing that surface must
    // not do — so what can still go wrong is a single token wider than the wrap bound, which Phaser
    // cannot break. The speaker line is measured at its own size against the same bound.
    const authored = [
        ...RIVAL_LAB_CRITIQUES.map(({ label, text }) => ({ label, fontSize: RIVAL_LAB_BODY_FONT_SIZE, text })),
        ...SHIPPED_CASES.map(({ caseId, definition }) => ({
            label: `${caseId} rival-lab speaker`,
            fontSize: RIVAL_LAB_SPEAKER_FONT_SIZE,
            text: fr['colleague.attribution']
                .replaceAll('{name}', definition.rivalLab.name)
                .replaceAll('{role}', fr['rivalLab.role'])
        }))
    ];
    const samples = authored.flatMap(({ label, fontSize, text }) =>
        text.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ label, font: UI_FONT_STACK, fontSize, text: token })));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index] }))
        .filter(({ width }) => width > RIVAL_LAB_TEXT_WRAP_WIDTH)
        .map(({ label, text, width }) => `${label}: "${text}" (${Math.round(width)}px > ${RIVAL_LAB_TEXT_WRAP_WIDTH}px)`);

    expect(overflowing).toEqual([]);
    // A guard on the sweep: an empty list would make the assertion above vacuously true.
    expect(RIVAL_LAB_CRITIQUES.length).toBeGreaterThan(0);
});

test('keeps the authored colleague hints inside the laboratory hint panel, in both locales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // The hint panel grows upward from the canvas floor and has no `maxLines`, so height is handled.
    // What is not is a single token wider than `HINT_TEXT_WRAP`, which Phaser cannot break and which
    // would run out of the panel's right edge. The attributed speaker line shares the bound at its
    // own smaller size.
    const authored = [
        ...COLLEAGUE_HINTS.map(({ label, text }) => ({ label, fontSize: HINT_LINE_FONT_SIZE, text })),
        ...SHIPPED_CASES.flatMap(({ caseId, definition }) => definition.colleagues.map(({ id, name, role }) => ({
            label: `${caseId} hint speaker ${id}`,
            fontSize: HINT_SPEAKER_FONT_SIZE,
            text: fr['colleague.attribution']
                .replaceAll('{name}', name)
                .replaceAll('{role}', fr[`colleague.role.${role}`])
        })))
    ];
    const samples = authored.flatMap(({ label, fontSize, text }) =>
        text.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ label, font: UI_FONT_STACK, fontSize, text: token })));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index] }))
        .filter(({ width }) => width > HINT_TEXT_WRAP)
        .map(({ label, text, width }) => `${label}: "${text}" (${Math.round(width)}px > ${HINT_TEXT_WRAP}px)`);

    expect(overflowing).toEqual([]);
    expect(COLLEAGUE_HINTS.length).toBeGreaterThan(0);
});

test('keeps the reading room’s authored content inside the bands that hold it, in both locales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // Three different bounds in one pass, because the room draws the same authored strings at three
    // different widths: an artifact's name on its object (the narrowest bound in the game), the same
    // name on the bench's reference shelf, and its case relationship across the detail panel. The
    // colleague's gate line gets the widest band and the longest prose.
    const authored = [
        ...LIBRARY_ARTIFACT_TEXTS,
        ...READING_GATE_LINES.map(({ label, text }) => ({
            label, text, wrapWidth: LIBRARY_GATE_WRAP, fontSize: GATE_LINE_FONT_SIZE
        }))
    ];
    const samples = authored.flatMap(({ label, fontSize, wrapWidth, text }) =>
        text.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ label, font: UI_FONT_STACK, fontSize, wrapWidth, text: token })));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index]! }))
        .filter(({ width, wrapWidth }) => width > wrapWidth)
        .map(({ label, text, width, wrapWidth }) => `${label}: "${text}" (${Math.round(width)}px > ${Math.round(wrapWidth)}px)`);

    expect(overflowing).toEqual([]);
    // Guards on the sweeps themselves: an empty list would make the assertion above vacuously true,
    // which is how a spec starts passing because the content it measures stopped being found.
    expect(READING_GATE_LINES.length).toBeGreaterThan(0);
    expect(LIBRARY_ARTIFACT_TEXTS.length).toBeGreaterThan(0);
});

test('fits every fixed-height control label on one line, in French and in English', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // The per-token sweep above cannot catch this. Its pass condition is "no single token is wider
    // than the wrap bound", which a 37-character two-word label satisfies comfortably — and then wraps
    // to two lines inside a 40px-high rectangle and clips. Completion Note 10 claimed the token sweep
    // pinned `lab.advance` against exactly that; it does not (review, 2026-08-06).
    //
    // These controls are a fixed height by design — they are hit targets, not prose — so the label has
    // to fit on one line at its authored size. That is a whole-string measurement, and it is the same
    // gap `deferred-work.md` already tracked for `theoryBoard.submit` and `rivalLab.revise`, closed for
    // every fixed-height control there is rather than for the newest one only.
    const FIXED_HEIGHT_CONTROLS = [
        // Story 2.7's six advance controls, each against its own host's bound. Story 2.6 shipped one of
        // these claiming the per-token sweep pinned it; it did not, and this is where that is actually
        // checked — six times over now, which is the obligation the generalization carries with it.
        ...ADVANCE_CONTROLS.map(({ key, bound }) => ({ key, fontSize: ADVANCE_CONTROL_FONT_SIZE, bound })),
        { key: 'theoryBoard.submit', fontSize: SUBMIT_CONTROL_FONT_SIZE, bound: SUBMIT_CONTROL_LABEL_WRAP },
        { key: 'rivalLab.revise', fontSize: RIVAL_LAB_CONTROL_FONT_SIZE, bound: RIVAL_LAB_CONTROL_LABEL_WRAP },
        { key: 'dialogue.advance', fontSize: DIALOGUE_CONTROL_FONT_SIZE, bound: DIALOGUE_CONTROL_LABEL_WRAP },
        // Every role, on its figure's plaque (Story 2.9). One line in a fixed slot, which is exactly
        // the shape this whole-string sweep exists for — the per-token pass cannot tell a label that
        // wraps to two lines from one that does not, and the plaque reserves the height for one.
        { key: 'colleague.role.lead', fontSize: FIGURE_ROLE_FONT_SIZE, bound: FIGURE_SLOT_WIDTH },
        { key: 'colleague.role.builder', fontSize: FIGURE_ROLE_FONT_SIZE, bound: FIGURE_SLOT_WIDTH },
        { key: 'colleague.role.analyst', fontSize: FIGURE_ROLE_FONT_SIZE, bound: FIGURE_SLOT_WIDTH },
        { key: 'colleague.role.communicator', fontSize: FIGURE_ROLE_FONT_SIZE, bound: FIGURE_SLOT_WIDTH },
        // The rival's role, on his own plaque at his own size — his column is a different width from a
        // colleague's slot, so measuring it against theirs would check a bound nothing draws.
        { key: 'rivalLab.role', fontSize: RIVAL_LAB_SPEAKER_FONT_SIZE - 2, bound: RIVAL_LAB_STAGE_COLUMN_WIDTH },
        // The speaking marker, which is AC2's label (Story 2.9 review). It sits in the same fixed slot
        // as the role above it and reserves exactly one line of height, so a French `Parle` that wrapped
        // would push the plaque into the cards — the precise failure a per-token sweep cannot see.
        { key: 'stage.speaking', fontSize: FIGURE_BADGE_FONT_SIZE, bound: FIGURE_SLOT_WIDTH },
        // The choice marker, at the gutter the board actually resolves rather than the widget's default.
        { key: 'proposal.selected', fontSize: PROPOSAL_MARKER_FONT_SIZE, bound: CARD_MARKER_WRAP },
        { key: 'proposal.choose', fontSize: PROPOSAL_MARKER_FONT_SIZE, bound: CARD_MARKER_WRAP },
        // The bench (Story 2.10; the reset joins the row in 2.12). Every one of these labels a rectangle
        // of fixed height — the three controls the bench is operated from, the three wavelength choices,
        // and the notebook's own chrome — so a French label that wrapped past its reserve would be
        // clipped by its own control. The row is now divided from one width, so there is one bound here
        // rather than three that agreed by coincidence.
        { key: 'lab.start', fontSize: BENCH_CONTROL_FONT_SIZE, bound: BENCH_CONTROL_LABEL_WRAP },
        { key: 'lab.start.running', fontSize: BENCH_CONTROL_FONT_SIZE, bound: BENCH_CONTROL_LABEL_WRAP },
        { key: 'lab.notebook.open', fontSize: BENCH_CONTROL_FONT_SIZE, bound: BENCH_CONTROL_LABEL_WRAP },
        { key: 'lab.reset', fontSize: BENCH_CONTROL_FONT_SIZE, bound: BENCH_CONTROL_LABEL_WRAP },
        { key: 'lab.wavelength.fixed', fontSize: WAVELENGTH_CHOICE_FONT_SIZE, bound: WAVELENGTH_CHOICE_LABEL_WRAP },
        { key: 'lab.wavelength.comparison', fontSize: WAVELENGTH_CHOICE_FONT_SIZE, bound: WAVELENGTH_CHOICE_LABEL_WRAP },
        { key: 'lab.wavelength.comparisonLocked', fontSize: WAVELENGTH_CHOICE_FONT_SIZE, bound: WAVELENGTH_CHOICE_LABEL_WRAP },
        { key: 'notebook.select', fontSize: NOTEBOOK_ROW_FONT_SIZE, bound: NOTEBOOK_SELECT_WIDTH - 16 },
        { key: 'notebook.selected', fontSize: NOTEBOOK_ROW_FONT_SIZE, bound: NOTEBOOK_SELECT_WIDTH - 16 },
        { key: 'notebook.note.save', fontSize: NOTEBOOK_ACTION_FONT_SIZE, bound: NOTEBOOK_ACTION_LABEL_WRAP },
        { key: 'notebook.close', fontSize: NOTEBOOK_ACTION_FONT_SIZE, bound: NOTEBOOK_ACTION_LABEL_WRAP },
        { key: 'notebook.page.earlier', fontSize: NOTEBOOK_ROW_FONT_SIZE, bound: NOTEBOOK_PAGE_CONTROL_WIDTH - 16 },
        { key: 'notebook.page.later', fontSize: NOTEBOOK_ROW_FONT_SIZE, bound: NOTEBOOK_PAGE_CONTROL_WIDTH - 16 },
        // The notebook's status line, which is **one line** in the gap between save and close: it is
        // vertically centred in the action row, so a second line grows symmetrically into the row above
        // and the panel floor below. It was in the per-token sweep, which provably cannot tell a sentence
        // that wraps from one that does not — the defect recorded in three previous reviews, and the
        // reason this whole-string sweep exists (review 2026-08-07).
        { key: 'notebook.note.saved', fontSize: NOTEBOOK_ROW_META_FONT_SIZE, bound: NOTEBOOK_STATUS_TEXT_WRAP },
        { key: 'notebook.pairRequired', fontSize: NOTEBOOK_ROW_META_FONT_SIZE, bound: NOTEBOOK_STATUS_TEXT_WRAP },
        { key: 'notebook.releaseOneFirst', fontSize: NOTEBOOK_ROW_META_FONT_SIZE, bound: NOTEBOOK_STATUS_TEXT_WRAP },
        // The debrief (Story 2.11). The deeper-theory strip is a fixed-height control sharing its row
        // with the authored title beside it, so its state label has its own reserved width and must fit
        // one French line inside it — a wrap here would put the label across the title. The two paging
        // controls and the two recognition markers are the same shape: a reserved rectangle whose height
        // does not grow.
        { key: 'debrief.deeperTheory.show', fontSize: DEBRIEF_TOGGLE_FONT_SIZE, bound: debriefToggleStateWrap() },
        { key: 'debrief.deeperTheory.hide', fontSize: DEBRIEF_TOGGLE_FONT_SIZE, bound: debriefToggleStateWrap() },
        { key: 'debrief.critiques.earlier', fontSize: DEBRIEF_PAGE_CONTROL_FONT_SIZE, bound: debriefPageControlLabelWrap() },
        { key: 'debrief.critiques.later', fontSize: DEBRIEF_PAGE_CONTROL_FONT_SIZE, bound: debriefPageControlLabelWrap() },
        // Against **their own 96px column**, not the toggle strip's 150. Measuring these two against
        // `debriefToggleStateWrap()` made the guard 56% looser than the surface it guards — on the very
        // constant whose docstring explains why the strip's reserve was the wrong one for a one-word
        // status (2.11 review). Today's copy fits either way, which is exactly why nothing noticed.
        { key: 'debrief.recognition.achieved', fontSize: DEBRIEF_META_FONT_SIZE, bound: debriefRecognitionStatusWrap() },
        { key: 'debrief.recognition.notRecorded', fontSize: DEBRIEF_META_FONT_SIZE, bound: debriefRecognitionStatusWrap() },
        // The case file (Story 2.11). Every one of these labels a rectangle of fixed height: the pin
        // beside each row, the two paging controls, the two review actions, and the way out.
        { key: 'caseFile.pin', fontSize: CASE_FILE_CONTROL_FONT_SIZE, bound: caseFilePinLabelWrap() },
        { key: 'caseFile.unpin', fontSize: CASE_FILE_CONTROL_FONT_SIZE, bound: caseFilePinLabelWrap() },
        { key: 'caseFile.page.earlier', fontSize: CASE_FILE_CONTROL_FONT_SIZE, bound: caseFilePageControlLabelWrap() },
        { key: 'caseFile.page.later', fontSize: CASE_FILE_CONTROL_FONT_SIZE, bound: caseFilePageControlLabelWrap() },
        { key: 'caseFile.review.request', fontSize: CASE_FILE_CONTROL_FONT_SIZE, bound: caseFileActionLabelWrap() },
        { key: 'caseFile.review.save', fontSize: CASE_FILE_CONTROL_FONT_SIZE, bound: caseFileActionLabelWrap() },
        { key: 'caseFile.close', fontSize: CASE_FILE_CONTROL_FONT_SIZE, bound: caseFileActionLabelWrap() },
        // The consult control (Story 2.12, D4), which is an action of the same shape as the two review
        // ones above it and shares their reserve.
        { key: 'caseFile.consultation.request', fontSize: CASE_FILE_CONTROL_FONT_SIZE, bound: caseFileActionLabelWrap() },
        // The three record actions (Story 2.12, Task 2). Fixed-height rectangles in the bottom row,
        // measured against **their own** derived width rather than the overlay's action width — the row
        // spends what the close control leaves, so borrowing a looser bound would check a rectangle
        // nothing paints (the defect the 2.11 review found on the recognition status).
        { key: 'caseFile.record.export', fontSize: CASE_FILE_CONTROL_FONT_SIZE, bound: caseFileRecordControlLabelWrap(DESIGN_WIDTH) },
        { key: 'caseFile.record.import', fontSize: CASE_FILE_CONTROL_FONT_SIZE, bound: caseFileRecordControlLabelWrap(DESIGN_WIDTH) },
        { key: 'caseFile.record.print', fontSize: CASE_FILE_CONTROL_FONT_SIZE, bound: caseFileRecordControlLabelWrap(DESIGN_WIDTH) },
        // The way *in*, which is the board's control rather than the overlay's — a different font size
        // and a different bound, so it is measured against what the board paints and not against the
        // overlay's actions.
        { key: 'caseFile.open', fontSize: BOARD_CASE_FILE_FONT_SIZE, bound: BOARD_CASE_FILE_LABEL_WRAP },
        // **AC7's readiness list.** Each line is clamped into `CASE_FILE_READINESS_ROW_HEIGHT` — one
        // line, cropped past it — at the right column's own bound, so every one of the eleven is a
        // fixed-height string in everything but name. They were absent from this sweep, and four of the
        // French lines measured 383–470px against a 372px column and were cut mid-sentence, two of them
        // on the ordinary path to `synthesis → review` (2.11 review). Both locales were shortened rather
        // than the bound relaxed, per §Layout constraints.
        ...MISSING_REQUIREMENT_KEYS.map((key) => ({
            key, fontSize: CASE_FILE_META_FONT_SIZE, bound: caseFileRightTextWrap()
        }))
    ] as const;

    // Interpolated where the drawn label is: the three wavelength choices each carry a number, and
    // measuring the bare `{value}` token would be a guaranteed pass that says nothing.
    // One sample per filled variant, so a key whose content varies by case is measured once per case.
    const frenchSamples = FIXED_HEIGHT_CONTROLS.flatMap(({ key, fontSize, bound }) =>
        fillParams(key).map((text) => ({ key, fontSize, bound, text })));
    const widths = await measure(page, frenchSamples.map(({ fontSize, text }) => ({ font: UI_FONT_STACK, fontSize, text })));

    const wrapping = frenchSamples
        .map((sample, index) => ({ ...sample, width: widths[index]! }))
        .filter(({ width, bound }) => width > bound)
        .map(({ key, text, width, bound }) => `${key}: "${text}" (${Math.round(width)}px > ${Math.round(bound)}px)`);

    expect(wrapping).toEqual([]);

    /**
     * **And the same rectangles in English.**
     *
     * This sweep exists because French runs 15–25% longer — an assumption Story 2.11 inverted for three
     * of its own labels: "Pin as support" is 14 characters against "Épingler"'s 8, and `caseFile.close`
     * and `caseFile.open` are longer in English too. A French-only check reports green for an English
     * label of any length, and `caseFile.pin` sits ~9px inside a 104px bound that nothing was measuring
     * (2.11 review). The bound is the same rectangle either way, so whichever locale is longer is the
     * one that has to fit.
     */
    const englishSamples = FIXED_HEIGHT_CONTROLS.flatMap(({ key, fontSize, bound }) =>
        fillEnglishParams(key).map((text) => ({ key, fontSize, bound, text })));
    const englishWidths = await measure(page, englishSamples.map(({ fontSize, text }) => ({ font: UI_FONT_STACK, fontSize, text })));

    const englishWrapping = englishSamples
        .map((sample, index) => ({ ...sample, width: englishWidths[index]! }))
        .filter(({ width, bound }) => width > bound)
        .map(({ key, text, width, bound }) =>
            `${key}: "${text}" (${Math.round(width)}px > ${Math.round(bound)}px)`);

    expect(englishWrapping).toEqual([]);
});

test('fits every French book control inside its fixed button width', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // Both numbers now read the renderer's own exported constants (Story 2.8, AC7). `134` was a
    // fourth copy of a private `CONTROL_WIDTH - 16`, and the 2.7 review found three tests measuring a
    // width the surface did not actually draw for exactly this reason.
    const bound = bookControlLabelWrap();
    const widths = await measure(page, BOOK_CONTROLS.map((key) => ({
        font: UI_FONT_STACK, fontSize: BOOK_CONTROL_MIN_FONT_SIZE, text: fr[key]
    })));

    const overflowing = BOOK_CONTROLS
        .map((key, index) => ({ key, width: widths[index] }))
        .filter(({ width }) => width > bound)
        .map(({ key, width }) => `${key} (${Math.round(width)}px > ${bound}px)`);

    expect(overflowing).toEqual([]);
});

/**
 * The French DOM that still exists lays out without horizontal overflow.
 *
 * Re-pointed from the deleted `CuratedRecord` panel to what is left outside the canvas after Story
 * 2.12: the boot frame and ADR-007's printable record. Both carry real French copy — the record's
 * section headings and its authored source names — so this is still a measurement of French text in a
 * bounded frame rather than of an empty page.
 */
test('lays the French boot frame and printable record out without horizontal overflow', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();
    await expect(page.getByRole('button', { name: fr['boot.enter'] })).toBeVisible();
    const record = page.getByRole('article', { name: fr['print.ariaLabel'] });
    await expect(record.getByRole('heading', { name: fr['print.observations.heading'] })).toBeVisible();
    await expect(record.getByRole('heading', { name: fr['print.conclusion.heading'] })).toBeVisible();

    const overflows = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows).toBe(false);
});

/**
 * The reference book opens in the French reading room, and the reading is recorded in French.
 *
 * The DOM attribution block this asserted against belonged to `CaseContextAndPrediction`, which is
 * deleted (Story 2.12). Its three string assertions — that the pages are a translation, that the source
 * of record stays the English text, and that the bibliographic citation is canonical — are **not**
 * dropped: they are authored content, and `CaseDefinition.test.ts` checks them against `case.json` in
 * both locales, where they can be read exactly.
 *
 * What only a browser can say, and what is asserted here, is that the book really opens on the canvas
 * under a French browser and that closing it leaves a reading on the record — in French.
 */
test('opens the reference book in the French reading room and records the reading', async ({ page }) => {
    // Named, not `/`: this walk reads Young's reference book and asserts Young's Opticks. Every other
    // test in this file measures font metrics, which no case owns, so those stay at the root.
    await gotoCase(page, YOUNG_CASE);
    await enterTheLaboratory(page);
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', 'Library');

    await clickDesign(page, artifactAt(1));
    await waitForBookToOpen(page);
    await clickDesign(page, bookCloseControlCentre());
    await waitForBookToClose(page);

    const record = page.getByRole('article', { name: fr['print.ariaLabel'] });
    await expect(record).not.toContainText(fr['print.sources.empty']);
    await expect(record).toContainText('Opticks');
    await expect(page.locator('#game-container canvas')).toBeVisible();
});
