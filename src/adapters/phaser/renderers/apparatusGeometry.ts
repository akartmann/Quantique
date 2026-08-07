/**
 * The laboratory's side-column geometry (Story 2.6), in its own module so a browser test can read it.
 *
 * **This existed because `ApparatusRenderer` imported Phaser as a value** — `BlendModes`, for the
 * additive blending on the beam and wavefront graphics — so a spec that imported the renderer to
 * derive a click target failed on the import rather than the assertion. Story 2.10 removed that
 * import (`setBlendMode('ADD')` resolves through the same table), and the module stays anyway, for
 * the reason that outlives it: a spec deriving a coordinate should read the numbers, not construct
 * the renderer. That keeps the project rule intact — "never assert a magic number that a test shares
 * with source unless both read one exported constant" — and it is the same geometry/painting split
 * `libraryGeometry.ts` and `characterStageView.ts` draw.
 *
 * What is left here after Story 2.7 is the *placement* — where the laboratory puts a control that
 * every other scene also has. The control's own dimensions moved into `ui/AdvanceControl.ts` and are
 * re-exported below, so there is one set of numbers rather than two that agree by coincidence.
 *
 * A column rather than a band, because the laboratory has no spare horizontal strip: `lab.title` and
 * `lab.guide` wrap to x=940 across the top, `resultReadout` and `visualGuidance` both wrap 620px from
 * x=40 and end at 660, and the two control rows occupy x=40–560 from y≈578 down. x≥680 is what is
 * left — but only *below* the apparatus, which is the correction below.
 */

// `ADVANCE_CONTROL_HEIGHT` is imported as well as re-exported below: a bare `export … from` re-export
// does not bind the name locally, and the reference shelf's placement is derived from it.
import { ADVANCE_CONTROL_HEIGHT, advanceControlCentre, advanceControlLabelWrap } from '../ui/AdvanceControl';
import type { PrimaryControl } from '../../../domain/cases/CaseDefinition';

/** The painted apparatus, in the same design space, so the column can be placed clear of it. */
export const CENTRE_Y = 200;
export const SCREEN_HALF_HEIGHT = 108;
export const SCREEN_BAR_HALF_WIDTH = 7;
/** The interference screen's baseline label, drawn under the bar. */
export const SCREEN_LABEL_Y = 322;
export const SCREEN_LABEL_HEIGHT = 20;

/**
 * Where the interference screen stands for a given throw.
 *
 * Here rather than in the renderer because the column's placement depends on it and a browser test
 * has to be able to check that they do not collide. It is pure arithmetic over an authored control
 * value; nothing about it needs Phaser.
 */
export const screenXForDistance = (screenDistanceM: number): number => 480 + ((screenDistanceM - 1) / 3) * 220;

export const SIDE_COLUMN_LEFT = 680;
export const SIDE_COLUMN_WIDTH = 304;

/**
 * The control's own geometry now belongs to the widget that draws it (Story 2.7) — every phase's
 * scene carries one, so its height, padding, and type size stopped being the laboratory's business.
 * Re-exported here so the specs and the renderer that already read them keep reading **one** constant
 * rather than a copy that could drift from the widget.
 */
export {
    ADVANCE_CONTROL_FONT_SIZE,
    ADVANCE_CONTROL_HEIGHT,
    ADVANCE_CONTROL_PADDING
} from '../ui/AdvanceControl';

/**
 * Below the apparatus, not beside it.
 *
 * This was 130 and it was wrong (review, 2026-08-06). The screen slides right with the throw —
 * `screenXForDistance(4) = 700`, so at the two longest authored distances the bar occupies x 693–707
 * and its label reaches y≈342, both inside a column that starts at x=680. An opaque control at y=130
 * painted a 40px band straight across the interference pattern the player is there to measure, and
 * swallowed pointer events over it into a phase advance. `createSideColumn()` runs after
 * `createRichPattern()`, so it was unambiguously on top. Reachable in normal play: the authored hints
 * ask the player to slide the screen back.
 *
 * 360 clears the screen bar (y≤308) and its label (y≤342) with room to spare, at every authored
 * distance. `apparatusGeometry.test.ts` pins the invariant rather than trusting this comment.
 *
 * Still a constant rather than a measurement, but now with a rationale that survives inspection: the
 * only thing above it in this column is `lab.guide` at y=62, and at 15px it would need roughly
 * fifteen wrapped lines to reach here. The *hint* below is the piece that genuinely moves, and it is
 * measured and grows upward from the floor.
 */
