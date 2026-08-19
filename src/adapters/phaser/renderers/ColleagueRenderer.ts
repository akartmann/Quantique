import type { Scene } from 'phaser';

import type { PhaserStoreAdapter, ProposalKind } from '../PhaserStoreAdapter';
import { uiTextStyle } from '../textStyles';
import { AdvanceControl, ADVANCE_CONTROL_HEIGHT, advanceControlCentre, advanceControlLabelWrap } from '../ui/AdvanceControl';
import { DialogueBox, dialogueAdvanceControlCentre } from '../ui/DialogueBox';
import {
    ProposalChoice,
    proposalMarkerWrap,
    proposalTextWrapWidth,
    PROPOSAL_CONTENT_INSET,
    PROPOSAL_MARKER_GUTTER,
    type ProposalChoiceGutters
} from '../ui/ProposalChoice';
import { advanceTransitionForPhase, revisitTransitionForPhase, resolveAdvanceRefusal } from './advanceView';
import { CharacterStage } from './CharacterStage';
import { figureLabelHeight, presentColleagueIds, type StageCastMember } from './characterStageView';
import { caseAssetTextureKey } from '../preloadCaseAssets';
import { resolveFigureAppearance, type FigureAppearance } from './figureAppearance';
import { LaboratoryDecor } from './LaboratoryDecor';
import { TransientMessageSlot } from './transientMessage';
import type { AppState } from '../../../core/store/AppState';
import { createTranslator, type Translator } from '../../../core/i18n/translate';
import {
    selectCasePhase,
    selectDialogueBeats,
    selectLocale,
    selectLocalizedConclusionProposals,
    selectLocalizedPredictionProposals,
    selectLocalizedError,
    selectRivalLabCritique,
    selectSelectedConclusionProposalId,
    selectSelectedPredictionProposalId,
    type LocalizedProposalProjection
} from '../../../core/store/selectors';
import type { Colleague } from '../../../domain/cases/ColleagueCast';

/**
 * The scene-facing consumer of the two reusable widgets: one {@link DialogueBox} above a direct
 * colleague stage and one optional {@link ProposalChoice} detail panel.
 *
 * What stays here is what is a *store* concern rather than a widget concern — the heading, the guide
 * line, the transient error on a refused click, and the localized projection lookups. What moved into
 * the widgets is presentation, and every guard moved with it.
 *
 * **It never reads which conclusion the evidence supports.** That belongs to the evaluator and the
 * later rival-lab critique; a surface that could see it could mark the "right" answer, which ADR-006
 * and Story 1.11 AC3 both rule out. `CharacterStageView.test.ts` sweeps this file at source level for
 * the selector and field names that would carry it, which is why the terms themselves do not appear in
 * this prose — the same trade `characterStageView.ts` makes, and for the same reason: an argument in a
 * comment is not an assertion, and a sweep that has to make exceptions is a sweep that will make one
 * too many.
 *
 * Construction is cheap and defensive on purpose: `create()` runs synchronously inside
 * `dispatch() → notify()`, so a throw here would advance the phase, skip every later subscriber, and
 * break `dispatch`'s `Result` contract (Story 1.10 review).
 */

/**
 * Where every surface this renderer lays out sits — the chrome, the dialogue panel, and the cards.
 * Exported so the browser tests derive their wrap bounds and click targets from the real values
 * instead of restating them as literals that can silently drift.
 */
export const PROPOSAL_SURFACE_LEFT = 40;
export const PROPOSAL_SURFACE_WIDTH = 944;
const CARD_LEFT = PROPOSAL_SURFACE_LEFT;
const CARD_WIDTH = PROPOSAL_SURFACE_WIDTH;

export const HEADING_Y = 12;
/** Between the heading's measured bottom and the dialogue panel below it. */
export const HEADING_GAP = 8;
/**
 * The heading's own size, named rather than written into the `add.text` call.
 *
 * Exported for the same reason {@link boardDialogueAdvanceControlCentre} is: what sits below the heading
 * is placed against its **measured** height, so anything outside this module that needs to know where
 * the dialogue panel starts has to be able to read the number the heading is actually drawn at. A
 * literal in the call site put that number somewhere no other file could reach, and
 * `tests/e2e/canvasHelpers.ts` was left assuming the panel top could only ever be {@link DIALOGUE_TOP}.
 */
export const BOARD_HEADING_FONT_SIZE = 25;

/** Between the guide line and the first card. The guide sits with the cards, not with the chrome. */
const GUIDE_TO_CARDS_GAP = 8;

/**
 * The submit control, on the conclusion board only (Story 2.5).
 *
 * Choosing and submitting are deliberately separate acts: choosing stays freely revisable and draws no
 * challenge, and submitting is what puts the claim in front of the rival lab. Without this the
 * `theory.conclusionSubmitted` action would have no way in, and AC1's "when the choice is submitted"
 * would be unreachable in the running game.
 *
 * It sits in the heading row rather than under the cards, and the heading's wrap width narrows to make
 * room. The alternative — a band below the cards — would take height out of `cardGeometry`'s budget,
 * which the 1.12 review already found to be the tightest thing on this surface.
 */
/**
 * Exported because the control column's *size* is what two test files have to measure against, and
 * neither can reach it otherwise.
 *
 * `SUBMIT_WIDTH` is also what the advance control on either board is drawn at ({@link
 * advanceControlBounds}), which is **not** `ADVANCE_CONTROL_WIDTH`, the widget's default for hosts
 * with no column of their own. The two happen to be the same number today, and a test that reads the
 * widget's default while the board draws at this one is measuring a rectangle that is never painted —
 * it would keep passing through exactly the label clipping it exists to catch. Same for
 * `SUBMIT_HEIGHT`: it is what pushes the advance control down into the second row, so a geometry test
 * checking the two controls do not collide has to read it rather than restate it.
 */
export const SUBMIT_WIDTH = 232;
export const SUBMIT_HEIGHT = 34;
const SUBMIT_GAP = 16;
const REVISIT_WIDTH = 176;
const SUBMIT_LABEL_PADDING = 10;
const SUBMIT_FILL = 0x1d4451;

export const SUBMIT_CONTROL_FONT_SIZE = 15;
export const SUBMIT_CONTROL_LABEL_WRAP = SUBMIT_WIDTH - (2 * SUBMIT_LABEL_PADDING);

/**
 * A right-hand column of controls, and the width the prose on the left wraps against (Story 2.7).
 *
 * Story 2.5 gave the *conclusion* heading's row to the submit control and narrowed that one heading.
 * Story 2.7 adds an advance control to **both** boards, so the column is now a permanent feature of
 * the surface rather than the conclusion board's exception — and the heading *and* the guide on both
 * boards wrap against what is left of the width, instead of running underneath it.
 *
 * The number is unchanged from `CONCLUSION_HEADING_WRAP`, which this replaces: it is the same column
 * at the same width, now applying to four texts rather than one.
 */
export const BOARD_CONTROL_LEFT = PROPOSAL_SURFACE_LEFT + PROPOSAL_SURFACE_WIDTH - SUBMIT_WIDTH;
export const BOARD_TEXT_WRAP = PROPOSAL_SURFACE_WIDTH - SUBMIT_WIDTH - SUBMIT_GAP;
/**
 * The width the heading wraps against — the top row less the control column beside it.
 *
 * Exported because whether the heading is one line or two is a **font** question, not a layout one: at
 * 25px the English conclusion heading measures within a few percent of this bound, so it is one line on
 * one host's font stack and two on another's. Anything that depends on where the panel below it starts
 * needs the same bound the board wraps against, not a copy of it.
 */
export const BOARD_HEADING_WRAP = BOARD_TEXT_WRAP - REVISIT_WIDTH - SUBMIT_GAP;
/** Between the submit control and the advance control beneath it, on the conclusion board. */
const CONTROL_ROW_GAP = 8;

