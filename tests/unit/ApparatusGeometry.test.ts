import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { CONTROL_AFFORDANCES, controlAffordance, type CaseDefinition, type ControlAffordance, type PrimaryControl } from '../../src/domain/cases/CaseDefinition';
import {
    ADVANCE_CONTROL_HEIGHT,
    ADVANCE_CONTROL_Y,
    BENCH_CONTROL_COUNT,
    BENCH_CONTROL_FONT_SIZE,
    BENCH_CONTROL_GAP,
    BENCH_CONTROL_HEIGHT,
    BENCH_CONTROL_LABEL_WRAP,
    BENCH_CONTROL_PADDING,
    BENCH_CONTROL_ROW_Y,
    BENCH_CONTROL_WIDTH,
    BENCH_LEFT,
    BENCH_MESSAGE_BOTTOM_Y,
    BENCH_RIGHT,
    BENCH_TOP,
    CENTRE_Y,
    HINT_BOTTOM_MARGIN,
    INSTRUMENT_READOUT_FONT_SIZE,
    INSTRUMENT_READOUT_WRAP,
    INSTRUMENT_READOUT_HEIGHT,
    INSTRUMENT_READOUT_Y,
    RESULT_READOUT_CEILING_Y,
    RESULT_READOUT_GAP,
    INSTRUMENT_SLOT_WIDTH,
    KNOB_TRAVEL_RADIUS,
    NOTEBOOK_NOTE_MAX_LENGTH,
    NOTEBOOK_PANEL_HEIGHT,
    NOTEBOOK_PANEL_WIDTH,
    NOTEBOOK_PANEL_X,
    NOTEBOOK_PANEL_Y,
    NOTEBOOK_ROWS_PER_PAGE,
    SCREEN_BAR_HALF_WIDTH,
    SCREEN_HALF_HEIGHT,
    SCREEN_LABEL_HEIGHT,
    SCREEN_LABEL_Y,
    SIDE_COLUMN_LEFT,
    SIDE_COLUMN_WIDTH,
    STEP_AFFORDANCE_HEIGHT,
    STEP_AFFORDANCE_Y,
    WAVELENGTH_CHOICE_LABEL_WRAP,
    WAVELENGTH_COLUMN_LEFT,
    WAVELENGTH_COLUMN_WIDTH,
    advanceToSynthesisControlCentre,
    benchControlLeft,
    benchObjectBands,
    KNOB_FOCUS_RADIUS,
    DIAL_FOCUS_RADIUS,
    DIAL_INDEX_OUTER_RADIUS,
    SLIDER_HALF_WIDTH,
    SLIDER_HALF_HEIGHT,
    instrumentBand,
    instrumentCentre,
    instrumentSlotLeft,
    knobCentre,
    notebookCloseControlCentre,
    notebookControlCentre,
    notebookNoteFieldCentre,
    notebookPageControlCentre,
    notebookRowBand,
    notebookSaveControlCentre,
    notebookSelectionCentre,
    resetControlCentre,
    screenXForDistance,
    startTheLightControlCentre,
    stepAffordanceCentre,
    wavelengthChoiceCentre
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';
import { CaseDefinitionSchema, MAX_PRIMARY_CONTROLS } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The laboratory side column must not sit on top of the apparatus it stands beside.
 *
 * Added in review (2026-08-06). The advance control shipped at y=130, which put an opaque 40px band
 * across the interference screen — and swallowed pointer events over it into a phase advance —
 * whenever the throw was long enough to slide the screen right into the column. Reachable in normal
 * play at the two longest authored distances, and the authored hints ask the player to slide the
 * screen back. The module's own comment asserted the apparatus stopped at x≈612, which is true only
 * at the default 2 m.
 *
 * The point of pinning it here rather than trusting a comment: the overlap is a *joint* property of
 * the column's constants and the screen's placement function, and neither file's numbers look wrong
 * on their own.
 *
 * Design space, not device pixels: the canvas is `Scale.FIT` over the surface `designSurface.ts`
 * states. Read from that module rather than restated — it is the same pair the Phaser config reads,
 * and the 2.8 review found three specs declaring a fresh copy of it in the commit that created the
 * module to stop exactly that.
 */

let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;

    const prototype: unknown = JSON.parse(await readFile('public/cases/morley-miller/case.json', 'utf8'));
    const parsedPrototype = CaseDefinitionSchema.safeParse(prototype);
    if (!parsedPrototype.success) throw new Error('The authored Morley–Miller case must parse.');
    prototypeControls = (parsedPrototype.data as CaseDefinition).apparatus.primaryControls;
});

