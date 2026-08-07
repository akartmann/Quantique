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
    PROPOSAL_SURFACE_WIDTH,
    SUBMIT_CONTROL_FONT_SIZE,
    SUBMIT_CONTROL_LABEL_WRAP,
    boardAdvanceControlLabelWrap,
    boardProposalMarkerWrap,
    boardProposalTextWrapWidth,
    DIALOGUE_PANEL_WIDTH
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
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
    NOTEBOOK_CONTROL_LABEL_WRAP,
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
    START_CONTROL_LABEL_WRAP,
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
import { FIGURE_BADGE_FONT_SIZE, FIGURE_NAME_FONT_SIZE, FIGURE_ROLE_FONT_SIZE } from '../../src/adapters/phaser/renderers/characterStageView';

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
 * The slot one figure's plaque occupies: the proposal surface divided by the shipped cast size.
 *
 * Read from the content rather than fixed at four — a case authoring three colleagues gives each a
 * wider slot and one authoring five a narrower one, and the narrower case is the one that clips.
 */
const FIGURE_SLOT_WIDTH = PROPOSAL_SURFACE_WIDTH / (JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { colleagues: unknown[] }).colleagues.length;
/**
 * The dialogue panel is narrower than the surface since Story 2.9 — it shares its row with the control
 * column instead of stacking below it, which is what bought the room its height. Both bounds are
 * derived from the width the board actually passes the widget.
 */
const DIALOGUE_BODY_WRAP_WIDTH = dialogueBodyWrapWidth(DIALOGUE_PANEL_WIDTH);
const DIALOGUE_SPEAKER_WRAP_WIDTH = dialogueSpeakerWrapWidth(DIALOGUE_PANEL_WIDTH);
const RIVAL_LAB_TEXT_WRAP_WIDTH = rivalLabTextWrapWidth();

/**
 * How many references the shipped case puts on the shelf.
 *
 * Read from the content, because every bound below that depends on it narrows as it grows. The full
 * `caseDefinition` parse further down carries the authored strings; this is only the count, and it is
 * needed before the bounds table.
 */
const LIBRARY_ARTIFACT_COUNT = (JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { contextualArtifacts: unknown[] }).contextualArtifacts.length;

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
    { key: 'lab.title', font: UI_FONT_STACK, fontSize: 24, wrapWidth: 900 },
    ...ADVANCE_CONTROLS.map(({ key, bound }) => ({
        key, font: UI_FONT_STACK, fontSize: ADVANCE_CONTROL_FONT_SIZE, wrapWidth: bound
    })),
    { key: 'lab.guide', font: UI_FONT_STACK, fontSize: 15, wrapWidth: 900 },
    { key: 'lab.result.emptyHint', font: UI_FONT_STACK, fontSize: 19, wrapWidth: BENCH_MESSAGE_WRAP },
    { key: 'lab.result.recorded', font: UI_FONT_STACK, fontSize: 19, wrapWidth: BENCH_MESSAGE_WRAP },
    { key: 'lab.result.stale', font: UI_FONT_STACK, fontSize: 19, wrapWidth: BENCH_MESSAGE_WRAP },
    // `lab.preview` became `lab.idle` in Story 2.10: the painted fringe preview it promised is gone —
    // AC4 forbids a screen pattern before a run — and the sentence is now the in-scene invitation to
    // start the light.
    { key: 'lab.idle', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 620 },
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
    { key: 'notebook.row.settings', font: UI_FONT_STACK, fontSize: NOTEBOOK_ROW_FONT_SIZE, wrapWidth: NOTEBOOK_ROW_TEXT_WRAP },
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
const caseDefinition = JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as {
    contextualArtifacts: { id: string; displayName: { en: string; fr: string }; caseRelationship: { en: string; fr: string } }[];
    readingGateHints: { id: string; line: { en: string; fr: string } }[];
    apparatus: { primaryControls: { label: { fr: string } }[] };
    // The bench's authored wavelengths and its model version, both of which reach a fixed-height
    // label or a fixed row on the notebook (Story 2.10).
    experiment: {
        modelVersion: string;
        wavelengthComparison?: { fixedMinimumPathNm: number; advancedChoicesNm: number[] };
    };
    colleagues: { name: string }[];
    rivalLab: { name: string; critiques: { id: string; line: { en: string; fr: string } }[] };
    predictionProposals: { text: { en: string; fr: string } }[];
    conclusionProposals: { claim: { en: string; fr: string }; limitation: { en: string; fr: string } }[];
    scenarioScript: { scenes: { phase: string; dialogueBeats?: { id: string; text: { en: string; fr: string } }[] }[] };
};