/**
 * The design-space centre of the submit control, so a browser test can click it without restating the
 * heading row's gutters. Fixed, unlike the cards: it is anchored to the top of the surface, which
 * nothing measured pushes around.
 */
export const submitConclusionControlCentre = (): Readonly<{ x: number; y: number }> => ({
    x: BOARD_CONTROL_LEFT + (SUBMIT_WIDTH / 2),
    y: HEADING_Y + (SUBMIT_HEIGHT / 2)
});

/**
 * Where the advance control sits on each board.
 *
 * The prediction board has the column to itself and puts the control at the top of it. The conclusion
 * board stacks it under the submit control, because the two are different acts and the order they are
 * read in is the order they happen in: submit the claim, then move on.
 */
const advanceControlBounds = (kind: ProposalKind): Readonly<{ x: number; y: number; width: number }> => ({
    x: BOARD_CONTROL_LEFT,
    y: kind === 'conclusion' ? HEADING_Y + SUBMIT_HEIGHT + CONTROL_ROW_GAP : HEADING_Y,
    width: SUBMIT_WIDTH
});

/** The design-space centre of the advance control on either board, for a browser spec to click. */
export const advanceControlCentreOnBoard = (kind: ProposalKind): Readonly<{ x: number; y: number }> =>
    advanceControlCentre(advanceControlBounds(kind));

/**
 * The control that opens the case file, third in the conclusion board's column (Story 2.11).
 *
 * It goes in the column rather than anywhere else because the column is where this surface already
 * keeps its acts, and because the board has no band left for one — `caseFileGeometry`'s header has the
 * arithmetic. Third, under the submit and the advance, because that is the order the three happen in:
 * gather what the claim rests on, submit it, move on. It costs the room 42px of ceiling, which
 * {@link controlColumnBottom} accounts for so no figure is staged behind it.
 *
 * The prediction board has no case file, so this is a conclusion-board function and takes no kind.
 */
export const CASE_FILE_CONTROL_HEIGHT = 34;
export const CASE_FILE_CONTROL_FONT_SIZE = 15;
export const CASE_FILE_CONTROL_LABEL_WRAP = SUBMIT_WIDTH - (2 * SUBMIT_LABEL_PADDING);

const caseFileControlBounds = (): Readonly<{ x: number; y: number; width: number; height: number }> => ({
    x: BOARD_CONTROL_LEFT,
    y: advanceControlBounds('conclusion').y + ADVANCE_CONTROL_HEIGHT + CONTROL_ROW_GAP,
    width: SUBMIT_WIDTH,
    height: CASE_FILE_CONTROL_HEIGHT
});

const revisitControlBounds = (): Readonly<{ x: number; y: number; width: number }> => ({
    x: BOARD_CONTROL_LEFT - SUBMIT_GAP - REVISIT_WIDTH,
    y: HEADING_Y,
    width: REVISIT_WIDTH
});

export const caseFileOpenControlCentre = (): Readonly<{ x: number; y: number }> => {
    const { x, y, width, height } = caseFileControlBounds();
    return { x: x + (width / 2), y: y + (height / 2) };
};

export const revisitControlCentreOnBoard = (): Readonly<{ x: number; y: number }> =>
    advanceControlCentre(revisitControlBounds());

/**
 * Which board this renderer is, and — on the conclusion board — how it opens its case file.
 *
 * See the constructor for why this is a union rather than an optional callback.
 */
export type ColleagueBoard =
    | Readonly<{ kind: 'prediction' }>
    | Readonly<{ kind: 'conclusion'; openCaseFile: () => void }>;

/**
 * The width a board's advance label wraps against — derived from the bounds the board actually passes,
 * so the French whole-string check cannot drift onto the widget's default.
 */
export const boardAdvanceControlLabelWrap = (kind: ProposalKind): number =>
    advanceControlLabelWrap(advanceControlBounds(kind).width);

/**
 * The measured floor of the control column.
 *
 * It no longer pushes the dialogue panel down, and reclaiming that is what made a room possible on the
 * conclusion board. The panel used to span the full surface, so it had to clear a column two controls
 * tall — 104px of the surface's height spent on *vertical* clearance for something sitting in a corner.
 * The panel is now {@link DIALOGUE_PANEL_WIDTH} and the column stands beside it, so the two share a row
 * instead of stacking. What the floor still bounds is the room's own ceiling, so no figure's head is
 * drawn behind the controls.
 */
const controlColumnBottom = (kind: ProposalKind): number => kind === 'conclusion'
    ? caseFileControlBounds().y + CASE_FILE_CONTROL_HEIGHT
    : advanceControlBounds(kind).y + ADVANCE_CONTROL_HEIGHT;

/**
 * The dialogue panel's width — the surface less the control column, not the whole surface.
 *
 * The same number the heading and the guide already wrap against, and for the same reason: the column
 * is a permanent feature of this surface's top row, and everything sharing that row wraps against what
 * is left rather than running underneath it. The panel was the one thing that did not, and it paid for
 * that by being pushed below the column entirely.
 */
export const DIALOGUE_PANEL_WIDTH = BOARD_TEXT_WRAP;

/**
 * The design-space centre of the dialogue panel's own advance control, **as this board draws it**.
 *
 * Exported for the same reason `boardAdvanceControlLabelWrap` is, and the browser suite proved the
 * need immediately: `dialogue-advance.spec.ts` derived this point from the widget helper but passed
 * `PROPOSAL_SURFACE_WIDTH`, which was the panel's width until Story 2.9 narrowed it to make room for
 * the control column beside it. The spec went on clicking where the control used to be. One exported
 * value that the board and the spec both read is the only arrangement where that cannot happen.
 */
export const boardDialogueAdvanceControlCentre = (): Readonly<{ x: number; y: number }> =>
    dialogueAdvanceControlCentre({ x: PROPOSAL_SURFACE_LEFT, y: DIALOGUE_TOP, width: DIALOGUE_PANEL_WIDTH });
/**
 * Where the dialogue panel sits when the guide above it has not been measured yet — `create()` builds
 * the panel before the first `render` writes any copy into the guide, so there is nothing to measure.
 * Sized for a two-line French guide at {@link CARD_WIDTH}, the taller of the two cases.
 *
 * From the first render on, the real top is **measured** from the guide's wrapped height by
 * {@link ColleagueRenderer.dialogueTop}. Leaving it a constant left ~11px of unmeasured slack between a
 * two-line French guide and the panel — the same "two objects sharing a fixed window with no
 * measurement" defect the 1.11 review found one layer down, and the guide slot also carries the
 * transient error, so a three-line refusal message shared that budget (1.12 review).
 */
export const DIALOGUE_TOP = 54;
const CANVAS_BOTTOM_MARGIN = 16;
const CARD_GAP = 10;

/**
 * A design-space point inside the one proposal detail panel. The panel is anchored to the canvas
 * floor, so tests can derive the choice target without knowing which colleague opened it.
 *
 * Anchored to the canvas floor, which since the layout inverted is not merely convenient but exact: the
 * cards *are* anchored there now, so the last one always occupies the same rectangle whatever the beat
 * above measures to. Before, the top moved with the beat being read and a fixed mid-surface coordinate
 * silently landed in a {@link CARD_GAP} the moment a beat wrapped one line further (1.12 review found
 * exactly that in `dialogue-advance.spec.ts`, under a comment asserting the cards divide the space
 * continuously — they do not, there are gaps between them).
 */
export const proposalDetailPanelProbe = (
    canvasHeight: number
): Readonly<{ x: number; y: number }> => ({
    x: PROPOSAL_SURFACE_LEFT + (PROPOSAL_SURFACE_WIDTH / 2),
    y: canvasHeight - CANVAS_BOTTOM_MARGIN - 4
});