export const ADVANCE_CONTROL_Y = 360;
/** The laboratory's control fills the column, so its label bound is wider than the widget's default. */
export const ADVANCE_CONTROL_LABEL_WRAP = advanceControlLabelWrap(SIDE_COLUMN_WIDTH);

/**
 * The reference shelf in the side column (Story 2.8, Task 6 / AC6).
 *
 * The book has to stay reachable from the bench for re-reading during `experiment` — that is what the
 * retired always-on overlay was buying, and retiring it without replacing the affordance would take
 * the reference away rather than move it. So the laboratory owns a presenter of its own and a small
 * chooser over the case's artifacts.
 *
 * **Reading here dispatches nothing and changes no progression.** Paging and closing stay ephemeral,
 * exactly as the archival-book rule in `project-context.md` requires. The *record* of having read a
 * source is made in the reading room; the bench only re-opens what is already on the shelf.
 *
 * The controls are **not** fixed-height. Their labels are authored artifact display names, not
 * interface strings — "Le compte rendu de la conférence de Thomas Young de 1801" is 55 characters and
 * wraps to two lines at this width where its English counterpart fits on one — so each control is
 * sized to its own measured label and the next is stacked under the previous one's measured bottom.
 * A fixed height here would clip the French, which is the defect class the per-token typography sweep
 * provably cannot catch.
 */
export const REFERENCE_HEADING_GAP = 28;
export const REFERENCE_HEADING_FONT_SIZE = 13;
export const REFERENCE_HEADING_GAP_BELOW = 10;
export const REFERENCE_CONTROL_FONT_SIZE = 13;
export const REFERENCE_CONTROL_PADDING = 10;
export const REFERENCE_CONTROL_GAP = 8;

/** Where the reference shelf's heading sits: under the way out, never over the apparatus above it. */
export const REFERENCE_HEADING_Y = ADVANCE_CONTROL_Y + ADVANCE_CONTROL_HEIGHT + REFERENCE_HEADING_GAP;

/** The bound a reference label wraps to, derived from the column rather than restated. */
export const REFERENCE_CONTROL_LABEL_WRAP = SIDE_COLUMN_WIDTH - (2 * REFERENCE_CONTROL_PADDING);

/** Between the lowest reference control and the top of the hint panel under it. */
export const REFERENCE_SHELF_HINT_GAP = 12;

/** Between the hint's last line and the canvas floor. */
export const HINT_BOTTOM_MARGIN = 24;

/**
 * The ceiling the reference shelf must not grow past.
 *
 * The colleague's hint grows *upward* from the canvas floor and the shelf grows *downward* from the
 * control above it, so the two approach each other. This is the line where the renderer stops adding
 * controls.
 *
 * **Measured, not reserved.** This used to subtract a fixed 120px "clearance" sized for four wrapped
 * lines. A hint line is capped at 320 characters, which at `HINT_TEXT_WRAP` is closer to seven lines,
 * and the longest shipped French hint already needs ~160px — the shelf cleared it only because the two
 * shipped labels happen to stop short. `hintPanelTop` is the hint panel's *own measured top* from the
 * pass that just laid it out, so a longer sentence pushes the shelf instead of being painted over by
 * it. This is the same rule the reading room's detail panel and gate band follow, and the same defect
 * the 1.11, 1.12, 2.5, 2.6 and 2.7 reviews each found: an object placed against a constant while the
 * object beside it grew with French copy.
 *
 * @param hintPanelTop The measured top of the hint panel, or `undefined` when no hint is showing.
 */
export const referenceShelfFloor = (canvasHeight: number, hintPanelTop?: number): number =>
    hintPanelTop === undefined
        ? canvasHeight - HINT_BOTTOM_MARGIN
        : hintPanelTop - REFERENCE_SHELF_HINT_GAP;
/** Between the attributed speaker line and the hint prose under it. */
export const HINT_SPEAKER_GAP = 4;
export const HINT_PADDING = 12;
export const HINT_LINE_FONT_SIZE = 14;
export const HINT_SPEAKER_FONT_SIZE = 13;
export const HINT_TEXT_WRAP = SIDE_COLUMN_WIDTH - (2 * HINT_PADDING);

/**
 * The design-space centre of the control that leaves the laboratory, so a browser test can click it
 * without restating the column's gutters.
 */
export const advanceToSynthesisControlCentre = (): Readonly<{ x: number; y: number }> =>
    advanceControlCentre({ x: SIDE_COLUMN_LEFT, y: ADVANCE_CONTROL_Y, width: SIDE_COLUMN_WIDTH });