/**
 * Whitespace Phaser may wrap at — everything except the no-break spaces. French keeps `0,25` and its
 * unit on one line with U+202F, so `"0,25 mm"` is a single unbreakable token and must be measured as
 * one; a plain `\s+` split would quietly halve it.
 */
const BREAKABLE_WHITESPACE = /[^\S\u00A0\u202F]+/;

const longestFrench = (values: readonly string[]): string =>
    values.reduce((longest, value) => (value.length > longest.length ? value : longest), '');

const SOURCE_NAME = longestFrench(caseDefinition.contextualArtifacts.map(({ displayName }) => displayName.fr));
const CONTROL_LABEL = longestFrench(caseDefinition.apparatus.primaryControls.map(({ label }) => label.fr));
const SPACING = '0,2200 mm';

const COLLEAGUE_NAME = longestFrench(caseDefinition.colleagues.map(({ name }) => name));
/**
 * Every colleague's name at the size and slot the **figure plaque** draws it (Story 2.9).
 *
 * Not an entry in `WRAPPED_SURFACES`: that table is keyed by translation key and cannot hold two
 * bounds for one key, and `colleague.unattributedSpeaker` already sits there against the *dialogue*
 * speaker slot. These are authored proper nouns rather than interface copy anyway, so they belong with
 * the rest of the content sweep.
 */
const FIGURE_PLAQUE_NAMES = caseDefinition.colleagues.map(({ name }) => name);
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
const PROPOSAL_TEXTS = caseDefinition.predictionProposals.flatMap(({ text }) => [text.fr, text.en]);
const CONCLUSION_CLAIMS = caseDefinition.conclusionProposals.flatMap(({ claim }) => [claim.fr, claim.en]);
const CONCLUSION_LIMITATIONS = caseDefinition.conclusionProposals.flatMap(({ limitation }) => [limitation.fr, limitation.en]);
/** French only, for the one place a *single* representative string is wanted (see `SAMPLE_PARAMS`). */
const FRENCH_LIMITATIONS = caseDefinition.conclusionProposals.map(({ limitation }) => limitation.fr);

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
const DIALOGUE_BEATS = caseDefinition.scenarioScript.scenes.flatMap(({ phase, dialogueBeats }) =>
    (dialogueBeats ?? []).flatMap(({ id, text }) => [
        { label: `${phase} beat ${id} [fr]`, text: text.fr },
        { label: `${phase} beat ${id} [en]`, text: text.en }
    ]));
/**
 * Every authored rival-lab critique, in both locales, for the same reason the dialogue beats are swept
 * that way: the pass condition is per-token pixel width, and an unbreakable token overflows in whatever
 * language it was written. These are the longest single runs of prose on any surface in the game.
 */
const RIVAL_LAB_CRITIQUES = caseDefinition.rivalLab.critiques.flatMap(({ id, line }) => [
    { label: `rival-lab critique ${id} [fr]`, text: line.fr },
    { label: `rival-lab critique ${id} [en]`, text: line.en }
]);
/**
 * Every authored colleague hint, in both locales (Story 2.6).
 *
 * Added in review: the hints shipped as the sixth authored-prose surface and the first to skip this
 * sweep, though `HINT_TEXT_WRAP` is the *narrowest* prose bound in the game — narrower than the
 * proposal cards, the dialogue panel, and the rival lab. Each of those joined the sweep with the
 * story that introduced it, and each joined it because a review found the gap.
 */
const COLLEAGUE_HINTS = caseDefinition.colleagueHints.flatMap(({ id, line }) => [
    { label: `colleague hint ${id} [fr]`, text: line.fr },
    { label: `colleague hint ${id} [en]`, text: line.en }
]);

/**
 * Every authored reading-gate line, in both locales (Story 2.8).
 *
 * The seventh authored-prose surface, joining this sweep with the story that introduces it rather than
 * with the review that would otherwise have found the gap — which is how the previous six arrived.
 */