/** @deprecated Use {@link proposalDetailPanelProbe}; retained for downstream test imports. */
export const lastProposalCardProbe = proposalDetailPanelProbe;

/** A centre point in a colleague's full-length stage slot, after the dialogue has completed. */
export const colleagueFigureProbe = (index: number, count: number = 4): Readonly<{ x: number; y: number }> => ({
    x: PROPOSAL_SURFACE_LEFT + (PROPOSAL_SURFACE_WIDTH * ((index + 0.5) / Math.max(count, 1))),
    y: 420
});

/**
 * The room the cast stands in, and the band of surface it is allowed (Story 2.9, design revision).
 *
 * ## The layout was inverted, and that is the change
 *
 * The first version hung the cards off the dialogue panel's measured bottom and clamped them when the
 * panel grew — "overlap beats absence", because an unbounded panel could otherwise push the last card
 * off a surface that does not scroll. The figures then had to live in a 56px column carved out of each
 * card, which is what made them tokens in a margin.
 *
 * It now runs the other way. **The cards are anchored to the canvas floor and take a fixed height**
 * derived from their own measured content; the **room takes everything above them**. A long French
 * beat now costs the room some ceiling instead of costing the cards their place — the panel overlays
 * the décor, the figures shrink to what is left, and the cards never move at all. That removes the
 * clamp's whole failure mode rather than bounding it, and it is strictly better for the reader: the
 * thing they must click stops being the thing that gets squeezed.
 *
 * ## The card height, measured rather than guessed
 *
 * From `ProposalChoice`'s own layout: attribution at y+10 (≈20px, bottom at 30), and a body at y+32
 * wrapping to at most `BODY_MAX_LINES` at 16px (≈42px, bottom at 74), plus a bottom inset — **84px**,
 * and the same on both boards.
 *
 * The inset was 14px and is 10. That is not tidying: the four cards are the largest single claim on
 * this surface, and every pixel of inset is multiplied by four and taken straight out of the room. The
 * 16px it returns is what lets the cast survive a **three-line** beat rather than only the one- and
 * two-line beats today's French copy happens to produce — which is the standing rule on this surface,
 * that a layout is measured against the copy it could be given and not the copy it has.
 *
 * The two boards used to differ, because a conclusion card also reserved two 13px lines for the stated
 * limitation and so needed ≈116px. That reservation was the single most expensive thing on this
 * surface: ≈112px of a 768px canvas that does not scroll, spent four times over to show three
 * limitations nobody has chosen. It is what made the conclusion board unable to host the cast at all —
 * see {@link proposalStageBand} for the arithmetic — and the 2.9 review is where that was measured
 * rather than argued. The limitation now leaves the card entirely (`LimitationMode`) and the **chosen**
 * proposal's limitation is written into the guide slot, which was already reserved and has nothing to
 * say once a choice has been made.
 *
 * `proposalCardHeight` still takes the board kind even though both answers are the same today: the two
 * boards genuinely hold different content and a later story may re-separate them, and one function with
 * one number is cheaper to re-split than two constants that must be kept equal.
 *
 * ## What the room gets, at 768px with four cards
 *
 * Card block `4 × 84 + 3 × 10` = **366**. Reserved below the room: the guide band (40), its gap to the
 * cards (8), and the room's own clearance above the guide (6) — **54**. So the band is
 * `768 − 16 − 366 − 54` = **332px on both boards**, of which the dialogue panel overlays the top, and
 * what is left has to clear the three-line plaque (49) plus the legibility floor (96). That holds for a
 * beat of up to three wrapped lines on both boards and gives out at four, which is the documented trade
 * rather than a bug: the cast is withheld entirely rather than drawn as four dots.
 *
 * **None of these numbers are asserted here.** `ColleagueGeometry.test.ts` drives the real functions at
 * the real canvas size, because this arithmetic was wrong in the previous revision of this very comment
 * — it used 92/120 for card heights that were 88/116, an 8px gap that was 10, and omitted the guide
 * reservation entirely — and three thresholds elsewhere were justified against those wrong totals.
 *
 * ## And the cards get their full width back
 *
 * With the figures in the room rather than in the cards, `contentInset` and `markerGutter` are the
 * widget's defaults and the text wrap is **744px**.
 */
export const PROPOSAL_CARD_HEIGHT = 116;
export const proposalCardHeight = (_kind: ProposalKind): number => PROPOSAL_CARD_HEIGHT;

/** Between the room's floor line and the guide line below it. */
const STAGE_TO_CARDS_GAP = 6;
/**
 * The band reserved between the room and the cards for the guide line.
 *
 * Reserved rather than measured, because the room is painted **once** and the guide's wrapped height is
 * not known until the first `render` — and an unreserved guide is drawn straight across the name
 * plaques, which is what the first pass of this layout did. Two lines of French at 15px (≈39px), which
 * is the taller of the cases the shipped copy produces at the guide's full-surface 944px wrap: the
 * generic guide, a transient refusal, and — since the 2.9 review — the chosen proposal's stated
 * limitation, whose longest French string wraps to two lines at that bound.
 *
 * **{@link GUIDE_TO_CARDS_GAP} is reserved alongside it and was not**, which is the defect the review
 * found: the guide is bottom-anchored at `cardsTop − gap − height`, so it needs `40 + 8`, and reserving
 * only 40 put a two-line French guide on the boundary with zero slack and a longer one across the
 * plaques. {@link proposalStageBand} is the one place the two are added, so they cannot drift apart.
 */
const GUIDE_BAND_HEIGHT = 40;

/**
 * The guide slot's own typography, exported so the French checks measure what the board draws.
 *
 * It carries three different things — the standing guide, a transient refusal, and (on the conclusion
 * board) the chosen proposal's stated limitation — and all three are bounded by the same reserved two
 * lines. The limitation is the long one, so it is the one the truncation guard actually turns on.
 */
export const BOARD_GUIDE_FONT_SIZE = 15;
export const BOARD_GUIDE_WRAP_WIDTH = CARD_WIDTH;
/** What {@link GUIDE_BAND_HEIGHT} reserves, stated as lines so a spec can count them. */
export const BOARD_GUIDE_MAX_LINES = 2;
/** Between the dialogue panel's measured bottom and the top of the space the figures may occupy. */
const STAGE_UNDER_PANEL_GAP = 8;

/**
 * The gutters this board passes its cards — **one object, read by the widget and by the specs alike**.
 *
 * The indirection below only works if it resolves the same values the board actually hands the widget.
 * It did not: `boardProposalTextWrapWidth` called `proposalTextWrapWidth(width)` with no gutter
 * argument, so it returned the *widget's defaults* while claiming to be the board's resolved bound. The
 * two agree today, which is precisely the state `SUBMIT_WIDTH` and `ADVANCE_CONTROL_WIDTH` were in
 * right up until one of them moved and a spec went on measuring a rectangle nothing painted. Passing
 * this constant to both the card and the helper is what makes the claim true rather than currently
 * accurate (2.9 review).
 */
export const PROPOSAL_CARD_GUTTERS: ProposalChoiceGutters = Object.freeze({
    contentInset: PROPOSAL_CONTENT_INSET,
    markerGutter: PROPOSAL_MARKER_GUTTER
});

/**
 * The bound the board actually draws its card text at, exported so a spec reads it rather than the
 * widget's default.
 */
export const boardProposalTextWrapWidth = (): number =>
    proposalTextWrapWidth(PROPOSAL_SURFACE_WIDTH, PROPOSAL_CARD_GUTTERS);
export const boardProposalMarkerWrap = (): number =>
    proposalMarkerWrap(PROPOSAL_CARD_GUTTERS.markerGutter);