/** Every screen distance the player can actually select, from the authored bounds. */
const authoredScreenDistances = (): number[] => {
    const screen = definition.apparatus.primaryControls.find(({ id }) => id === 'screenDistanceM');
    if (!screen) throw new Error('The authored case must carry a screen-distance control.');
    const values: number[] = [];
    for (let d = screen.min; d <= screen.max + 1e-9; d += screen.step) values.push(Number(d.toFixed(4)));
    return values;
};

describe('the laboratory side column', () => {
    it('clears the interference screen at every authored throw', () => {
        const controlTop = ADVANCE_CONTROL_Y;
        const controlBottom = ADVANCE_CONTROL_Y + ADVANCE_CONTROL_HEIGHT;
        const screenTop = CENTRE_Y - SCREEN_HALF_HEIGHT;
        const screenBottom = CENTRE_Y + SCREEN_HALF_HEIGHT;

        const overlapping = authoredScreenDistances()
            .map((screenDistanceM) => ({ screenDistanceM, screenX: screenXForDistance(screenDistanceM) }))
            .filter(({ screenX }) => {
                const overlapsHorizontally = screenX + SCREEN_BAR_HALF_WIDTH > SIDE_COLUMN_LEFT
                    && screenX - SCREEN_BAR_HALF_WIDTH < SIDE_COLUMN_LEFT + SIDE_COLUMN_WIDTH;
                const overlapsVertically = controlTop < screenBottom && controlBottom > screenTop;
                return overlapsHorizontally && overlapsVertically;
            })
            .map(({ screenDistanceM, screenX }) => `${screenDistanceM} m puts the screen at x=${screenX}`);

        expect(overlapping).toEqual([]);
    });

    it('actually reaches into the screen\'s column at the longest throws, so the check above has a subject', () => {
        // Without this the assertion above would pass just as happily on a column the screen never
        // approaches, and would stop being a guard the moment someone widened the apparatus.
        const furthest = screenXForDistance(4);

        expect(furthest + SCREEN_BAR_HALF_WIDTH).toBeGreaterThan(SIDE_COLUMN_LEFT);
        expect(authoredScreenDistances()).toContain(4);
    });

    it('clears the screen label, which is drawn below the bar and offset left into the column', () => {
        expect(ADVANCE_CONTROL_Y).toBeGreaterThan(SCREEN_LABEL_Y + SCREEN_LABEL_HEIGHT);
    });

    it('leaves the hint room to grow upward from the canvas floor', () => {
        // The hint is bottom-anchored and unbounded in height; the control is fixed at the top of the
        // free column. They must not be able to meet.
        const controlBottom = ADVANCE_CONTROL_Y + ADVANCE_CONTROL_HEIGHT;
        const hintFloor = DESIGN_HEIGHT - HINT_BOTTOM_MARGIN;

        expect(hintFloor - controlBottom).toBeGreaterThan(200);
    });

    it('stays inside the canvas', () => {
        expect(SIDE_COLUMN_LEFT + SIDE_COLUMN_WIDTH).toBeLessThanOrEqual(DESIGN_WIDTH);
        expect(ADVANCE_CONTROL_Y + ADVANCE_CONTROL_HEIGHT).toBeLessThan(DESIGN_HEIGHT);
    });

    it('centres the exported click target inside the control it names', () => {
        // The browser specs click this rather than restating coordinates, so a control moved without
        // its centre moving would send every canvas walk to empty space.
        const { x, y } = advanceToSynthesisControlCentre();

        expect(x).toBeGreaterThan(SIDE_COLUMN_LEFT);
        expect(x).toBeLessThan(SIDE_COLUMN_LEFT + SIDE_COLUMN_WIDTH);
        expect(y).toBeGreaterThan(ADVANCE_CONTROL_Y);
        expect(y).toBeLessThan(ADVANCE_CONTROL_Y + ADVANCE_CONTROL_HEIGHT);
    });
});

/**
 * The bench itself (Story 2.10) — the instruments, the start control, the wavelength chooser and the
 * notebook control, which between them spend the whole of the surface left under the apparatus.
 *
 * The invariant this section exists for is the same *joint* property the side column's is: the screen
 * bar slides right **and** the apparatus stops at a fixed y, and neither file's numbers look wrong on
 * their own. `screenXForDistance(4) = 700` and `SIDE_COLUMN_LEFT = 680` are the two hard bounds, and
 * they are read here rather than restated.
 */
const DESIGN = { width: DESIGN_WIDTH, height: DESIGN_HEIGHT } as const;

const authoredControls = (): readonly PrimaryControl[] => definition.apparatus.primaryControls;

/**
 * The prototype's controls, which are the shipped ones that actually author a `dial` and a `slider`.
 *
 * Loaded rather than fabricated so the affordance sweep below measures the arrangement that ships. A
 * synthetic pair would prove the geometry agrees with itself.
 */