const READING_GATE_LINES = caseDefinition.readingGateHints.flatMap(({ id, line }) => [
    { label: `reading-gate line ${id} [fr]`, text: line.fr },
    { label: `reading-gate line ${id} [en]`, text: line.en }
]);

/**
 * Every authored artifact display name and case relationship, in both locales (Story 2.8).
 *
 * These were content nothing measured: `SOURCE_NAME` fed one interpolated interface key and nothing
 * checked the names against the surfaces that now draw them directly. The reading room draws each name
 * twice — once in a title strip on the object, which is the narrowest bound in the game, and once at
 * the head of the detail panel — and the bench's reference shelf draws it a third time.
 */
const LIBRARY_ARTIFACT_TEXTS = caseDefinition.contextualArtifacts.flatMap(({ id, displayName, caseRelationship }) => [
    { label: `artifact name ${id} [fr]`, text: displayName.fr, wrapWidth: LIBRARY_ARTIFACT_LABEL_WRAP, fontSize: ARTIFACT_LABEL_FONT_SIZE },
    { label: `artifact name ${id} [en]`, text: displayName.en, wrapWidth: LIBRARY_ARTIFACT_LABEL_WRAP, fontSize: ARTIFACT_LABEL_FONT_SIZE },
    { label: `artifact name ${id} on the bench [fr]`, text: displayName.fr, wrapWidth: REFERENCE_CONTROL_LABEL_WRAP, fontSize: REFERENCE_CONTROL_FONT_SIZE },
    { label: `artifact relationship ${id} [fr]`, text: caseRelationship.fr, wrapWidth: LIBRARY_DETAIL_WRAP, fontSize: DETAIL_RELATIONSHIP_FONT_SIZE },
    { label: `artifact relationship ${id} [en]`, text: caseRelationship.en, wrapWidth: LIBRARY_DETAIL_WRAP, fontSize: DETAIL_RELATIONSHIP_FONT_SIZE }
]);

const LONGEST_CONVERSATION = Math.max(
    1,
    ...caseDefinition.scenarioScript.scenes.map(({ dialogueBeats }) => dialogueBeats?.length ?? 0)
);

/**
 * The widest authored wavelength, for the chooser's three fixed-height labels.
 *
 * Read from `experiment.wavelengthComparison` rather than written as 650: a case authoring a
 * four-digit comparison would widen every one of those labels, and a literal here would go on
 * measuring the case that used to ship.
 */
const WAVELENGTH_SAMPLE = Math.max(
    caseDefinition.experiment.wavelengthComparison?.fixedMinimumPathNm ?? 550,
    ...(caseDefinition.experiment.wavelengthComparison?.advancedChoicesNm ?? [])
);

/** One control readout as the notebook's settings row actually composes it, at its longest. */
const notebookReadout = (value: string): string =>
    fr['lab.control.readout'].replace('{label}', CONTROL_LABEL).replace('{value}', value);

const SAMPLE_PARAMS: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
    'lab.result.recorded': { value: SPACING, wavelength: 550, mode: fr['lab.wavelengthMode.minimum'] },
    'lab.result.stale': { value: SPACING },
    'lab.idle': { slitSpacing: '0,25 mm', screenDistance: '2,50 m' },
    'lab.pattern.recorded': { spacing: SPACING },
    'lab.control.readout': { label: CONTROL_LABEL, value: '0,25 mm' },
    'lab.wavelength.fixed': { value: WAVELENGTH_SAMPLE },
    'lab.wavelength.comparison': { value: WAVELENGTH_SAMPLE },
    'lab.wavelength.comparisonLocked': { value: WAVELENGTH_SAMPLE },
    'notebook.observation': { order: 12 },
    'notebook.row.settings': {
        slitSpacing: notebookReadout('0,25 mm'),
        screenDistance: notebookReadout('4,00 m')
    },
    // The localized label, because a model-derived run gets one — `CaseRecordPrintView` makes the
    // same substitution, and it is the string a French player actually reads on this row.
    'notebook.row.result': { label: fr['experiment.result.fringeSpacing'], value: SPACING },
    'notebook.row.meta': {
        timestamp: '2026-08-07T10:20:30.000Z',
        wavelength: WAVELENGTH_SAMPLE,
        mode: fr['lab.wavelengthMode.advanced'],
        version: caseDefinition.experiment.modelVersion
    },
    'notebook.page.counter': { from: 1, to: 4, total: 12 },
    'book.caption.spread': { source: SOURCE_NAME, index: 19, total: 19 },
    'book.caption.summary': { source: SOURCE_NAME },
    'book.sourcePage.many': { pages: '138, 139' },
    'book.printedPage': { pages: '138, 139' },
    'colleague.attribution': { name: COLLEAGUE_NAME, role: ROLE_LABEL },
    // The widest the counter ever gets in the authored content: the last beat of the longest conversation.
    'dialogue.counter': { index: LONGEST_CONVERSATION, total: LONGEST_CONVERSATION },
    // One representative is right here: this sample only fills the interface key's own template, and
    // the per-proposal sweep over every limitation lives in the colleague-card test below.
    'proposal.limitation': { limitation: longestFrench(FRENCH_LIMITATIONS) }
};