/**
 * The band of canvas the room occupies, measured up from the cards rather than down from the chrome.
 *
 * Total over the card count, so a case authoring three proposals gets a taller room rather than a gap
 * where a fourth would have been.
 *
 * The three reservations below the room are added in **one place** so the room's floor and the guide's
 * bottom-anchored position cannot disagree: the guide band itself, the gap it is anchored above the
 * cards by, and the room's clearance above it.
 */
export const proposalStageBand = (
    kind: ProposalKind,
    canvasHeight: number,
    cardCount: number
): Readonly<{ top: number; height: number }> => {
    const cards = Math.max(cardCount, 1);
    const cardsBlock = (cards * proposalCardHeight(kind)) + ((cards - 1) * CARD_GAP);
    const belowRoom = GUIDE_BAND_HEIGHT + GUIDE_TO_CARDS_GAP + STAGE_TO_CARDS_GAP;
    const floor = canvasHeight - CANVAS_BOTTOM_MARGIN - cardsBlock - belowRoom;
    return { top: 0, height: Math.max(0, floor) };
};

/**
 * The band left for the room once the dialogue panel has covered the top of it.
 *
 * Pure and exported so a spec can drive the **real** geometry at the real card count and canvas size.
 * It was inlined in a private method, and every staging test fabricated a band instead — which is how
 * the conclusion board shipped unable to stage anybody at any panel height with a green suite
 * (2.9 review). `ColleagueGeometry.test.ts` is what that omission cost.
 *
 * `panelBottom` is measured, and the control column is a floor under it: the panel no longer stacks
 * below the column, so the room is the one thing that still has to clear both, and a figure's head
 * drawn behind the submit control would be exactly the overlap the layout rules forbid.
 */
export const proposalStageBandBelowPanel = (
    kind: ProposalKind,
    canvasHeight: number,
    cardCount: number,
    panelBottom: number
): Readonly<{ top: number; height: number }> => {
    const band = proposalStageBand(kind, canvasHeight, cardCount);
    const top = Math.min(
        Math.max(panelBottom + STAGE_UNDER_PANEL_GAP, controlColumnBottom(kind) + STAGE_UNDER_PANEL_GAP),
        band.top + band.height
    );
    return { top, height: Math.max(0, band.top + band.height - top) };
};

/** The horizontal extent the figures are spread across: the full proposal surface. */
export const proposalStageArea = (): Readonly<{ x: number; width: number }> => ({
    x: PROPOSAL_SURFACE_LEFT,
    width: PROPOSAL_SURFACE_WIDTH
});

/** A colleague with no silhouette accent of their own still gets a legible, neutral stripe. */
const NEUTRAL_ACCENT = 0x6f8f99;

const portraitAccent = (colleague: Colleague | undefined): string | undefined =>
    colleague?.portrait.accentColor;

const accentOf = (colleague: Colleague | undefined): number => {
    const accent = portraitAccent(colleague);
    // Authored as a validated lower-case `#rrggbb`, so the parse cannot fail on valid content.
    return accent === undefined ? NEUTRAL_ACCENT : Number.parseInt(accent.slice(1), 16);
};

/**
 * What a colleague looks like, from whatever the case authored plus their role.
 *
 * Both halves are defended: a colleague with no `figure` block still gets a pose from their role, and
 * a proposal whose `colleagueId` no longer resolves gets a plain standing figure rather than an
 * exception. `create()` runs synchronously inside `dispatch() → notify()`, so a throw here would
 * advance the phase and skip every later subscriber (1.10 review).
 */
const appearanceOf = (colleague: Colleague | undefined): FigureAppearance => resolveFigureAppearance(
    colleague?.role ?? 'lead',
    colleague?.portrait.figure
);

/** Authored speaker colours keyed by colleague id; asset portraits keep the same accent contract. */
export const resolveSpeakerAccents = (colleagues: readonly Colleague[]): Readonly<Record<string, string>> =>
    Object.fromEntries(colleagues.flatMap((colleague) => {
        const accent = portraitAccent(colleague);
        return accent === undefined ? [] : [[colleague.id, accent]];
    }));

/**
 * Who stands in the room, and how each of them is drawn — as a pure function over authored content.
 *
 * Extracted from `ColleagueRenderer.stageCast` because the integration test had **copied** it. A test
 * that re-implements the thing it is testing asserts only that the copy agrees with itself: swapping
 * the prediction proposals for the conclusion ones inside the private method broke nothing, because
 * the private method was never executed. The copy had also quietly diverged where it mattered most —
 * it resolved colleagues with a non-null assertion where production degrades — so the one path whose
 * docstring warns that a throw would advance the phase had no coverage at all (2.9 review).
 *
 * Cheap and defensive, because `create()` runs synchronously inside `dispatch() → notify()`: a
 * proposal whose `colleagueId` no longer resolves gets the same neutral accent its card stripe does and
 * a stand-in label — never an exception.
 */
/**
 * Which proposals a board attributes, in the order it draws them.
 *
 * One line, exported for one reason: it is the line the mutation test needs. With the board's cast
 * resolution extracted but *this* still restated in the spec, swapping the two arrays inside the
 * renderer would still have broken nothing — the copy would simply have agreed with itself one level
 * up. Reading the same function is what makes "prediction is `thea, elias, marianne, samuel` and
 * conclusion is `marianne, elias, thea, samuel`" an assertion about the board rather than about the
 * spec's own arithmetic.
 */
export const boardProposerIds = (
    caseDefinition: Readonly<{
        predictionProposals: readonly Readonly<{ colleagueId: string }>[];
        conclusionProposals: readonly Readonly<{ colleagueId: string }>[];
    }>,
    kind: ProposalKind
): readonly string[] => (kind === 'prediction'
    ? caseDefinition.predictionProposals
    : caseDefinition.conclusionProposals).map(({ colleagueId }) => colleagueId);

export const resolveStageCast = ({ caseId, colleagues, proposerIds, speakerIds, authoredCast, t }: Readonly<{
    caseId: string;
    colleagues: readonly Colleague[];
    /** In proposal order, which is the left-to-right reading order the two boards genuinely differ in. */
    proposerIds: readonly string[];
    speakerIds: readonly string[];
    /** This scene's authored `cast`, if it has one. Absent means the whole cast — see {@link presentColleagueIds}. */
    authoredCast?: readonly string[];
    t: Translator;
}>): readonly StageCastMember[] => presentColleagueIds({
    proposerIds,
    speakerIds,
    castIds: colleagues.map(({ id }) => id),
    authoredCast
}).map((colleagueId) => {
    const colleague = colleagues.find(({ id }) => id === colleagueId);
    return {
        colleagueId,
        accentColor: accentOf(colleague),
        portraitTextureKey: colleague?.portrait.kind === 'asset'
            ? caseAssetTextureKey(caseId, colleague.portrait.assetId)
            : undefined,
        // Canonical proper noun, and the role resolved through the i18n layer — the same pair the
        // card's attribution line draws, so the plaque and the card cannot disagree.
        name: colleague?.name ?? t('colleague.unattributedSpeaker'),
        roleLabel: colleague ? t(`colleague.role.${colleague.role}`) : '',
        appearance: appearanceOf(colleague)
    };
});

type ProposalCard = Readonly<{ proposalId: string; choice: ProposalChoice }>;