// ================================================================================================
// The bench (Story 2.10)
// ================================================================================================

/**
 * Where the instruments, the start control, the wavelength chooser and the notebook control stand.
 *
 * ## The space this had to fit into, measured rather than chosen
 *
 * The canvas is a fixed 1024×768 `Scale.FIT` surface that does not scroll, and most of it is already
 * spoken for: the title and guide across the top to y≈90, the tableau from y 92 with the screen bar
 * reaching **x 707** at the longest authored throw and its label running to y≈342, the visual guidance
 * line under that, and the side column from {@link SIDE_COLUMN_LEFT} = 680. What is left is roughly
 * **x 40–660 by y 404–768** — about 620 × 364 — and every number below is spent out of that.
 *
 * The two hard bounds are therefore {@link BENCH_RIGHT} < {@link SIDE_COLUMN_LEFT}, and
 * {@link BENCH_TOP} below the deepest the apparatus reaches at any distance the player can select.
 * Neither is obvious from either file alone, which is why `ApparatusGeometry.test.ts` pins both
 * against {@link screenXForDistance} and the authored bounds rather than trusting this comment — the
 * same reason {@link ADVANCE_CONTROL_Y}'s rationale is written out above.
 *
 * ## No Phaser, still
 *
 * The one type imported here is `PrimaryControl`, which is pure domain. Everything else is arithmetic
 * over an authored control and a canvas size passed in by the caller. That is what lets
 * `canvas-transitions.spec.ts`, `young-canvas-experiment.spec.ts` and `french-typography.spec.ts`
 * derive every click target and every wrap bound instead of restating a literal that would drift.
 */
export const BENCH_LEFT = 40;
/** Twenty clear pixels short of the side column, so nothing on the bench can touch it. */
export const BENCH_RIGHT = SIDE_COLUMN_LEFT - 20;
/**
 * The bench's ceiling.
 *
 * Below the screen label's baseline plus its line height (y≈342) with room to spare, at **every**
 * authored throw — the bar itself stops at y=308 and the label under it at y≈342, and both are fixed
 * in y however far right the screen slides. 404 is that floor plus a 62px breathing gap, which is what
 * the visual guidance line above needs when French wraps it to three lines at 13px.
 */
export const BENCH_TOP = 404;

/** One instrument per authored control, in a row across the left of the bench. */
export const INSTRUMENT_SLOT_WIDTH = 168;
export const INSTRUMENT_SLOT_GAP = 14;
export const instrumentSlotLeft = (index: number): number =>
    BENCH_LEFT + (index * (INSTRUMENT_SLOT_WIDTH + INSTRUMENT_SLOT_GAP));

/**
 * The knob's body and the travel arc drawn outside it.
 *
 * 34px of body is where a knob stops reading as a dot and starts reading as something a hand turns;
 * the arc sits 12px clear of it so the indicator and the detents are separable at the 93.75% scale a
 * 1280×720 window renders this surface at.
 */
export const KNOB_BODY_RADIUS = 34;
export const KNOB_TRAVEL_RADIUS = 46;
export const KNOB_TICK_LENGTH = 7;
export const KNOB_INDICATOR_LENGTH = 26;
/** The visible focus treatment `EXPERIENCE.md` §Controls asks for. There is no DOM focus on a canvas. */
export const KNOB_FOCUS_RADIUS = KNOB_TRAVEL_RADIUS + 8;

export const knobCentre = (index: number): Readonly<{ x: number; y: number }> => ({
    x: instrumentSlotLeft(index) + (INSTRUMENT_SLOT_WIDTH / 2),
    y: BENCH_TOP + KNOB_TRAVEL_RADIUS
});

/**
 * The discrete step affordances, which every draggable instrument keeps (ADR-012).
 *
 * Drawn as part of the instrument, under its own knob, rather than as the retired 27px `+` / `−` text
 * buttons at a fixed x. They dispatch through the same path the drag does, so a step and a drag to the
 * same value produce the same record — which is AC3.
 */
export const STEP_AFFORDANCE_WIDTH = 34;
export const STEP_AFFORDANCE_HEIGHT = 26;
/** Clear space between the pair, so neither is hit by a click aimed at the other. */
export const STEP_AFFORDANCE_GAP = 26;
export const STEP_AFFORDANCE_FONT_SIZE = 18;
export const STEP_AFFORDANCE_Y = BENCH_TOP + (2 * KNOB_TRAVEL_RADIUS) + 12;