const fillParams = (key: string): string =>
    Object.entries(SAMPLE_PARAMS[key] ?? {})
        .reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), fr[key as keyof typeof fr]);

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
        fillParams(key).split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ key, font, fontSize, text: token })));
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
test('keeps every colleague name on one line of its figure plaque', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    const widths = await measure(page, FIGURE_PLAQUE_NAMES.map((text) => ({
        font: UI_FONT_STACK, fontSize: FIGURE_NAME_FONT_SIZE, text
    })));

    const overflowing = FIGURE_PLAQUE_NAMES
        .map((name, index) => ({ name, width: widths[index]! }))
        .filter(({ width }) => width > FIGURE_SLOT_WIDTH)
        .map(({ name, width }) => `${name} (${Math.round(width)}px > ${Math.round(FIGURE_SLOT_WIDTH)}px)`);

    expect(overflowing).toEqual([]);
    expect(FIGURE_PLAQUE_NAMES.length).toBeGreaterThan(0);
});

test('keeps the authored proposal copy inside the colleague card, in both locales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // `ProposalChoice`'s in-card wrap bound, derived from the widget. The body and the limitation are
    // drawn at different sizes, so each authored string is measured at the size the card uses for it.
    const authored = [
        ...PROPOSAL_TEXTS.map((text, index) => ({ label: `prediction text ${index + 1}`, fontSize: PROPOSAL_BODY_FONT_SIZE, text })),
        ...CONCLUSION_CLAIMS.map((text, index) => ({ label: `conclusion claim ${index + 1}`, fontSize: PROPOSAL_BODY_FONT_SIZE, text })),
        ...CONCLUSION_LIMITATIONS.map((text, index) => ({ label: `conclusion limitation ${index + 1}`, fontSize: PROPOSAL_LIMITATION_FONT_SIZE, text }))
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
        ...PROPOSAL_TEXTS.map((text, index) => ({ label: `prediction text ${index + 1}`, fontSize: PROPOSAL_BODY_FONT_SIZE, maxLines: BODY_MAX_LINES, wrap: CARD_TEXT_WRAP_WIDTH, text })),
        ...CONCLUSION_CLAIMS.map((text, index) => ({ label: `conclusion claim ${index + 1}`, fontSize: PROPOSAL_BODY_FONT_SIZE, maxLines: BODY_MAX_LINES, wrap: CARD_TEXT_WRAP_WIDTH, text })),
        // In the guide slot, as the player reads it: the label with the text interpolated, at the
        // guide's own size and bound. Both locales, each through its own label.
        ...caseDefinition.conclusionProposals.flatMap(({ limitation }, index) => (
            [['fr', limitation.fr] as const, ['en', limitation.en] as const]
        ).map(([locale, text]) => ({
            label: `conclusion limitation ${index + 1} (${locale})`,
            fontSize: BOARD_GUIDE_FONT_SIZE,
            maxLines: BOARD_GUIDE_MAX_LINES,
            wrap: BOARD_GUIDE_WRAP_WIDTH,
            text: (locale === 'fr' ? fr : en)['proposal.limitation'].replace('{limitation}', text)
        })))
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
        {
            label: 'dialogue speaker',
            fontSize: DIALOGUE_SPEAKER_FONT_SIZE,
            wrapWidth: DIALOGUE_SPEAKER_WRAP_WIDTH,
            text: fillParams('colleague.attribution')
        }
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
        {
            label: 'rival-lab speaker',
            fontSize: RIVAL_LAB_SPEAKER_FONT_SIZE,
            text: fr['colleague.attribution']
                .replaceAll('{name}', caseDefinition.rivalLab.name)
                .replaceAll('{role}', fr['rivalLab.role'])
        }
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
        ...caseDefinition.colleagues.map(({ id, name, role }) => ({
            label: `hint speaker ${id}`,
            fontSize: HINT_SPEAKER_FONT_SIZE,
            text: fr['colleague.attribution']
                .replaceAll('{name}', name)
                .replaceAll('{role}', fr[`colleague.role.${role}`])
        }))
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

test('fits every French fixed-height control label on one line', async ({ page }) => {
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
        // The bench (Story 2.10). Every one of these labels a rectangle of fixed height — the two
        // controls the bench is operated from, the three wavelength choices, and the notebook's own
        // chrome — so a French label that wrapped to two lines would be clipped by its own control.
        { key: 'lab.start', fontSize: BENCH_CONTROL_FONT_SIZE, bound: START_CONTROL_LABEL_WRAP },
        { key: 'lab.start.running', fontSize: BENCH_CONTROL_FONT_SIZE, bound: START_CONTROL_LABEL_WRAP },
        { key: 'lab.notebook.open', fontSize: BENCH_CONTROL_FONT_SIZE, bound: NOTEBOOK_CONTROL_LABEL_WRAP },
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
        { key: 'notebook.releaseOneFirst', fontSize: NOTEBOOK_ROW_META_FONT_SIZE, bound: NOTEBOOK_STATUS_TEXT_WRAP }
    ] as const;

    // Interpolated where the drawn label is: the three wavelength choices each carry a number, and
    // measuring the bare `{value}` token would be a guaranteed pass that says nothing.
    const widths = await measure(page, FIXED_HEIGHT_CONTROLS.map(({ key, fontSize }) => ({
        font: UI_FONT_STACK, fontSize, text: fillParams(key)
    })));

    const wrapping = FIXED_HEIGHT_CONTROLS
        .map((control, index) => ({ ...control, width: widths[index]! }))
        .filter(({ width, bound }) => width > bound)
        .map(({ key, width, bound }) => `${key}: "${fillParams(key)}" (${Math.round(width)}px > ${Math.round(bound)}px)`);

    expect(wrapping).toEqual([]);
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

test('lays the French boot frame and Curated Record out without horizontal overflow', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();
    await expect(page.getByRole('button', { name: fr['boot.enter'] })).toBeVisible();
    const curatedRecord = page.getByRole('region', { name: fr['curatedRecord.heading'] });
    await expect(curatedRecord.getByRole('heading', { name: fr['curatedRecord.heading'] })).toBeVisible();
    await expect(curatedRecord.getByText(fr['source.marker.primary-material'])).toHaveCount(2);

    const overflows = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows).toBe(false);
});

test('opens the reference book in French and states that its pages are a translation', async ({ page }) => {
    await page.goto('/');

    const record = page.getByRole('region', { name: fr['curatedRecord.heading'] });
    await record.getByRole('button', { name: 'Examiner Référence à l’Opticks' }).click();

    // The DOM attribution block is the readable proof that the book projection resolved in French:
    // `publishLectureBook` builds the book's title, source label, summary and pages from that locale.
    const attribution = page.getByRole('region', { name: 'Young context and prediction' })
        .getByRole('group', { name: 'Lire la référence à l’Opticks — source attribution' });
    await expect(attribution).toBeVisible();
    // Rewritten for the French reader: these pages are a translation, not the transcription.
    await expect(attribution).toContainText('Traduction française réalisée pour ce jeu');
    await expect(attribution).toContainText('la source de référence demeure le texte anglais original');
    // The bibliographic citation of record stays canonical and still points at the English source.
    await expect(attribution.getByRole('link', { name: /archive facsimile/ }))
        .toHaveAttribute('href', 'https://archive.org/details/opticksortreatis1730newt');
    await expect(page.locator('#game-container canvas')).toBeVisible();
});
