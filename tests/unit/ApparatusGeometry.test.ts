import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import type { CaseDefinition, PrimaryControl } from '../../src/domain/cases/CaseDefinition';
import {
    ADVANCE_CONTROL_HEIGHT,
    ADVANCE_CONTROL_Y,
    BENCH_CONTROL_HEIGHT,
    BENCH_CONTROL_ROW_Y,
    BENCH_LEFT,
    BENCH_MESSAGE_BOTTOM_Y,
    BENCH_RIGHT,
    BENCH_TOP,
    CENTRE_Y,
    HINT_BOTTOM_MARGIN,
    INSTRUMENT_READOUT_FONT_SIZE,
    INSTRUMENT_READOUT_WRAP,
    INSTRUMENT_READOUT_Y,
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
    START_CONTROL_LABEL_WRAP,
    STEP_AFFORDANCE_HEIGHT,
    STEP_AFFORDANCE_Y,
    WAVELENGTH_CHOICE_LABEL_WRAP,
    WAVELENGTH_COLUMN_LEFT,
    WAVELENGTH_COLUMN_WIDTH,
    advanceToSynthesisControlCentre,
    benchObjectBands,
    instrumentSlotLeft,
    knobCentre,
    notebookCloseControlCentre,
    notebookControlCentre,
    notebookNoteFieldCentre,
    notebookPageControlCentre,
    notebookRowBand,
    notebookSaveControlCentre,
    notebookSelectionCentre,
    screenXForDistance,
    startTheLightControlCentre,
    stepAffordanceCentre,
    wavelengthChoiceCentre
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

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

describe('the bench', () => {
    it('places every object clear of the interference screen at every authored throw', () => {
        // The bar spans `CENTRE_Y ± SCREEN_HALF_HEIGHT` and its label runs to `SCREEN_LABEL_Y +
        // SCREEN_LABEL_HEIGHT`; the bench must start below both, at every distance the screen can
        // reach. A bench band drawn over the pattern is the defect `ADVANCE_CONTROL_Y = 130` was.
        const apparatusFloor = Math.max(CENTRE_Y + SCREEN_HALF_HEIGHT, SCREEN_LABEL_Y + SCREEN_LABEL_HEIGHT);
        const reaching = benchObjectBands(authoredControls(), DESIGN.width, DESIGN.height)
            .filter(({ top }) => top <= apparatusFloor)
            .map(({ name, top }) => `${name} starts at y=${top}, at or above the apparatus floor y=${apparatusFloor}`);

        expect(reaching).toEqual([]);
        // A guard on the sweep: an empty band list would make the assertion vacuous, which is how a
        // geometry test starts passing because the thing it protects moved out of it.
        expect(benchObjectBands(authoredControls(), DESIGN.width, DESIGN.height).length).toBeGreaterThan(4);
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

        const outside = benchObjectBands(authoredControls(), DESIGN.width, DESIGN.height)
            .filter(({ left, right, bottom }) => left < BENCH_LEFT || right > BENCH_RIGHT || bottom > DESIGN.height)
            .map(({ name, left, right, bottom }) => `${name}: x ${left}–${right}, bottom ${bottom}`);

        expect(outside).toEqual([]);
    });

    it('stacks the bench downward without any two of its bands overlapping', () => {
        // Every band is measured against every other one. The bench is the densest surface in the
        // game and its objects are placed against constants, which is the exact combination the 1.11,
        // 1.12, 2.5, 2.6, 2.7, 2.8 and 2.9 reviews each found a defect in.
        const bands = benchObjectBands(authoredControls(), DESIGN.width, DESIGN.height);
        const collisions = bands.flatMap((first, index) => bands.slice(index + 1)
            .filter((second) => first.top < second.bottom && second.top < first.bottom
                && first.left < second.right && second.left < first.right)
            .map((second) => `${first.name} overlaps ${second.name}`));

        expect(collisions).toEqual([]);
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

    it('centres the start and notebook controls inside the row they share', () => {
        const start = startTheLightControlCentre();
        const notebook = notebookControlCentre();

        [start, notebook].forEach(({ y }) => {
            expect(y).toBeGreaterThan(BENCH_CONTROL_ROW_Y);
            expect(y).toBeLessThan(BENCH_CONTROL_ROW_Y + BENCH_CONTROL_HEIGHT);
        });
        expect(start.x).toBeLessThan(notebook.x);
        // The bench message grows upward out of the gap above this row, so the row cannot start at the
        // canvas floor and the message cannot be placed against a constant below it.
        expect(BENCH_MESSAGE_BOTTOM_Y).toBeLessThan(BENCH_CONTROL_ROW_Y);
        expect(BENCH_CONTROL_ROW_Y + BENCH_CONTROL_HEIGHT).toBeLessThan(DESIGN.height);
        expect(START_CONTROL_LABEL_WRAP).toBeGreaterThan(0);
    });

    it('reads the canvas size rather than closing over it', () => {
        // The helpers take the surface as arguments (Story 2.8, AC7), so a spec supplies it from
        // `designSurface.ts` and nothing here restates 1024×768. A taller canvas moves the floor-bound
        // bands and leaves the top-bound ones where they are.
        const tall = benchObjectBands(authoredControls(), DESIGN.width, DESIGN.height + 120);
        const standard = benchObjectBands(authoredControls(), DESIGN.width, DESIGN.height);

        expect(tall.map(({ name }) => name)).toEqual(standard.map(({ name }) => name));
        expect(tall.every(({ bottom }) => bottom <= DESIGN.height + 120)).toBe(true);
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