export const stepAffordanceCentre = (index: number, direction: -1 | 1): Readonly<{ x: number; y: number }> => ({
    x: knobCentre(index).x + (direction * ((STEP_AFFORDANCE_GAP / 2) + (STEP_AFFORDANCE_WIDTH / 2))),
    y: STEP_AFFORDANCE_Y + (STEP_AFFORDANCE_HEIGHT / 2)
});

/**
 * The value and unit beside the instrument — AC1's "legible beside it", and the HUD rule that diegetic
 * never means hidden.
 *
 * Wrapped at the **slot**, not at the bench: a readout bounded by the bench would run straight under
 * the neighbouring instrument. `"Écartement des fentes : 0,25 mm"` needs two lines at this bound in
 * French and one in English, which is why the band below reserves two.
 */
export const INSTRUMENT_READOUT_FONT_SIZE = 14;
export const INSTRUMENT_READOUT_WRAP = INSTRUMENT_SLOT_WIDTH;
export const INSTRUMENT_READOUT_Y = STEP_AFFORDANCE_Y + STEP_AFFORDANCE_HEIGHT + 10;
/** Two lines at {@link INSTRUMENT_READOUT_FONT_SIZE}, which is what the longest French label needs. */
export const INSTRUMENT_READOUT_HEIGHT = 40;

/**
 * The optional wavelength comparison, in the column beside the instruments (AC7).
 *
 * Beside rather than below, because the bench has no spare vertical band: the result readout and the
 * bottom control row already have the floor. The choices are authored — 550 nm plus whatever
 * `experiment.wavelengthComparison.advancedChoicesNm` carries — so the column is sized for the count
 * the case actually ships rather than for three.
 */
export const WAVELENGTH_COLUMN_LEFT = 410;
export const WAVELENGTH_COLUMN_WIDTH = 250;
export const WAVELENGTH_HEADING_Y = BENCH_TOP;
export const WAVELENGTH_HEADING_FONT_SIZE = 13;
export const WAVELENGTH_CHOICES_TOP = BENCH_TOP + 24;
export const WAVELENGTH_CHOICE_HEIGHT = 32;
export const WAVELENGTH_CHOICE_GAP = 8;
export const WAVELENGTH_CHOICE_FONT_SIZE = 13;
export const WAVELENGTH_CHOICE_PADDING = 12;
export const WAVELENGTH_CHOICE_LABEL_WRAP = WAVELENGTH_COLUMN_WIDTH - (2 * WAVELENGTH_CHOICE_PADDING);

export const wavelengthChoiceTop = (index: number): number =>
    WAVELENGTH_CHOICES_TOP + (index * (WAVELENGTH_CHOICE_HEIGHT + WAVELENGTH_CHOICE_GAP));

export const wavelengthChoiceCentre = (index: number): Readonly<{ x: number; y: number }> => ({
    x: WAVELENGTH_COLUMN_LEFT + (WAVELENGTH_COLUMN_WIDTH / 2),
    y: wavelengthChoiceTop(index) + (WAVELENGTH_CHOICE_HEIGHT / 2)
});

/**
 * The three controls the bench is actually operated from: the one that starts the light, the one that
 * opens the notebook, and the one that puts the setup back (Story 2.12, D3).
 *
 * All three fixed-height, so all three are in `french-typography.spec.ts`'s **whole-string** sweep. A
 * per-token sweep provably cannot see a two-word French label wrapping to two lines inside a fixed
 * rectangle, and that is recorded in three previous reviews.
 *
 * ## Why the row was re-cut rather than extended
 *
 * The row used to be two 240px controls at x 40 and 296, ending at 536, with 124px left before
 * {@link BENCH_RIGHT}. `Réinitialiser le banc` is 21 characters and needs roughly 170px of wrap to
 * hold two lines at {@link BENCH_CONTROL_FONT_SIZE}; 100px of usable wrap would have taken it to three
 * and cropped it — the defect class the 2.11 review found sixteen times in one story. So the row is
 * divided evenly instead: three controls of {@link BENCH_CONTROL_WIDTH} with {@link BENCH_CONTROL_GAP}
 * between them, spending exactly `BENCH_LEFT … BENCH_RIGHT` and nothing more.
 *
 * The height went 44 → 50 for the same reason and with the same arithmetic: two lines at 15px is
 * `2 × ceil(15 × 1.35)` = 42px, which fits inside 44 only if the label is painted with a single pixel
 * of air above and below it. 50 leaves a 4px margin on each side, and `704 + 50 = 754` still clears the
 * 768px floor. `ApparatusGeometry.test.ts` pins both bounds rather than trusting this comment.
 */