export class ColleagueRenderer {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private readonly cards: ProposalCard[] = [];
    /** The one colleague currently being inspected; proposal adoption remains a separate action. */
    private openedProposalId?: string;
    /** A new board phase starts a new conversation and therefore closes any old proposal detail panel. */
    private renderedPhase?: ReturnType<typeof selectCasePhase>;
    private heading?: Phaser.GameObjects.Text;
    private guide?: Phaser.GameObjects.Text;
    private dialogueBox?: DialogueBox;
    /** Conclusion board only: choosing is revisable, submitting is what invites the rival lab. */
    private submitControl?: Phaser.GameObjects.Rectangle;
    private submitLabel?: Phaser.GameObjects.Text;
    private caseFileControl?: Phaser.GameObjects.Rectangle;
    private caseFileLabel?: Phaser.GameObjects.Text;
    /**
     * Whether this board is taking input, or is suppressed under its own case file (Story 2.11).
     *
     * The 2.8 review deleted three dead `setInputEnabled` methods (Colleague, TheoryBoard, RivalLab)
     * precisely because they were "an open invitation for a later story to re-wire cross-scene
     * suppression through them", and left {@link applyInputState} hard-coding `true`. This one is
     * live, **intra-scene only**, and is called by `TheoryBoardScene`'s own presenter callback and by
     * nothing else. It ships with a test, which is what the review asked for in exchange.
     */
    private inputEnabled = true;
    /** Story 2.7: the way on from this board, whichever phase it is currently hosting. */
    private advanceControl?: AdvanceControl;
    private revisitControl?: AdvanceControl;
    /** Story 2.9: the colleagues, full-length, standing in the room above the cards. */
    private characterStage?: CharacterStage;
    /** The room itself. Painted once, reads nothing, never repaints. */
    private decor?: LaboratoryDecor;
    private roomPainted = false;
    /**
     * Shown in place of the guide line so a refused click is not silent, and — for the opposite case —
     * so a submission that draws no challenge is not silent either. The acknowledgement is deliberately
     * presentation-only: the unchallenged branch of `theory.conclusionSubmitted` changes nothing in the
     * store, and AC3 pins that it must not, so saying so here is what keeps the control's success path
     * from reading as a dead button without moving the phase (2.5 review).
     *
     * One slot, because it is one line of text: the two cases differ only in colour, and holding them
     * in two fields is what let `render` clear both on every paint.
     *
     * The lifetime is explicit (Story 2.7, AC5). The old fields were cleared inside the render that
     * drew them, and this renderer repaints for reasons that are not state changes — a dialogue
     * advance relayouts the cards, the refusal's own follow-up render repaints everything — so a
     * message could vanish before it had been read.
     */
    private readonly transientGuide = new TransientMessageSlot<Readonly<{ text: string; tone: 'error' | 'notice' }>>();

    /**
     * What this board is, and — on the conclusion board only — how it opens its case file.
     *
     * A **discriminated union rather than an optional callback** (Story 2.11). The four support and
     * review intents are dispatched from that overlay and from nowhere else, so a conclusion board
     * constructed without the wiring would draw no control and leave them unreachable — silently, and
     * with every unit test still green. `ColleaguesScene` legitimately has no case file, so the
     * parameter cannot simply be required for both; the union is what makes the compiler ask the right
     * question of each host. The retired routing shell's `isOverlayVisible` reader was removed rather
     * than defaulted for exactly this reason, and the 2.7 review is where that was settled.
     */
    public constructor(
        private readonly scene: Scene,
        private readonly storeAdapter: PhaserStoreAdapter,
        private readonly board: ColleagueBoard
    ) {
        this.kind = board.kind;
    }

    private readonly kind: ProposalKind;

    private project(state: AppState): readonly LocalizedProposalProjection[] {
        return this.kind === 'prediction'
            ? selectLocalizedPredictionProposals(state)
            : selectLocalizedConclusionProposals(state);
    }

    private selectedId(state: AppState): string | undefined {
        return this.kind === 'prediction'
            ? selectSelectedPredictionProposalId(state)
            : selectSelectedConclusionProposalId(state);
    }

    public create(): void {
        const state = this.storeAdapter.getState();
        // **First of everything**, because creation order is the only depth mechanism these renderers
        // use: the room has to sit behind the chrome, the figures, and the cards alike. The object is
        // built here so its layer takes the bottom of the display list; the room is *painted* on the
        // first render, once the dialogue panel has a measured height to compose against.
        this.decor = new LaboratoryDecor(this.scene);
        this.decor.reserve();
        // Text is authored empty here and populated by render(): create() runs once, but the
        // language can change at any time, so every string comes from the store subscription.
        // Both boards give the right of their top rows to the control column, so the heading and the
        // guide wrap against the space that is actually left rather than running underneath it.
        this.heading = this.scene.add.text(CARD_LEFT, HEADING_Y, '', uiTextStyle({
            color: '#f7f4ef',
            fontSize: `${BOARD_HEADING_FONT_SIZE}px`,
            wordWrap: { width: BOARD_HEADING_WRAP }
        }));
        // Placed with the cards rather than with the chrome (Story 2.9, design revision). It is the
        // slot a refused click is answered in, so it belongs beside the thing that was clicked — and
        // moving it out of the top stack is part of what bought the room its height. It wraps against
        // the full surface here, because nothing shares its row.
        this.guide = this.scene.add.text(CARD_LEFT, 0, '', uiTextStyle({
            color: '#c7d7d9',
            fontSize: `${BOARD_GUIDE_FONT_SIZE}px`,
            wordWrap: { width: BOARD_GUIDE_WRAP_WIDTH }
        }));
        this.objects.push(this.heading, this.guide);

        // Narrowed on `this.board`, not on `this.kind` — they are the same value (`this.kind = board.kind`)
        // but only the former carries the discriminated union, and narrowing it here is what lets the
        // case-file wiring below be unconditional instead of guarded by a branch that can never be taken.
        if (this.board.kind === 'conclusion') {
            const { x, y } = submitConclusionControlCentre();
            this.submitControl = this.scene.add.rectangle(x, y, SUBMIT_WIDTH, SUBMIT_HEIGHT, SUBMIT_FILL).setOrigin(0.5, 0.5);
            this.submitLabel = this.scene.add.text(x, y, '', uiTextStyle({
                color: '#f7f4ef', fontSize: `${SUBMIT_CONTROL_FONT_SIZE}px`, align: 'center', wordWrap: { width: SUBMIT_CONTROL_LABEL_WRAP }
            })).setOrigin(0.5, 0.5);
            this.submitControl.on('pointerup', () => this.submitConclusion());
            this.objects.push(this.submitControl, this.submitLabel);

            // The way into the case file (Story 2.11). Only the conclusion board has one, and the
            // union on the constructor is what makes the compiler ask for the wiring.
            //
            // Narrowed on `this.board`, not re-tested afterwards. The wiring used to be guarded by an
            // `if (openCaseFile)` that could never be false inside this branch — dead at runtime, and
            // worse than dead: it meant a future change to the narrowing would still *draw* the control
            // (fill, label, `setInteractive` through `applyInputState`) with nothing listening, which is
            // precisely the drawn-live-but-dead control the discriminated union was chosen to make
            // impossible (2.11 review). If the narrowing ever stops holding, this must fail to compile
            // rather than paint a control that does nothing.
            const caseFile = caseFileControlBounds();
            this.caseFileControl = this.scene.add
                .rectangle(caseFile.x + (caseFile.width / 2), caseFile.y + (caseFile.height / 2),
                    caseFile.width, caseFile.height, SUBMIT_FILL)
                .setOrigin(0.5, 0.5);
            this.caseFileLabel = this.scene.add.text(
                caseFile.x + (caseFile.width / 2), caseFile.y + (caseFile.height / 2), '', uiTextStyle({
                    color: '#f7f4ef', fontSize: `${CASE_FILE_CONTROL_FONT_SIZE}px`,
                    align: 'center', wordWrap: { width: CASE_FILE_CONTROL_LABEL_WRAP }
                })
            ).setOrigin(0.5, 0.5);
            this.caseFileControl.on('pointerup', this.board.openCaseFile);
            this.objects.push(this.caseFileControl, this.caseFileLabel);
        }

        // The widget owns its own display objects and releases them itself, so it is deliberately not
        // pushed onto `this.objects`.
        this.advanceControl = new AdvanceControl(this.scene, {
            ...advanceControlBounds(this.kind),
            onAdvance: () => this.requestAdvance()
        });
        this.advanceControl.create();
        if (this.board.kind === 'conclusion') {
            this.revisitControl = new AdvanceControl(this.scene, {
                ...revisitControlBounds(),
                onAdvance: () => this.requestRevisit()
            });
            this.revisitControl.create();
        }

        this.dialogueBox = new DialogueBox(this.scene, {
            x: CARD_LEFT,
            y: DIALOGUE_TOP,
            width: DIALOGUE_PANEL_WIDTH,
            // Advancing changes the panel's measured height, so the cards below it have to move. It
            // dispatches nothing and touches no state: beat position is widget-local and ephemeral.
            onAdvance: () => this.relayoutCards(),
            // The last click does not count as an advance inside DialogueBox; it completes the
            // conversation. Re-layout here is what hands the stage's direct controls to the player.
            onComplete: () => this.relayoutCards()
        });
        this.dialogueBox.create();

        // The direct figure affordance is owned by this board, not the reusable stage. Rival scenes
        // omit the callback and keep their cast entirely inert.
        this.characterStage = new CharacterStage(this.scene, {
            build: 'colleague',
            onColleagueActivate: (colleagueId) => this.openColleague(colleagueId)
        });
        this.characterStage.create(this.stageCast(state, createTranslator(selectLocale(state))));

        this.applyInputState();
    }