let prototypeControls: readonly PrimaryControl[];

describe('the bench', () => {
    it('places every object clear of the interference screen at every authored throw', () => {
        // The bar spans `CENTRE_Y ± SCREEN_HALF_HEIGHT` and its label runs to `SCREEN_LABEL_Y +
        // SCREEN_LABEL_HEIGHT`; the bench must start below both, at every distance the screen can
        // reach. A bench band drawn over the pattern is the defect `ADVANCE_CONTROL_Y = 130` was.
        const apparatusFloor = Math.max(CENTRE_Y + SCREEN_HALF_HEIGHT, SCREEN_LABEL_Y + SCREEN_LABEL_HEIGHT);
        // Both shipped control sets, because the prototype's are drawn as a dial and a slider and an
        // affordance that reached above the apparatus floor would be invisible to a Young-only sweep.
        const reaching = [...benchObjectBands(authoredControls()), ...benchObjectBands(prototypeControls)]
            .filter(({ top }) => top <= apparatusFloor)
            .map(({ name, top }) => `${name} starts at y=${top}, at or above the apparatus floor y=${apparatusFloor}`);

        expect(reaching).toEqual([]);
        // A guard on the sweep: an empty band list would make the assertion vacuous, which is how a
        // geometry test starts passing because the thing it protects moved out of it.
        expect(benchObjectBands(authoredControls()).length).toBeGreaterThan(4);
    });

    it('actually stands under the screen at the shortest throw, so the check above has a subject', () => {
        // Without this the clearance assertion above would pass just as happily on a bench the screen
        // never stands over, and would stop being a guard the moment the bench moved right.
        //
        // **The shortest throw is the subject, not the longest.** At 4 m the bar is at x 693–707,
        // clear to the right of `BENCH_RIGHT` — that distance is the *side column's* problem, which is
        // the invariant pinned further up. At 1 m it stands at x 473–487, directly over the bench's
        // own instruments, and the only thing keeping them apart is `BENCH_TOP` being below the
        // apparatus. That is the property worth pinning here.
        const nearest = screenXForDistance(definition.apparatus.primaryControls
            .find(({ id }) => id === 'screenDistanceM')!.min);

        expect(nearest + SCREEN_BAR_HALF_WIDTH).toBeGreaterThan(BENCH_LEFT);
        expect(nearest - SCREEN_BAR_HALF_WIDTH).toBeLessThan(BENCH_RIGHT);
        // And the screen's own label, which is drawn below the bar and offset left into the same column.
        expect(SCREEN_LABEL_Y + SCREEN_LABEL_HEIGHT).toBeGreaterThan(CENTRE_Y + SCREEN_HALF_HEIGHT);
        expect(BENCH_TOP).toBeGreaterThan(SCREEN_LABEL_Y + SCREEN_LABEL_HEIGHT);
        // The far end is still the side column's, and it still genuinely reaches into it.
        expect(screenXForDistance(4) + SCREEN_BAR_HALF_WIDTH).toBeGreaterThan(SIDE_COLUMN_LEFT);
    });

    it('keeps the whole bench clear of the side column and inside the canvas', () => {
        expect(BENCH_RIGHT).toBeLessThan(SIDE_COLUMN_LEFT);
        expect(BENCH_LEFT).toBeGreaterThan(0);

        const outside = benchObjectBands(authoredControls())
            .filter(({ left, right, bottom }) => left < BENCH_LEFT || right > BENCH_RIGHT || bottom > DESIGN.height)
            .map(({ name, left, right, bottom }) => `${name}: x ${left}–${right}, bottom ${bottom}`);

        expect(outside).toEqual([]);
    });

    it('stacks the bench downward without any two of its bands overlapping', () => {
        // Every band is measured against every other one. The bench is the densest surface in the
        // game and its objects are placed against constants, which is the exact combination the 1.11,
        // 1.12, 2.5, 2.6, 2.7, 2.8 and 2.9 reviews each found a defect in.
        const bands = benchObjectBands(authoredControls());
        const collisions = bands.flatMap((first, index) => bands.slice(index + 1)
            .filter((second) => first.top < second.bottom && second.top < first.bottom
                && first.left < second.right && second.left < first.right)
            .map((second) => `${first.name} overlaps ${second.name}`));

        expect(collisions).toEqual([]);
    });

    // Story 3.1 removed the `z.tuple([PC, PC])` that made the control count unauthorable and replaced it
    // with `z.array(PC).min(1).max(MAX_PRIMARY_CONTROLS)`. This is what pins that ceiling to the geometry
    // it exists for, so the number and its justification fail together rather than the number drifting
    // into a comment nobody checks. The schema exports the constant; nothing here restates 2.
    it('caps the authored control count at the largest number of slots that clears the wavelength chooser', () => {
        const collisions = (count: number): readonly string[] => {
            const controls = Array.from({ length: count }, (_control, index) => ({ ...authoredControls()[0]!, id: `control-${index}` }));
            const bands = benchObjectBands(controls);
            return bands.flatMap((first, index) => bands.slice(index + 1)
                .filter((second) => first.top < second.bottom && second.top < first.bottom
                    && first.left < second.right && second.left < first.right)
                .map((second) => `${first.name} overlaps ${second.name}`));
        };

        // At the ceiling every band is disjoint; one above it, the instruments reach into the chooser.
        expect(collisions(MAX_PRIMARY_CONTROLS)).toEqual([]);
        expect(collisions(MAX_PRIMARY_CONTROLS + 1)).not.toEqual([]);
        expect(collisions(MAX_PRIMARY_CONTROLS + 1).join(' ')).toContain('wavelength chooser');
    });

    it('gives each authored control its own slot, in order, left to right', () => {
        const controls = authoredControls();
        const lefts = controls.map((_control, index) => instrumentSlotLeft(index));

        expect(lefts[0]).toBe(BENCH_LEFT);
        lefts.slice(1).forEach((left, index) => expect(left).toBeGreaterThan(lefts[index]! + INSTRUMENT_SLOT_WIDTH - 1));
        expect(lefts[lefts.length - 1]! + INSTRUMENT_SLOT_WIDTH).toBeLessThanOrEqual(WAVELENGTH_COLUMN_LEFT);
    });

    it('centres each knob in its own slot with room for its travel arc above the step affordances', () => {
        authoredControls().forEach((_control, index) => {
            const centre = knobCentre(index);
            const slotLeft = instrumentSlotLeft(index);

            expect(centre.x).toBe(slotLeft + (INSTRUMENT_SLOT_WIDTH / 2));
            expect(centre.x - KNOB_TRAVEL_RADIUS).toBeGreaterThanOrEqual(slotLeft);
            expect(centre.x + KNOB_TRAVEL_RADIUS).toBeLessThanOrEqual(slotLeft + INSTRUMENT_SLOT_WIDTH);
            expect(centre.y - KNOB_TRAVEL_RADIUS).toBeGreaterThanOrEqual(BENCH_TOP);
            expect(centre.y + KNOB_TRAVEL_RADIUS).toBeLessThanOrEqual(STEP_AFFORDANCE_Y);
        });
    });

    it('puts the two step affordances either side of the knob, inside the slot and above the readout', () => {
        authoredControls().forEach((_control, index) => {
            const centre = knobCentre(index);
            const decrease = stepAffordanceCentre(index, -1);
            const increase = stepAffordanceCentre(index, 1);

            expect(decrease.x).toBeLessThan(centre.x);
            expect(increase.x).toBeGreaterThan(centre.x);
            expect(decrease.y).toBe(increase.y);
            expect(decrease.y).toBeGreaterThan(STEP_AFFORDANCE_Y);
            expect(decrease.y).toBeLessThan(STEP_AFFORDANCE_Y + STEP_AFFORDANCE_HEIGHT);
            expect(STEP_AFFORDANCE_Y + STEP_AFFORDANCE_HEIGHT).toBeLessThan(INSTRUMENT_READOUT_Y);
            expect(decrease.x).toBeGreaterThan(instrumentSlotLeft(index));
            expect(increase.x).toBeLessThan(instrumentSlotLeft(index) + INSTRUMENT_SLOT_WIDTH);
        });
    });

    it('stacks one wavelength choice per authored option inside the chooser column', () => {
        const choices = 1 + (definition.experiment.wavelengthComparison?.advancedChoicesNm.length ?? 0);
        expect(choices).toBeGreaterThan(1);

        const centres = Array.from({ length: choices }, (_unused, index) => wavelengthChoiceCentre(index));
        centres.forEach(({ x, y }) => {
            expect(x).toBeGreaterThan(WAVELENGTH_COLUMN_LEFT);
            expect(x).toBeLessThan(WAVELENGTH_COLUMN_LEFT + WAVELENGTH_COLUMN_WIDTH);
            expect(y).toBeGreaterThan(BENCH_TOP);
        });
        centres.slice(1).forEach(({ y }, index) => expect(y).toBeGreaterThan(centres[index]!.y));
        expect(WAVELENGTH_COLUMN_LEFT + WAVELENGTH_COLUMN_WIDTH).toBeLessThanOrEqual(BENCH_RIGHT);
        expect(WAVELENGTH_CHOICE_LABEL_WRAP).toBeLessThan(WAVELENGTH_COLUMN_WIDTH);
    });

    it('centres the start, notebook and reset controls inside the row they share', () => {
        const start = startTheLightControlCentre();
        const notebook = notebookControlCentre();
        const reset = resetControlCentre();

        [start, notebook, reset].forEach(({ y }) => {
            expect(y).toBeGreaterThan(BENCH_CONTROL_ROW_Y);
            expect(y).toBeLessThan(BENCH_CONTROL_ROW_Y + BENCH_CONTROL_HEIGHT);
        });
        expect(start.x).toBeLessThan(notebook.x);
        expect(notebook.x).toBeLessThan(reset.x);
        // The bench message grows upward out of the gap above this row, so the row cannot start at the
        // canvas floor and the message cannot be placed against a constant below it.
        expect(BENCH_MESSAGE_BOTTOM_Y).toBeLessThan(BENCH_CONTROL_ROW_Y);
        expect(BENCH_CONTROL_ROW_Y + BENCH_CONTROL_HEIGHT).toBeLessThan(DESIGN.height);
        expect(BENCH_CONTROL_LABEL_WRAP).toBeGreaterThan(0);
    });

    /**
     * The row spends the bench exactly, and holds two French lines (Story 2.12, D3).
     *
     * Both halves are the thing the reset control could plausibly get wrong. A third control appended
     * to the old two 240px ones would have had ~100px of usable wrap for `Réinitialiser le banc`, which
     * is three lines at the authored size; and 44px of height holds `2 × ceil(15 × 1.35)` = 42px of
     * label with one pixel of air, which is a crop waiting for the next word to be added.
     *
     * The arithmetic is done here rather than asserted as literals, because `sceneSlice.ts` reports a
     * constant `height: 18` for every Phaser text object — so no unit test in this project can *measure*
     * a rendered label, and the whole-string sweep in `french-typography.spec.ts` plus a screenshot are
     * what actually see it. What this can prove is that the reserve is big enough for the line count the
     * sweep bounds it to.
     */
    it('divides the bench evenly across the three controls and reserves two lines of label', () => {
        expect(BENCH_CONTROL_COUNT).toBe(3);
        expect(benchControlLeft(0)).toBe(BENCH_LEFT);
        expect(benchControlLeft(BENCH_CONTROL_COUNT - 1) + BENCH_CONTROL_WIDTH).toBe(BENCH_RIGHT);
        // Gaps between neighbours are the stated gap, not whatever fell out of the division.
        for (let index = 1; index < BENCH_CONTROL_COUNT; index += 1) {
            expect(benchControlLeft(index) - (benchControlLeft(index - 1) + BENCH_CONTROL_WIDTH))
                .toBe(BENCH_CONTROL_GAP);
        }
        // Two lines at the authored size, with air. `uiTextStyle` renders at a 1.35 line box.
        const twoFrenchLines = 2 * Math.ceil(BENCH_CONTROL_FONT_SIZE * 1.35);
        expect(BENCH_CONTROL_HEIGHT).toBeGreaterThan(twoFrenchLines);
        expect(BENCH_CONTROL_LABEL_WRAP).toBe(BENCH_CONTROL_WIDTH - (2 * BENCH_CONTROL_PADDING));
    });

    /**
     * The bench is an absolute layout on the design surface, and this pins that it fits it.
     *
     * `benchObjectBands` used to take a canvas width and height: the width was ignored, and the height
     * floor-anchored the control row as `canvasHeight - (768 - BENCH_CONTROL_ROW_Y)` while the renderer
     * placed that row at `BENCH_CONTROL_ROW_Y` itself. The two agreed only at 768, so away from it every
     * clearance this suite reported was about a rectangle nothing painted — and the test that claimed to
     * cover it asserted only that the band *names* matched and that nothing exceeded `height + 120`, both
     * of which held identically if the height were ignored altogether. Nothing restates 1024×768: the
     * surface comes from `designSurface.ts`, which is the rule that mattered in the original.
     */
    it('fits inside the design surface it is laid out against', () => {
        const bands = benchObjectBands(authoredControls());

        expect(bands.length).toBeGreaterThan(4);
        expect(bands.every(({ bottom }) => bottom <= DESIGN.height)).toBe(true);
        expect(bands.every(({ right }) => right <= DESIGN.width)).toBe(true);
        // The renderer's own number for the row, not a recomputation of it.
        const row = bands.filter(({ name }) => name === 'start the light' || name === 'the notebook control');
        expect(row).toHaveLength(2);
        row.forEach(({ top }) => expect(top).toBe(BENCH_CONTROL_ROW_Y));
    });

    /**
     * The result readout and the bench message have a band, and it clears the instruments.
     *
     * Neither had one before this review, so the all-pairs sweep above — written for exactly this defect
     * class — could not see the two objects on the bench most likely to collide with something: both are
     * `Text`, both are bottom-anchored into the gap above the control row, and both grow *upward* with a
     * longer French string. The readout was permitted to reach y 582 against instrument readouts ending at
     * y 584, and roughly y 538 behind a two-line French refusal.
     */
    it('reserves the readout and refusal region below the instruments, with the ceiling derived', () => {
        const bands = benchObjectBands(authoredControls());
        const reserved = bands.find(({ name }) => name === 'result readout and bench message');
        expect(reserved).toBeDefined();

        // The ceiling is where the instrument readouts genuinely end, plus the stated gap — not a constant
        // chosen against an anchor that has since moved.
        expect(RESULT_READOUT_CEILING_Y).toBe(INSTRUMENT_READOUT_Y + INSTRUMENT_READOUT_HEIGHT + RESULT_READOUT_GAP);
        expect(reserved!.top).toBe(RESULT_READOUT_CEILING_Y);
        expect(reserved!.bottom).toBe(BENCH_MESSAGE_BOTTOM_Y);
        // Below every instrument readout, and above the control row.
        authoredControls().forEach((_control, index) => {
            expect(reserved!.top).toBeGreaterThan(INSTRUMENT_READOUT_Y + INSTRUMENT_READOUT_HEIGHT - 1);
            expect(instrumentSlotLeft(index)).toBeGreaterThanOrEqual(reserved!.left);
        });
        expect(reserved!.bottom).toBeLessThan(BENCH_CONTROL_ROW_Y);
        // And there is genuinely room in it for a readout at its smallest permitted size plus a refusal.
        expect(reserved!.bottom - reserved!.top).toBeGreaterThan(60);
    });
});