export const BENCH_CONTROL_ROW_Y = 704;
export const BENCH_CONTROL_HEIGHT = 50;
export const BENCH_CONTROL_FONT_SIZE = 15;
export const BENCH_CONTROL_PADDING = 12;
export const BENCH_CONTROL_GAP = 16;
export const BENCH_CONTROL_COUNT = 3;
/** The row divides the bench evenly, so the three controls end exactly on {@link BENCH_RIGHT}. */
export const BENCH_CONTROL_WIDTH =
    (BENCH_RIGHT - BENCH_LEFT - ((BENCH_CONTROL_COUNT - 1) * BENCH_CONTROL_GAP)) / BENCH_CONTROL_COUNT;
export const benchControlLeft = (index: number): number =>
    BENCH_LEFT + (index * (BENCH_CONTROL_WIDTH + BENCH_CONTROL_GAP));
export const START_CONTROL_LEFT = benchControlLeft(0);
export const NOTEBOOK_CONTROL_LEFT = benchControlLeft(1);
export const RESET_CONTROL_LEFT = benchControlLeft(2);
/** One bound, because the three controls are one row of one width — not three that agree by accident. */
export const BENCH_CONTROL_LABEL_WRAP = BENCH_CONTROL_WIDTH - (2 * BENCH_CONTROL_PADDING);

const benchControlCentre = (left: number): Readonly<{ x: number; y: number }> => ({
    x: left + (BENCH_CONTROL_WIDTH / 2),
    y: BENCH_CONTROL_ROW_Y + (BENCH_CONTROL_HEIGHT / 2)
});

export const startTheLightControlCentre = (): Readonly<{ x: number; y: number }> =>
    benchControlCentre(START_CONTROL_LEFT);

export const notebookControlCentre = (): Readonly<{ x: number; y: number }> =>
    benchControlCentre(NOTEBOOK_CONTROL_LEFT);

/**
 * The control that puts the apparatus back to its authored defaults (Story 2.12, D3).
 *
 * `reduceApparatusReset` sets every primary control to its `defaultValue` and the wavelength to
 * 550 nm / minimum, and touches **nothing else** — Story 2.2's shipped acceptance criterion is
 * "reset is immediate and does not erase saved observations", and the reducer already honours it.
 */
export const resetControlCentre = (): Readonly<{ x: number; y: number }> =>
    benchControlCentre(RESET_CONTROL_LEFT);

/**
 * Where a refused start or a refused wavelength is answered.
 *
 * Bottom-anchored into the gap above the control row, for the reason the colleague hint and the result
 * readout are: a refusal is a localized sentence, French runs 15–25% longer than English, and this
 * surface does not scroll — so it has to grow *upward* into empty space rather than downward off the
 * canvas. The result readout above it then stacks on this one's **measured** top, never on a constant.
 */
export const BENCH_MESSAGE_BOTTOM_Y = BENCH_CONTROL_ROW_Y - 12;
export const BENCH_MESSAGE_FONT_SIZE = 14;
export const BENCH_MESSAGE_WRAP = BENCH_RIGHT - BENCH_LEFT;
/** Between the bench message's measured top and the bottom of the result readout above it. */
export const BENCH_MESSAGE_GAP = 8;
/** Between the bottom of the result readout and the bench message under it. */
export const RESULT_READOUT_GAP = 14;

/**
 * The ceiling the result readout and the bench message share: the first y they must not cross.
 *
 * **Derived, because the constant it replaces stopped being true** (review 2026-08-07). The readout used
 * to shrink against a flat `RESULT_READOUT_MAX_HEIGHT = 96`, chosen when the readout's bottom was pinned
 * at 564. Story 2.10 moved that bottom to {@link BENCH_MESSAGE_BOTTOM_Y} minus the *measured* height of
 * a refusal — 114 px lower with no refusal standing, and lower still with one — but the 96 was not
 * re-derived. The permitted top therefore moved up with it: 582 with no message against instrument
 * readouts ending at 584 (two pixels), and roughly 538 behind a two-line French refusal, which is 46 px
 * straight over both readouts. Bottom-anchoring a band that grows is right; bounding it by a constant
 * measured against a different anchor is the "measure, never assume" defect seven previous reviews found.
 *
 * So the headroom is now the distance from this line down to wherever the readout's bottom has landed,
 * and this line is where the instruments genuinely end.
 */
export const RESULT_READOUT_CEILING_Y = INSTRUMENT_READOUT_Y + INSTRUMENT_READOUT_HEIGHT + RESULT_READOUT_GAP;