    public render(state: AppState): void {
        const phase = selectCasePhase(state);
        if (this.renderedPhase !== phase) {
            this.renderedPhase = phase;
            this.openedProposalId = undefined;
        }
        const t = createTranslator(selectLocale(state));
        this.heading?.setText(t(this.kind === 'prediction' ? 'colleagues.heading' : 'theoryBoard.heading'));
        // Reading the slot is what spends it: the message survives every repaint of the state it was
        // set against, and clears on the first render carrying a new one (AC5).
        const transient = this.transientGuide.read(state);
        this.guide?.setText(transient?.text ?? this.guideText(state, t));
        this.guide?.setColor(transient?.tone === 'error' ? '#f4d35e' : transient?.tone === 'notice' ? '#f7f4ef' : '#c7d7d9');
        this.submitLabel?.setText(t('theoryBoard.submit'));
        this.caseFileLabel?.setText(t('caseFile.open'));
        // Resolved from the **live** phase on every render, never captured: this one renderer hosts
        // both `synthesis` and `review` on the theory board, and the two dispatch different actions.
        // Its readiness stays `true` — the store decides on the click, and a board control that
        // guessed would be holding an opinion about a conclusion (ADR-006).
        this.advanceControl?.render({ label: t(advanceTransitionForPhase(selectCasePhase(state)).labelKey), isReady: true });
        const revisit = revisitTransitionForPhase(selectCasePhase(state));
        this.revisitControl?.render({ label: revisit ? t(revisit.labelKey) : '', isReady: revisit !== undefined });

        // The guide is placed with the cards in `layoutAndRenderCards`, against their measured top —
        // not here, and not against the heading. It moved out of the top stack so the room could have
        // that height, and it reads better beside the cards it talks about anyway.

        // Set before rendering the panel, because the guide's height is only known once its copy is in.
        this.dialogueBox?.setTop(this.dialogueTop());
        // The beats of the scene mirroring the *live* phase: TheoryBoard hosts both `synthesis` and
        // `review`, which are separate scenario-script entries with their own conversations. The phase
        // is therefore the conversation's identity, and it is what the widget keys its reading position
        // on — the beat ids cannot serve, because the schema lets them repeat across scenes and this one
        // renderer instance survives the `synthesis → review` transition (1.12 review).
        this.dialogueBox?.render(selectDialogueBeats(state), t, selectCasePhase(state), this.speakerAccents(state));
        this.layoutAndRenderCards(state, t);
    }

    public destroy(): void {
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.cards.forEach(({ choice }) => choice.destroy());
        this.cards.length = 0;
        this.dialogueBox?.destroy();
        this.dialogueBox = undefined;
        this.advanceControl?.destroy();
        this.advanceControl = undefined;
        this.revisitControl?.destroy();
        this.revisitControl = undefined;
        this.characterStage?.destroy();
        this.characterStage = undefined;
        this.decor?.destroy();
        this.decor = undefined;
        this.roomPainted = false;
        this.heading = undefined;
        this.guide = undefined;
        this.submitControl = undefined;
        this.submitLabel = undefined;
        this.caseFileControl = undefined;
        this.caseFileLabel = undefined;
        this.openedProposalId = undefined;
        this.renderedPhase = undefined;
        this.inputEnabled = true;
        this.transientGuide.clear();
    }

    /**
     * Who stands in this board's figure column, and in what order.
     *
     * **Proposal order, not cast order**, which is what makes AC3's adjacency mean anything: the two
     * boards attribute in different orders — prediction is `thea, elias, marianne, samuel`, conclusion
     * is `marianne, elias, thea, samuel` — so a fixed cast order would put three of the four colleagues
     * beside somebody else's draft on the conclusion board.
     *
     * Presence is the scene's authored `cast` when it has one (Story 3.4), and derived through
     * {@link presentColleagueIds} when it does not. Either way order stays proposal order, which is
     * what the paragraph above is about — the authored field says *who*, never *where*.
     *
     * The scene is looked up **by phase**, not by scene key, and it has to be: this renderer's host
     * scene `TheoryBoard` carries both `synthesis` and `review` as separate script entries, so a
     * key-based lookup would hand one cast to two boards. `selectDialogueBeats` keys the same way.
     *
     * The resolution itself lives in {@link resolveStageCast}, which is pure and exported: this method
     * is only the store lookup that feeds it. What that split buys is a test that drives the real rule
     * instead of a copy of it.
     */
    private stageCast(state: AppState, t: Translator): readonly StageCastMember[] {
        const scene = state.caseDefinition.scenarioScript.scenes.find(({ phase }) => phase === selectCasePhase(state));

        return resolveStageCast({
            caseId: state.caseDefinition.id,
            colleagues: state.caseDefinition.colleagues,
            proposerIds: boardProposerIds(state.caseDefinition, this.kind),
            speakerIds: (scene?.dialogueBeats ?? []).map(({ speakerId }) => speakerId),
            authoredCast: scene?.cast,
            t
        });
    }

    /**
     * Puts the cast back on its floor line.
     *
     * Called from `render` **and** from the dialogue advance, because both change the stage and only
     * one of them is a state change: the panel's measured height moves what the room has left, and the
     * speaker changes with the reading position, which is widget-local by design and dispatches
     * nothing.
     *
     * The speaker is read from `DialogueBox`, not reverse-matched from the formatted attribution — that
     * is what `speakerId` on the projection is for. A beat attributed to a colleague this build no
     * longer authors resolves to nobody, and the resolver foregrounds nobody rather than throwing.
     *
     * **A finished conversation has no speaker.** `advance()` past the last beat sets `completed` and
     * never moves the index, so `getCurrentBeat()` goes on returning the final beat forever — which
     * held one colleague foregrounded and the other three at 55% opacity for the rest of the phase,
     * long after anybody was talking. `isComplete()` exists for exactly this distinction and reading it
     * restores the uniform neutral the resolver documents for "nobody speaking" (2.9 review).
     *
     * The **selected** colleague goes in too, and that is what carries AC3 now that the figures stand
     * in a row rather than beside their own card: choosing a proposal brings its author forward. It is
     * the player's own choice reflected back, never an evaluation of it — nothing here can see which
     * conclusion the evidence supports, and `CharacterStageView.test.ts` asserts that at source level.
     */
    private stageFigures(state: AppState, t: Translator): void {
        const selectedId = this.selectedId(state);
        const authored = this.kind === 'prediction'
            ? state.caseDefinition.predictionProposals
            : state.caseDefinition.conclusionProposals;

        const speaking = this.dialogueBox !== undefined && !this.dialogueBox.isComplete();

        this.characterStage?.render({
            band: this.stageBand(),
            area: proposalStageArea(),
            speakerColleagueId: speaking ? this.dialogueBox?.getCurrentBeat()?.speakerId : undefined,
            selectedColleagueId: authored.find(({ id }) => id === selectedId)?.colleagueId,
            cast: this.stageCast(state, t),
            t
        });
    }