describe('the bench notebook overlay', () => {
    it('covers the bench it is presented over, and stays inside the canvas', () => {
        expect(NOTEBOOK_PANEL_X).toBeLessThan(BENCH_LEFT);
        expect(NOTEBOOK_PANEL_X + NOTEBOOK_PANEL_WIDTH).toBeGreaterThan(BENCH_RIGHT);
        expect(NOTEBOOK_PANEL_Y + NOTEBOOK_PANEL_HEIGHT).toBeLessThanOrEqual(DESIGN.height);
        expect(NOTEBOOK_PANEL_X + NOTEBOOK_PANEL_WIDTH).toBeLessThanOrEqual(DESIGN.width);
    });

    it('stacks its observation rows inside the panel, one selection control per row', () => {
        const rows = Array.from({ length: NOTEBOOK_ROWS_PER_PAGE }, (_unused, index) => notebookRowBand(index));

        rows.forEach((row, index) => {
            expect(row.y).toBeGreaterThan(NOTEBOOK_PANEL_Y);
            expect(row.y + row.height).toBeLessThan(NOTEBOOK_PANEL_Y + NOTEBOOK_PANEL_HEIGHT);
            const selection = notebookSelectionCentre(index);
            expect(selection.y).toBeGreaterThan(row.y);
            expect(selection.y).toBeLessThan(row.y + row.height);
            expect(selection.x).toBeGreaterThan(row.x + row.width);
            expect(selection.x).toBeLessThan(NOTEBOOK_PANEL_X + NOTEBOOK_PANEL_WIDTH);
        });
        rows.slice(1).forEach((row, index) => expect(row.y).toBeGreaterThanOrEqual(rows[index]!.y + rows[index]!.height));
    });

    it('places the note field, its save control, the paging and the way out below the rows', () => {
        const lastRow = notebookRowBand(NOTEBOOK_ROWS_PER_PAGE - 1);
        const note = notebookNoteFieldCentre();
        const save = notebookSaveControlCentre();
        const close = notebookCloseControlCentre();
        const earlier = notebookPageControlCentre(-1);
        const later = notebookPageControlCentre(1);

        expect(note.y).toBeGreaterThan(lastRow.y + lastRow.height);
        expect(save.y).toBeGreaterThan(note.y);
        expect(close.y).toBe(save.y);
        expect(close.x).toBeGreaterThan(save.x);
        expect(earlier.x).toBeLessThan(later.x);
        expect(earlier.y).toBe(later.y);
        [note, save, close, earlier, later].forEach(({ y }) =>
            expect(y).toBeLessThan(NOTEBOOK_PANEL_Y + NOTEBOOK_PANEL_HEIGHT));
        expect(NOTEBOOK_NOTE_MAX_LENGTH).toBeGreaterThan(40);
    });

    it('bounds the instrument readout to its own slot rather than to the bench', () => {
        // A readout wrapped at the bench's width would run under the neighbouring instrument. It is
        // the slot that constrains it, and `french-typography.spec.ts` measures against this bound.
        expect(INSTRUMENT_READOUT_WRAP).toBeLessThanOrEqual(INSTRUMENT_SLOT_WIDTH);
        expect(INSTRUMENT_READOUT_FONT_SIZE).toBeGreaterThanOrEqual(13);
    });
});