/** One named rectangle a bench object occupies, for the non-overlap invariant. */
export type BenchBand = Readonly<{ name: string; left: number; right: number; top: number; bottom: number }>;

/**
 * Every rectangle the bench paints, at the canvas size the caller passes.
 *
 * Exported for the geometry test rather than assembled inside it, for the reason the 2.9 review made
 * unmissable: every staging test there fabricated its own band, so the board staged zero figures at
 * every panel height while the assertions were green. A test that builds its own rectangles tests
 * arithmetic; this drives the numbers the renderer actually places against.
 *
 * **The bench is an absolute layout on the fixed design surface, and this function now says so**
 * (review 2026-08-07). It used to take a canvas width and height: the width was ignored outright, and the
 * height was used to floor-anchor the control row as `canvasHeight - (768 - BENCH_CONTROL_ROW_Y)` — while
 * the renderer places that row at `BENCH_CONTROL_ROW_Y` itself. The two agreed only at the design height,
 * so away from it every clearance this function reported was asserted about a rectangle nothing painted:
 * the 2.9 fabricated-band defect, inside the function written to prevent it. It never bit, because
 * `main.ts` configures `Scale.FIT` over a fixed 1024×768 surface and `scene.scale.height` is always 768 —
 * which is precisely why taking a size and then not honouring it was a lie rather than a bug.
 *
 * Where a band genuinely *does* move, the argument comes back: `referenceShelfFloor` takes the hint's
 * measured top, and `screenXForDistance` takes the authored throw. `libraryGeometry.ts` floor-anchors for
 * real, because the reading room has a band that grows from the floor. The bench does not.
 */
export const benchObjectBands = (controls: readonly PrimaryControl[]): readonly BenchBand[] => {
    const controlRowTop = BENCH_CONTROL_ROW_Y;
    const instruments = controls.flatMap((control, index) => {
        const slotLeft = instrumentSlotLeft(index);
        const centre = knobCentre(index);
        return [
            {
                name: `knob ${control.id}`,
                left: centre.x - KNOB_FOCUS_RADIUS,
                right: centre.x + KNOB_FOCUS_RADIUS,
                top: centre.y - KNOB_FOCUS_RADIUS,
                bottom: centre.y + KNOB_FOCUS_RADIUS
            },
            {
                name: `step affordances ${control.id}`,
                left: stepAffordanceCentre(index, -1).x - (STEP_AFFORDANCE_WIDTH / 2),
                right: stepAffordanceCentre(index, 1).x + (STEP_AFFORDANCE_WIDTH / 2),
                top: STEP_AFFORDANCE_Y,
                bottom: STEP_AFFORDANCE_Y + STEP_AFFORDANCE_HEIGHT
            },
            {
                name: `readout ${control.id}`,
                left: slotLeft,
                right: slotLeft + INSTRUMENT_SLOT_WIDTH,
                top: INSTRUMENT_READOUT_Y,
                bottom: INSTRUMENT_READOUT_Y + INSTRUMENT_READOUT_HEIGHT
            }
        ];
    });

    return Object.freeze([
        ...instruments,
        {
            name: 'wavelength chooser',
            left: WAVELENGTH_COLUMN_LEFT,
            right: WAVELENGTH_COLUMN_LEFT + WAVELENGTH_COLUMN_WIDTH,
            top: WAVELENGTH_HEADING_Y,
            // Sized to the count the case ships, not to three: `wavelengthChoiceTop` is total over the
            // index, so a case authoring one more comparison grows this band rather than overflowing it.
            bottom: wavelengthChoiceTop(WAVELENGTH_CHOICE_COUNT_BOUND) + WAVELENGTH_CHOICE_HEIGHT
        },
        ...(['start the light', 'the notebook control', 'the reset control'] as const).map((name, index) => ({
            name,
            left: benchControlLeft(index),
            right: benchControlLeft(index) + BENCH_CONTROL_WIDTH,
            top: controlRowTop,
            bottom: controlRowTop + BENCH_CONTROL_HEIGHT
        })),
        {
            /**
             * The region the result readout and the bench message share, and the band this sweep was
             * missing (review 2026-08-07).
             *
             * Both are `Text` bottom-anchored into the gap above the control row, both grow *upward* with
             * a longer French string, and neither had a band — so the all-pairs collision check could not
             * see the two objects on this bench most likely to collide with something, which is how a
             * readout permitted to reach y 582 against instrument readouts ending at y 584 shipped.
             *
             * A reservation rather than a measurement: their heights are known only at runtime, so what
             * the geometry can state is the region they own. Nothing else may enter it, and the renderer
             * shrinks the readout against {@link RESULT_READOUT_CEILING_Y} so nothing leaves it.
             */
            name: 'result readout and bench message',
            left: BENCH_LEFT,
            right: BENCH_LEFT + BENCH_MESSAGE_WRAP,
            top: RESULT_READOUT_CEILING_Y,
            bottom: BENCH_MESSAGE_BOTTOM_Y
        }
    ]);
};