    /**
     * Paints the room, once, on the first render that has a measured panel to compose against.
     *
     * Not in `create()`, because the strip the player can see is bounded above by the dialogue panel
     * and the panel's height is not known until it has copy in it — `create()` builds it empty. Not on
     * every render either: a backdrop repainted on every state change is a cost paid on every keystroke
     * for a picture that never changes, which is the rule `ReadingRoomDecor` states in its own header.
     *
     * Once is enough because neither bound moves afterwards. The floor is derived from the card count,
     * which is fixed for a case; the ceiling is the panel's *first* measured bottom, and a later beat
     * that wraps one line further lowers the figures rather than the room.
     *
     * **The flag is set by the paint, not before it.** It used to latch first, so a first render whose
     * band came out degenerate — a panel tall enough to fill it — painted nothing at all, and no later
     * render ever retried even once the panel had shrunk back. `create` reports whether it composed,
     * and only a composed room counts as painted (2.9 review).
     */
    private paintRoomOnce(): void {
        if (this.roomPainted || !this.decor) return;
        const band = this.stageBand();
        // `CharacterStage` reserves this exact plaque height below its shared foot line. Passing the
        // band's lower edge instead made the painted floor continue through the labels, leaving every
        // pair of feet suspended above the only line that read as ground. The decor needs the figure
        // baseline, while the band still owns the label space beneath it.
        const floorY = band.top + band.height - figureLabelHeight();
        this.roomPainted = this.decor.create(this.scene.scale.width, floorY, band.top);
    }

    /**
     * The room's band: everything above the cards, less what the dialogue panel is covering.
     *
     * The figures stand under the panel rather than behind it. `dialogueBox.getBottomY()` is measured,
     * so a beat that wraps to three lines in French lowers the room's ceiling and the figures shrink —
     * which is exactly the trade the inverted layout was for, and it costs the cards nothing.
     */
    private stageBand(): Readonly<{ top: number; height: number }> {
        return proposalStageBandBelowPanel(
            this.kind,
            this.scene.scale.height,
            // Reserve the single detail panel's footprint even before it opens. That keeps the cast
            // and painted floor stable when the player inspects a colleague rather than jumping them
            // under the pointer; compared with four persistent cards it still returns most of the room.
            1,
            this.dialogueBox?.getBottomY() ?? DIALOGUE_TOP
        );
    }

    /**
     * Each colleague's authored accent as a CSS colour, keyed by id, for the dialogue panel.
     *
     * The panel writes the speaker's attribution in their own colour — the one idea taken wholesale
     * from the reference art, and the thing that makes four voices in one slot separable at a glance.
     * It is reinforcement and never the signal: the attribution names them in words either way.
     *
     * Built from `colleagues[]` only. The rival is not in it and must not be (AC4); his surface holds
     * no `DialogueBox` at all.
     */
    private speakerAccents(state: AppState): Readonly<Record<string, string>> {
        return resolveSpeakerAccents(state.caseDefinition.colleagues);
    }

    /**
     * What the guide slot says when no transient message has claimed it.
     *
     * On the conclusion board a chosen proposal's **stated limitation** takes the slot, because the
     * limitation left the card (`LimitationMode`) and this is where it went. The trade is deliberate
     * and it is what let the cast stand on this board at all: reserving two 13px lines in each of four
     * cards cost ≈112px of a surface with none to spare, to show three caveats attached to claims the
     * player has not chosen. Shown here it sits directly above the cards, at the moment it is actually
     * load-bearing — you are about to submit this claim, and this is what you would be conceding with
     * it.
     *
     * The generic guide is what it replaces, and losing it is no loss: `theoryBoard.guide` says to
     * choose a conclusion and then submit it, which has stopped being news by the time one is chosen.
     * A refusal still outranks both — it is the answer to something the player just did.
     */
    private guideText(state: AppState, t: Translator): string {
        const fallback = t(this.kind === 'prediction' ? 'colleagues.guide' : 'theoryBoard.guide');
        if (this.kind !== 'conclusion') return fallback;
        const selectedId = this.selectedId(state);
        if (selectedId === undefined) return fallback;
        const limitation = this.project(state).find(({ proposalId }) => proposalId === selectedId)?.limitation;
        // A conclusion proposal whose limitation a degraded case no longer carries falls back rather
        // than printing a label with nothing after it.
        return limitation === undefined ? fallback : t('proposal.limitation', { limitation });
    }

    /** The accent is the one thing the localized projection does not carry, because it is not text. */
    private accentFor(state: AppState, proposalId: string): number {
        const authored: Readonly<{ colleagueId: string }> | undefined = this.kind === 'prediction'
            ? state.caseDefinition.predictionProposals.find(({ id }) => id === proposalId)
            : state.caseDefinition.conclusionProposals.find(({ id }) => id === proposalId);
        return accentOf(state.caseDefinition.colleagues.find(({ id }) => id === authored?.colleagueId));
    }

    /**
     * Puts the chosen conclusion in front of the rival lab. It surfaces a refusal for the same reason
     * {@link chooseProposal} does — "choose a conclusion first" is a message the player needs, not a
     * dispatch to swallow — and it never decides anything itself: whether a challenge follows is the
     * evaluator's and the store's business.
     */
    private submitConclusion(): void {
        const result = this.storeAdapter.submitConclusion();
        const current = this.storeAdapter.getState();
        if (!result.ok) {
            this.transientGuide.set({ text: selectLocalizedError(current, result.error), tone: 'error' }, current);
            this.render(current);
            return;
        }
        // A submission that drew a challenge needs nothing from here — the router is already taking the
        // player to the rival lab, and a notice written into a surface about to be left would only
        // flash. A submission that drew none changes no state at all, so this is the only signal there
        // is that the click did anything.
        if (selectRivalLabCritique(current)) return;
        this.transientGuide.set(
            { text: createTranslator(selectLocale(current))('theoryBoard.submitAcknowledged'), tone: 'notice' },
            current
        );
        this.render(current);
    }

    private chooseProposal(proposalId: string): void {
        const result = this.storeAdapter.chooseProposal(this.kind, proposalId);
        // Not unreachable. `createStore` short-circuits every dispatch while an exclusive progress
        // operation is in flight, so a click during a progress export or import legitimately fails —
        // and swallowing that left the card silently inert with no way to tell "refused" from "not
        // clickable".
        if (result.ok) return;
        const current = this.storeAdapter.getState();
        this.transientGuide.set({ text: selectLocalizedError(current, result.error), tone: 'error' }, current);
        this.render(current);
    }