/**
 * The three affordances share the bench (Story 3.4, AC3/AC4).
 *
 * `benchObjectBands` used to derive **every** band from `knobCentre` and `KNOB_FOCUS_RADIUS`, whatever
 * the control was drawn as. Shipping a second affordance without touching it would have measured a knob
 * that is not drawn while the instrument that *is* drawn overlapped its neighbour unmeasured — the
 * `FIGURE_SLOT_WIDTH` defect one layer down, and the 2.9 fabricated-band defect one layer down again.
 * So these drive the sweep with affordances actually authored.
 */
describe('the bench with three affordances', () => {
    const withAffordance = (affordance: ControlAffordance, index: number): PrimaryControl =>
        ({ ...authoredControls()[0]!, id: `control-${index}`, affordance });

    const collisions = (controls: readonly PrimaryControl[]): readonly string[] => {
        const bands = benchObjectBands(controls);
        return bands.flatMap((first, atIndex) => bands.slice(atIndex + 1)
            .filter((second) => first.top < second.bottom && second.top < first.bottom
                && first.left < second.right && second.left < first.right)
            .map((second) => `${first.name} overlaps ${second.name}`));
    };

    it.each(CONTROL_AFFORDANCES)('keeps a %s inside its own slot and inside the knob row', (affordance) => {
        // Inside the slot horizontally, so the bench layout does not move for an authored affordance;
        // inside the knob's vertical extent, so `BENCH_TOP` and `STEP_AFFORDANCE_Y` do not either.
        [0, 1].forEach((index) => {
            const band = instrumentBand(affordance, index);
            const centre = knobCentre(index);

            expect(band.right - band.left).toBeLessThanOrEqual(INSTRUMENT_SLOT_WIDTH);
            expect(band.left).toBeGreaterThanOrEqual(instrumentSlotLeft(index));
            expect(band.right).toBeLessThanOrEqual(instrumentSlotLeft(index) + INSTRUMENT_SLOT_WIDTH);
            expect(band.top).toBeGreaterThanOrEqual(centre.y - KNOB_FOCUS_RADIUS);
            expect(band.bottom).toBeLessThanOrEqual(centre.y + KNOB_FOCUS_RADIUS);
            // Against the knob's own extent rather than against `BENCH_TOP`: the knob's focus ring
            // already reaches 396 while `BENCH_TOP` is 404, because `BENCH_TOP` anchors the travel arc
            // and not the focus treatment. What must hold is that no new affordance reaches *higher*
            // than the one the bench was laid out around — the clearance above the bench is asserted
            // against the apparatus floor by the sweep at the top of this file, for both cases.
            expect(band.top).toBeGreaterThanOrEqual(knobCentre(index).y - KNOB_FOCUS_RADIUS);
        });
    });

    it('gives each affordance a band derived from what it actually draws', () => {
        // The previous version of this test could not fail for the dial, and said in its own title that
        // it made "measuring the wrong one detectable". `DIAL_FOCUS_RADIUS` is `DIAL_INDEX_OUTER_RADIUS
        // + 6` = 54 and `KNOB_FOCUS_RADIUS` is `KNOB_TRAVEL_RADIUS + 8` = 54 — deliberately equal, so
        // that a dial's band matches a knob's and the bench row does not move. That equality is *design*
        // and stays. What it means for a test is that `new Set(bands).size > 1` was satisfied by the
        // slider alone, and returning `KNOB_FOCUS_RADIUS` unconditionally passed everything here.
        //
        // Assert the derivation rather than the difference: each band is the one its own constants
        // describe. **This still cannot catch a dial band hard-coded to `KNOB_FOCUS_RADIUS`**, and no
        // value-based assertion can, because the two radii are numerically equal on purpose. That is
        // stated here rather than papered over — the equality is pinned below, so the day somebody
        // changes the index mark's clearance and the two diverge, this test becomes live and the
        // hard-coding it cannot see today starts failing.
        const slot = 0;
        const centre = instrumentCentre('knob', slot);

        expect(instrumentBand('slider', slot)).toEqual({
            left: centre.x - SLIDER_HALF_WIDTH, right: centre.x + SLIDER_HALF_WIDTH,
            top: centre.y - SLIDER_HALF_HEIGHT, bottom: centre.y + SLIDER_HALF_HEIGHT
        });
        expect(instrumentBand('dial', slot)).toEqual({
            left: centre.x - DIAL_FOCUS_RADIUS, right: centre.x + DIAL_FOCUS_RADIUS,
            top: centre.y - DIAL_FOCUS_RADIUS, bottom: centre.y + DIAL_FOCUS_RADIUS
        });
        expect(instrumentBand('knob', slot)).toEqual({
            left: centre.x - KNOB_FOCUS_RADIUS, right: centre.x + KNOB_FOCUS_RADIUS,
            top: centre.y - KNOB_FOCUS_RADIUS, bottom: centre.y + KNOB_FOCUS_RADIUS
        });
        // And the dial really does reach further than its ring, which is what its band has to cover —
        // the index mark is painted outside the ring and is now inside the hit area too.
        expect(DIAL_FOCUS_RADIUS).toBeGreaterThan(DIAL_INDEX_OUTER_RADIUS);
        // The deliberate equality, pinned so it is a decision rather than a coincidence. If this line
        // ever fails, the band assertions above stop being tautological for the dial — read the comment.
        expect(DIAL_FOCUS_RADIUS).toBe(KNOB_FOCUS_RADIUS);
    });

    it('measures each control by its own affordance, not by the knob', () => {
        // The mutation target: revert `benchObjectBands` to `knobCentre`/`KNOB_FOCUS_RADIUS` and this
        // fails, because a slider's band is not a knob's and the band is named after what is drawn.
        const controls = [withAffordance('slider', 0), withAffordance('dial', 1)];
        const bands = benchObjectBands(controls);

        expect(bands.map(({ name }) => name)).toEqual(expect.arrayContaining(['slider control-0', 'dial control-1']));
        expect(bands.find(({ name }) => name === 'slider control-0')).toMatchObject(instrumentBand('slider', 0));
        expect(bands.find(({ name }) => name === 'dial control-1')).toMatchObject(instrumentBand('dial', 1));
    });

    /**
     * AC4's other half, and the one that has to be written against an **explicit** `knob` rather than
     * against another defaulted control.
     *
     * The first version of this compared two defaulted controls, so flipping `controlAffordance`'s
     * `?? 'knob'` to `?? 'slider'` moved both sides equally and the whole suite stayed green — the
     * mutation §13 predicts and the exact "test that cannot fail" shape. Comparing the absent case to a
     * spelled-out `knob` is what makes the default a covered decision.
     */
    it('draws a control with no authored affordance exactly as a knob (AC4)', () => {
        const absent = { ...authoredControls()[0]!, id: 'unstated', affordance: undefined };
        const explicit = { ...authoredControls()[0]!, id: 'unstated', affordance: 'knob' as const };

        expect(controlAffordance(absent)).toBe('knob');
        expect(benchObjectBands([absent])).toEqual(benchObjectBands([explicit]));
        // Named after the instrument that is drawn, so the default is visible in the sweep's own output.
        expect(benchObjectBands([absent]).map(({ name }) => name)).toContain('knob unstated');
    });

    it('keeps the bench layout constants unmoved by an authored affordance (AC4)', () => {
        // The step affordances and the readout sit at the same y whatever the instrument is, which is
        // what "the bench layout does not move" means and what keeps `INSTRUMENT_READOUT_Y` honest.
        const named = (controls: readonly PrimaryControl[], prefix: string) => benchObjectBands(controls)
            .filter(({ name }) => name.startsWith(prefix))
            .map(({ top, bottom, left, right }) => ({ top, bottom, left, right }));

        CONTROL_AFFORDANCES.forEach((affordance) => {
            const controls = [withAffordance(affordance, 0), withAffordance(affordance, 1)];

            expect(named(controls, 'step affordances')).toEqual(named(authoredControls(), 'step affordances'));
            expect(named(controls, 'readout')).toEqual(named(authoredControls(), 'readout'));
        });
    });

    it('overlaps nothing for any mix of affordances at the authored ceiling', () => {
        // Every permutation at `MAX_PRIMARY_CONTROLS`, so a slider beside a dial is measured rather
        // than assumed. Two slots, three affordances: nine arrangements, all of which must be clear.
        const failures = CONTROL_AFFORDANCES.flatMap((first) => CONTROL_AFFORDANCES.map((second) => {
            const controls = [withAffordance(first, 0), withAffordance(second, 1)].slice(0, MAX_PRIMARY_CONTROLS);
            return { arrangement: `${first} + ${second}`, collisions: collisions(controls) };
        })).filter(({ collisions: found }) => found.length > 0);

        expect(failures).toEqual([]);
    });

    it('overlaps nothing for the prototype, which authors a dial beside a slider', () => {
        // The shipped arrangement rather than a synthetic one — and the bands are named after what the
        // prototype actually draws, so this fails if the content and the sweep disagree.
        expect(collisions(prototypeControls)).toEqual([]);
        expect(benchObjectBands(prototypeControls).map(({ name }) => name))
            .toEqual(expect.arrayContaining(['dial rotationDeg', 'slider bathTempC']));
    });
});