/**
 * How many wavelength choices the band above reserves room for.
 *
 * Three is what the Young case authors (550 plus two comparisons) and the reserve is deliberately not
 * read from the case here: `benchObjectBands` would then shrink its own band to fit whatever content
 * happened to ship, and the check that the chooser clears the readout below would pass for a reason
 * that has nothing to do with the layout holding. A case authoring more than this is a layout change,
 * and the geometry test is where it should be noticed.
 */
export const WAVELENGTH_CHOICE_COUNT_BOUND = 3;

// --- The notebook overlay (AC8) -----------------------------------------------------------------

/**
 * The notebook, presented **over** the bench rather than beside it (D3).
 *
 * Measured, not preferred: after the tableau, the readouts and the side column there is no 620×364
 * band left for a run list with two selections and a note field, and this surface does not scroll. The
 * shape is `ReferenceBookPresenter`'s — the scene owns it, and suppresses its own apparatus input while
 * it is open, because a click meant for the overlay that fell through would move a slit.
 */
export const NOTEBOOK_PANEL_X = 30;
export const NOTEBOOK_PANEL_Y = 60;
export const NOTEBOOK_PANEL_WIDTH = 964;
export const NOTEBOOK_PANEL_HEIGHT = 648;
export const NOTEBOOK_PADDING = 24;
export const NOTEBOOK_HEADING_FONT_SIZE = 22;
export const NOTEBOOK_GUIDE_FONT_SIZE = 13;
export const NOTEBOOK_ROW_FONT_SIZE = 13;
export const NOTEBOOK_ROW_META_FONT_SIZE = 12;
export const NOTEBOOK_HEADING_Y = NOTEBOOK_PANEL_Y + NOTEBOOK_PADDING;
export const NOTEBOOK_GUIDE_Y = NOTEBOOK_HEADING_Y + 34;
export const NOTEBOOK_ROWS_TOP = NOTEBOOK_GUIDE_Y + 46;
export const NOTEBOOK_ROW_HEIGHT = 66;
export const NOTEBOOK_ROW_GAP = 8;
/** Four at a time, with paging, so a fifth observation is reachable rather than silently dropped. */
export const NOTEBOOK_ROWS_PER_PAGE = 4;
export const NOTEBOOK_ROW_LEFT = NOTEBOOK_PANEL_X + NOTEBOOK_PADDING;
export const NOTEBOOK_SELECT_WIDTH = 136;
export const NOTEBOOK_SELECT_HEIGHT = 34;
export const NOTEBOOK_SELECT_GAP = 16;
export const NOTEBOOK_ROW_WIDTH = NOTEBOOK_PANEL_WIDTH - (2 * NOTEBOOK_PADDING) - NOTEBOOK_SELECT_WIDTH - NOTEBOOK_SELECT_GAP;
export const NOTEBOOK_ROW_TEXT_WRAP = NOTEBOOK_ROW_WIDTH - 24;

export type NotebookBand = Readonly<{ x: number; y: number; width: number; height: number }>;

export const notebookRowBand = (index: number): NotebookBand => ({
    x: NOTEBOOK_ROW_LEFT,
    y: NOTEBOOK_ROWS_TOP + (index * (NOTEBOOK_ROW_HEIGHT + NOTEBOOK_ROW_GAP)),
    width: NOTEBOOK_ROW_WIDTH,
    height: NOTEBOOK_ROW_HEIGHT
});

export const notebookSelectionCentre = (index: number): Readonly<{ x: number; y: number }> => ({
    x: NOTEBOOK_ROW_LEFT + NOTEBOOK_ROW_WIDTH + NOTEBOOK_SELECT_GAP + (NOTEBOOK_SELECT_WIDTH / 2),
    y: notebookRowBand(index).y + (NOTEBOOK_ROW_HEIGHT / 2)
});

export const NOTEBOOK_PAGE_CONTROL_WIDTH = 150;
export const NOTEBOOK_PAGE_CONTROL_HEIGHT = 32;
export const NOTEBOOK_PAGE_ROW_Y = NOTEBOOK_ROWS_TOP + (NOTEBOOK_ROWS_PER_PAGE * (NOTEBOOK_ROW_HEIGHT + NOTEBOOK_ROW_GAP)) + 6;