    /**
     * Asks to make the move that leaves the phase this board is currently hosting.
     *
     * Routed through {@link resolveAdvanceRefusal} rather than straight to `selectLocalizedError`, so
     * there is one rule for answering a refusal and not one per host. `colleagueAnswers: false` is
     * this board's honest statement of what it can do: the one gate with an authored in-fiction line
     * is the significant-measure gate, which sits on `experiment → synthesis` and can only be refused
     * at the bench, and a board that routed a refusal to a hint slot it does not have would answer
     * with nothing — the one thing AC4 forbids. Stating it here means a later story that authors a
     * line for a gate reachable from a board changes this argument and inherits the rule, instead of
     * adding a code to the register and finding this call site never consulted it.
     */
    private requestAdvance(): void {
        const { transition } = advanceTransitionForPhase(selectCasePhase(this.storeAdapter.getState()));
        const result = this.storeAdapter.advanceCase(transition);
        if (result.ok) return;
        const current = this.storeAdapter.getState();
        const { message } = resolveAdvanceRefusal({
            code: result.error.code,
            localizedError: selectLocalizedError(current, result.error),
            colleagueAnswers: false
        });
        this.transientGuide.set({ text: message ?? '', tone: 'error' }, current);
        this.render(current);
    }

    private requestRevisit(): void {
        const revisit = revisitTransitionForPhase(selectCasePhase(this.storeAdapter.getState()));
        if (!revisit) return;
        const result = this.storeAdapter.revisitCase(revisit.transition);
        if (result.ok) return;
        const current = this.storeAdapter.getState();
        this.transientGuide.set({ text: selectLocalizedError(current, result.error), tone: 'error' }, current);
        this.render(current);
    }

    /**
     * The dialogue panel's top edge: below the guide line's *measured* bottom, and never above
     * {@link DIALOGUE_TOP}.
     *
     * Unchanged in rule and changed in consequence. It still clears the guide on the left and the
     * control column on the right, both measured — but the panel now floats **over the room** rather
     * than above the cards, so what it pushes when it grows is the figures' available height, not the
     * cards' position. The floor keeps it a safety net for the chrome above it.
     */
    private dialogueTop(): number {
        return Math.max(DIALOGUE_TOP, HEADING_Y + (this.heading?.height ?? 0) + HEADING_GAP);
    }

    /**
     * Where the cards sit: **anchored to the canvas floor**, at the height their own content needs.
     *
     * This inverts what the board used to do. The cards used to hang off the dialogue panel's measured
     * bottom and be clamped when it grew, on the documented grounds that "overlap beats absence" — an
     * unbounded beat could otherwise push the last card off a surface that does not scroll, and a card
     * the player cannot click is a phase they cannot complete.
     *
     * Anchoring to the floor removes that failure mode instead of bounding it. The panel now overlays
     * the room above the cards, so a long French beat costs the room some ceiling and the figures some
     * height, and costs the cards nothing at all. Nothing the player must click can move.
     *
     * The height comes from {@link proposalCardHeight}, which differs by board because the content
     * does: a conclusion card carries a stated limitation under its claim and a prediction card does
     * not.
     */
    private cardGeometry(count: number): Readonly<{ top: number; height: number }> {
        const cards = Math.max(Math.min(count, 1), 1);
        const height = proposalCardHeight(this.kind);
        const block = (cards * height) + ((cards - 1) * CARD_GAP);
        return { top: this.scene.scale.height - CANVAS_BOTTOM_MARGIN - block, height };
    }

    private layoutAndRenderCards(state: AppState, t: Translator): void {
        const { top, height } = this.cardGeometry(1);
        // Bottom-anchored to the cards' top, so a three-line French refusal grows upward into the room
        // instead of down over the first card.
        this.guide?.setY(top - GUIDE_TO_CARDS_GAP - (this.guide?.height ?? 0));
        const projections = new Map(this.project(state).map((proposal) => [proposal.proposalId, proposal]));
        const selectedId = this.selectedId(state);

        const opened = this.openedProposalId === undefined ? undefined : projections.get(this.openedProposalId);
        if (opened) {
            const current = this.cards[0];
            if (!current || current.proposalId !== opened.proposalId) {
                current?.choice.destroy();
                this.cards.length = 0;
                const choice = new ProposalChoice(this.scene, {
                    x: CARD_LEFT,
                    y: top,
                    width: CARD_WIDTH,
                    height,
                    accentColor: this.accentFor(state, opened.proposalId),
                    ...PROPOSAL_CARD_GUTTERS,
                    limitationMode: this.kind === 'conclusion' ? 'suppressed' : 'in-card',
                    onChoose: () => this.chooseProposal(opened.proposalId)
                });
                choice.create();
                this.cards.push({ proposalId: opened.proposalId, choice });
            }
            this.cards[0]?.choice.setBounds(top, height);
            this.cards[0]?.choice.render(opened, opened.proposalId === selectedId, t);
        } else {
            this.cards.forEach(({ choice }) => choice.destroy());
            this.cards.length = 0;
        }
        // Re-staged in the same pass, from the same measured geometry, so the room and the cards can
        // never disagree about where the floor is.
        this.paintRoomOnce();
        this.stageFigures(state, t);
        // A rebuilt card starts inert and would otherwise come back **live** under an open case file.
        // See {@link applyInputState}.
        this.applyInputState();
    }

    /** Opens the one compact proposal panel for a staged colleague, after the authored dialogue. */
    private openColleague(colleagueId: string): void {
        if (!this.inputEnabled || !this.dialogueBox?.isComplete()) return;
        const authored = this.kind === 'prediction'
            ? this.storeAdapter.getState().caseDefinition.predictionProposals
            : this.storeAdapter.getState().caseDefinition.conclusionProposals;
        const proposal = authored.find(({ colleagueId: authorId }) => authorId === colleagueId);
        if (!proposal) return;
        this.openedProposalId = proposal.id;
        const state = this.storeAdapter.getState();
        this.layoutAndRenderCards(state, createTranslator(selectLocale(state)));
    }

    /**
     * Re-lays the cards out after a dialogue advance, without touching the heading, the guide, or the
     * transient error: an advance is not a state change, so a refused click's message must survive it.
     */
    private relayoutCards(): void {
        const state = this.storeAdapter.getState();
        this.layoutAndRenderCards(state, createTranslator(selectLocale(state)));
    }

    /**
     * Lets the scene suppress the board while its own case file is open (Story 2.11).
     *
     * **Intra-scene**, driven by this scene's own presenter — never a callback from another scene.
     * `LibraryRenderer.setInputEnabled` is the shape this copies, and the distinction is the whole of
     * why the 2.8 review was willing to see one of these come back: the retired arrangement had
     * `LectureBookScene` calling `laboratoryScene.setApparatusInputEnabled(...)` across a boundary.
     *
     * It exists because a click meant for the overlay that fell through would **choose a conclusion**
     * — not a cosmetic problem, a dispatched intent the player did not make.
     */
    public setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        this.applyInputState();
    }

    /**
     * Arms or silences every control on the board.
     *
     * Called from `create()` **and** from {@link layoutAndRenderCards}, so a card rebuilt under a new
     * proposal set cannot come back live under an open overlay: a rebuilt card starts inert, and the
     * old unconditional `true` would have re-armed it regardless of what the scene had asked for.
     */
    private applyInputState(): void {
        const enabled = this.inputEnabled;
        const canChoose = enabled && (this.dialogueBox?.isComplete() ?? false);
        this.cards.forEach(({ choice }) => choice.setInputEnabled(canChoose));
        this.characterStage?.setInputEnabled(canChoose);
        this.dialogueBox?.setInputEnabled(enabled);
        this.advanceControl?.setInputEnabled(enabled);
        this.revisitControl?.setInputEnabled(enabled);
        if (enabled) {
            this.submitControl?.setInteractive({ useHandCursor: true });
            this.caseFileControl?.setInteractive({ useHandCursor: true });
        } else {
            this.submitControl?.disableInteractive();
            this.caseFileControl?.disableInteractive();
        }
    }
}