export const notebookPageControlCentre = (direction: -1 | 1): Readonly<{ x: number; y: number }> => ({
    x: NOTEBOOK_ROW_LEFT + (NOTEBOOK_PAGE_CONTROL_WIDTH / 2)
        + (direction === 1 ? NOTEBOOK_PAGE_CONTROL_WIDTH + 12 : 0),
    y: NOTEBOOK_PAGE_ROW_Y + (NOTEBOOK_PAGE_CONTROL_HEIGHT / 2)
});

export const NOTEBOOK_NOTE_LABEL_Y = NOTEBOOK_PAGE_ROW_Y + NOTEBOOK_PAGE_CONTROL_HEIGHT + 14;
export const NOTEBOOK_NOTE_FIELD_Y = NOTEBOOK_NOTE_LABEL_Y + 24;
export const NOTEBOOK_NOTE_FIELD_HEIGHT = 62;
export const NOTEBOOK_NOTE_FIELD_WIDTH = NOTEBOOK_PANEL_WIDTH - (2 * NOTEBOOK_PADDING);
export const NOTEBOOK_NOTE_FONT_SIZE = 14;
export const NOTEBOOK_NOTE_PADDING = 10;
export const NOTEBOOK_NOTE_TEXT_WRAP = NOTEBOOK_NOTE_FIELD_WIDTH - (2 * NOTEBOOK_NOTE_PADDING);
/**
 * A bound on the typed note, because there is no scroll inside a canvas text field.
 *
 * Three lines at {@link NOTEBOOK_NOTE_FONT_SIZE} across {@link NOTEBOOK_NOTE_TEXT_WRAP} is roughly 320
 * characters; 280 leaves the field able to show everything it holds.
 */
export const NOTEBOOK_NOTE_MAX_LENGTH = 280;

export const notebookNoteFieldCentre = (): Readonly<{ x: number; y: number }> => ({
    x: NOTEBOOK_PANEL_X + (NOTEBOOK_PANEL_WIDTH / 2),
    y: NOTEBOOK_NOTE_FIELD_Y + (NOTEBOOK_NOTE_FIELD_HEIGHT / 2)
});

export const NOTEBOOK_ACTION_ROW_Y = NOTEBOOK_NOTE_FIELD_Y + NOTEBOOK_NOTE_FIELD_HEIGHT + 14;
export const NOTEBOOK_ACTION_HEIGHT = 40;
export const NOTEBOOK_ACTION_WIDTH = 260;
export const NOTEBOOK_ACTION_FONT_SIZE = 14;
export const NOTEBOOK_ACTION_PADDING = 12;
export const NOTEBOOK_ACTION_LABEL_WRAP = NOTEBOOK_ACTION_WIDTH - (2 * NOTEBOOK_ACTION_PADDING);

const notebookActionCentre = (left: number): Readonly<{ x: number; y: number }> => ({
    x: left + (NOTEBOOK_ACTION_WIDTH / 2),
    y: NOTEBOOK_ACTION_ROW_Y + (NOTEBOOK_ACTION_HEIGHT / 2)
});

export const NOTEBOOK_SAVE_LEFT = NOTEBOOK_ROW_LEFT;
export const NOTEBOOK_CLOSE_LEFT = NOTEBOOK_PANEL_X + NOTEBOOK_PANEL_WIDTH - NOTEBOOK_PADDING - NOTEBOOK_ACTION_WIDTH;

/**
 * The gap between the save and close controls, where a refusal or confirmation is written.
 *
 * Exported so `french-typography.spec.ts` measures the status line against the width it is actually
 * given, rather than borrowing the note field's wider bound: a sweep that checks a looser bound than the
 * surface has cannot see the wrap it exists to catch (review 2026-08-07). It was being computed inline in
 * the renderer, which is the "spec and source share a number without sharing a constant" habit
 * `designSurface.ts` and this file exist to end.
 */
export const NOTEBOOK_STATUS_TEXT_WRAP =
    NOTEBOOK_CLOSE_LEFT - NOTEBOOK_SAVE_LEFT - NOTEBOOK_ACTION_WIDTH - 32;

export const notebookSaveControlCentre = (): Readonly<{ x: number; y: number }> =>
    notebookActionCentre(NOTEBOOK_SAVE_LEFT);

export const notebookCloseControlCentre = (): Readonly<{ x: number; y: number }> =>
    notebookActionCentre(NOTEBOOK_CLOSE_LEFT);
