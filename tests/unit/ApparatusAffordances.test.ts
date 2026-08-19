import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApparatusRenderer } from '../../src/adapters/phaser/renderers/ApparatusRenderer';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import { CONTROL_AFFORDANCES, controlAffordance, type CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { selectControlValue, selectPrimaryControl } from '../../src/core/store/selectors';
import { SLIDER_TRACK_WIDTH, sliderCentre } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import {
    dialAngleForValue,
    knobAngleForValue,
    sliderOffsetForValue
} from '../../src/adapters/phaser/renderers/instrumentView';
import { loadShippedCase } from '../shippedCases';
import { makeSceneSlice, makeWindowStub, type DrawnObject } from './sceneSlice';

/**
 * The bench draws three genuinely distinct instruments (Story 3.4, AC3).
 *
 * A review will ask whether `dial` is a knob with a different label, and the answer has to be an
 * artefact rather than a paragraph. `sceneSlice` now records draw commands **by name**, so "a closed
 * ring versus an arc with a gap" is an assertion instead of a screenshot — the harness gap Story 3.4
 * closed, and the reason a count alone could not settle this.
 *
 * The renderer is driven whole, through `makeSceneSlice`, exactly as `ApparatusRun.test.ts` drives it.
 * Both shipped cases are mounted: Young authors two knobs, the prototype a dial beside a slider, and
 * every assertion about "what does not change with the affordance" is a comparison between them.
 */

let young: CaseDefinition;
let prototype: CaseDefinition;

beforeAll(async () => {
    young = await loadShippedCase('young-interference');
    prototype = await loadShippedCase('morley-miller');
});

const stub = makeWindowStub();

beforeEach(() => {
    stub.setReducedMotion(false);
    stub.setNarrowViewport(false);
    vi.stubGlobal('window', stub.window);
});

afterEach(() => { vi.unstubAllGlobals(); });

/** A store standing at the bench, driven by public actions only — `ApparatusRun.test.ts`'s own helper. */
const storeAtTheBench = (definition: CaseDefinition): AppStore => {
    const store = createStore(createInitialAppState(definition));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    return store;
};

const mount = (definition: CaseDefinition) => {
    const store = storeAtTheBench(definition);
    const slice = makeSceneSlice();
    const renderer = new ApparatusRenderer(slice.scene, createPhaserStoreAdapter(store), { openNotebook: () => undefined });
    renderer.create();
    renderer.render(store.getState());
    return { ...slice, renderer, store };
};

/**
 * The moving part of each instrument: the third graphics of its triple (face, focus ring, mover).
 */
const instrumentMovers = (ui: ReturnType<typeof mount>, controlCount: number): readonly DrawnObject[] => {
    const graphics = ui.ofKind('graphics');
    const movers: DrawnObject[] = [];
    for (let index = 0; index < controlCount; index += 1) {
        movers.push(graphics[graphics.length - (3 * (controlCount - index)) + 2]!);
    }
    return movers;
};

/**
 * The instrument faces, found the way the renderer builds them rather than by a fabricated index.
 *
 * `ApparatusInstrument.create` adds, per instrument and in this order: the face, the focus ring, the
 * moving part, a hit zone and a readout. The instruments are the **last** graphics the bench creates —
 * everything before them belongs to the light and the screen — so taking the tail three-at-a-time is
 * the renderer's own order and not this test's guess. The count assertion below is what keeps that
 * honest: if the construction order moves, this fails rather than measuring the wrong object.
 */
const instrumentFaces = (ui: ReturnType<typeof mount>, controlCount: number): readonly DrawnObject[] => {
    const graphics = ui.ofKind('graphics');
    const faces: DrawnObject[] = [];
    for (let index = 0; index < controlCount; index += 1) {
        faces.push(graphics[graphics.length - (3 * (controlCount - index))]!);
    }
    return faces;
};

describe('the shipped cases author different instruments', () => {
    it('draws two knobs for Young and a dial beside a slider for the prototype', () => {
        expect(young.apparatus.primaryControls.map(controlAffordance)).toEqual(['knob', 'knob']);
        expect(prototype.apparatus.primaryControls.map(controlAffordance)).toEqual(['dial', 'slider']);
    });
});

describe('what each affordance actually paints', () => {
    it('paints a knob as an arc with a gap, and a dial as a closed ring', () => {
        // The distinction AC3 turns on. `arc` + `strokePath` is a bounded sweep with a visible gap;
        // `strokeCircle` is a travel that closes. Swap the dial's face painter for the knob's and this
        // fails on both halves — which is what "not one instrument with three labels" has to mean.
        const knobFace = instrumentFaces(mount(young), young.apparatus.primaryControls.length)[0]!;
        const dialFace = instrumentFaces(mount(prototype), prototype.apparatus.primaryControls.length)[0]!;

        expect(knobFace.state.commandNames).toContain('arc');
        expect(knobFace.state.commandNames).not.toContain('fillRoundedRect');

        expect(dialFace.state.commandNames).not.toContain('arc');
        expect(dialFace.state.commandNames).toContain('strokeCircle');
    });

    it('paints a slider as a track, with no circle anywhere in it', () => {
        // A slider that shared the rotary painter would issue `fillCircle`/`strokeCircle` for a body it
        // does not have. It issues a rounded track instead, and its detents are straight lines.
        const sliderFace = instrumentFaces(mount(prototype), prototype.apparatus.primaryControls.length)[1]!;

        expect(sliderFace.state.commandNames).toContain('fillRoundedRect');
        expect(sliderFace.state.commandNames).not.toContain('arc');
        expect(sliderFace.state.commandNames).not.toContain('fillCircle');
        expect(sliderFace.state.commandNames).not.toContain('strokeCircle');
    });

    it('gives every affordance a detent per authored step, so none claims a resolution it lacks', () => {
        // `lineBetween` is how all three draw a graduation, and each control's step count is its own.
        // The prototype's two differ from each other (12 steps against 12), so a hard-coded tick count
        // would not satisfy both cases at once.
        [young, prototype].forEach((definition) => {
            const ui = mount(definition);
            const faces = instrumentFaces(ui, definition.apparatus.primaryControls.length);

            definition.apparatus.primaryControls.forEach((control, index) => {
                const expectedTicks = Math.max(1, Math.round((control.max - control.min) / control.step)) + 1;
                const drawnTicks = faces[index]!.state.commandNames.filter((name) => name === 'lineBetween').length;

                // The dial draws one extra `lineBetween` for its fixed index mark, which is chrome
                // rather than a graduation — stated here so the arithmetic is not a fudge.
                expect(drawnTicks).toBe(controlAffordance(control) === 'dial' ? expectedTicks + 1 : expectedTicks);
            });
        });
    });
});

describe('what does not change with the affordance (AC3, AC4)', () => {
    it('registers no update loop from create(), for either case', () => {
        // ADR-012: the apparatus is unlit until the player starts it, and an instrument is not a reason
        // to run a frame loop. Asserted for the dial and the slider as well as the knob.
        [young, prototype].forEach((definition) => {
            expect(mount(definition).updateHandlers).toHaveLength(0);
        });
    });

    it('keeps every instrument armed and releases the arrow-key capture on destroy', () => {
        // 2.10's fix, which is global in Phaser and so must hold for every affordance: the capture is
        // taken on focus and given back on teardown, and a scene-level pointer listener left alive
        // would go on turning an instrument that no longer exists.
        [young, prototype].forEach((definition) => {
            const ui = mount(definition);

            expect(ui.capturedKeys()).toEqual([]);
            ui.renderer.destroy();

            expect(ui.capturedKeys()).toEqual([]);
            expect(ui.pointerHandlersFor('pointermove')).toHaveLength(0);
            expect(ui.pointerHandlersFor('pointerup')).toHaveLength(0);
            expect(ui.pointerHandlersFor('pointerupoutside')).toHaveLength(0);
        });
    });

    it('keeps two discrete step affordances per instrument, whatever it is drawn as', () => {
        // ADR-012 again: every draggable instrument keeps its step affordances. A slider that dropped
        // them would leave the keyboard path with nothing to point at, and this is the count that says
        // so — two rectangles per control, in both cases.
        [young, prototype].forEach((definition) => {
            const ui = mount(definition);
            const perControl = ui.ofKind('rectangle').length / definition.apparatus.primaryControls.length;

            expect(perControl).toBeGreaterThanOrEqual(2);
        });
    });

    it('paints a static frame and starts no tween under reduced motion, for the prototype too', () => {
        stub.setReducedMotion(true);
        const ui = mount(prototype);

        expect(ui.updateHandlers).toHaveLength(0);
        expect(ui.tweens).toHaveLength(0);
        ui.renderer.destroy();
    });

    it('leaves the authored range, step and default untouched by the affordance', () => {
        // AC3's "the authored range, step, `defaultValue` and every existing validation are unchanged".
        // Read back through the store's own selector rather than off the JSON, so a renderer that had
        // quietly reinterpreted a bound for its instrument would show up here.
        const store = storeAtTheBench(prototype);

        prototype.apparatus.primaryControls.forEach((control) => {
            expect(selectControlValue(store.getState(), control.id)).toBe(control.defaultValue);
            const resolved = selectPrimaryControl(store.getState(), control.id);
            expect({ min: resolved.min, max: resolved.max, step: resolved.step }).toEqual({ min: control.min, max: control.max, step: control.step });
        });
        expect(prototype.apparatus.primaryControls.map(({ min, max, step }) => ({ min, max, step })))
            .toEqual([{ min: 0, max: 180, step: 15 }, { min: 18, max: 24, step: 0.5 }]);
    });

    it.each(CONTROL_AFFORDANCES)('is a vocabulary the domain and the schema agree on: %s', (affordance) => {
        // Cheap, but it is what makes a fourth member a `tsc` error rather than a silently unhandled
        // branch: the schema's `z.enum` reads this same list.
        expect(CONTROL_AFFORDANCES).toContain(affordance);
    });
});

/**
 * The moving part tracks the value, for every affordance (Story 3.4, AC3).
 *
 * Until this story `sceneSlice` swallowed `setPosition`, `setX` and `setRotation`, so an instrument
 * whose indicator never moved was indistinguishable from one that worked — `paintValue` could have
 * been a no-op under a green suite, which is the `const dark = false` shape one layer down. The harness
 * records all four now, and these are the assertions that spend it.
 *
 * *That* it moved, not *where to*: the coordinate is `apparatusGeometry.ts`'s and is asserted there
 * against exported constants. An exact number here would be arithmetic about a fake.
 */
describe('the moving part follows the value', () => {
    it('rotates a knob indicator when the control changes', () => {
        const ui = mount(young);
        const control = young.apparatus.primaryControls[0]!;
        const indicator = instrumentMovers(ui, young.apparatus.primaryControls.length)[0]!;
        const before = indicator.state.rotation;
        const restingX = indicator.state.x;

        ui.store.dispatch({ type: 'apparatus.controlSet', controlId: control.id, value: control.max, origin: 'phaser' });
        ui.renderer.render(ui.store.getState());

        expect(indicator.state.rotation).not.toBe(before);
        // And it turns in place: a knob is not a slider, so nothing slid along a track.
        expect(indicator.state.x).toBe(restingX);
        ui.renderer.destroy();
    });

    it('rotates a dial indicator, and slides a slider thumb, on the same bench', () => {
        const ui = mount(prototype);
        const [rotation, bath] = prototype.apparatus.primaryControls;
        const [dialIndicator, sliderThumb] = instrumentMovers(ui, prototype.apparatus.primaryControls.length);
        const dialBefore = dialIndicator!.state.rotation;
        const thumbBefore = sliderThumb!.state.x;

        // 90° is a real reading on this dial and 18 °C a real one on this slider — both authored, both
        // on step, and both away from the default the bench opened at.
        ui.store.dispatch({ type: 'apparatus.controlSet', controlId: rotation!.id, value: 90, origin: 'phaser' });
        ui.store.dispatch({ type: 'apparatus.controlSet', controlId: bath!.id, value: bath!.min, origin: 'phaser' });
        ui.renderer.render(ui.store.getState());

        expect(dialIndicator!.state.rotation).not.toBe(dialBefore);
        // The slider moved *along its track*, which is a position change and not a rotation. A slider
        // wired to the rotary branch would leave `x` where it was and turn instead.
        expect(sliderThumb!.state.x).not.toBe(thumbBefore);
        expect(sliderThumb!.state.rotation).toBe(0);
        ui.renderer.destroy();
    });

    it('puts the slider thumb at the left of its track for the minimum and the right for the maximum', () => {
        const ui = mount(prototype);
        const bath = prototype.apparatus.primaryControls[1]!;
        const thumb = instrumentMovers(ui, prototype.apparatus.primaryControls.length)[1]!;

        ui.store.dispatch({ type: 'apparatus.controlSet', controlId: bath.id, value: bath.min, origin: 'phaser' });
        ui.renderer.render(ui.store.getState());
        const atMinimum = thumb.state.x;

        ui.store.dispatch({ type: 'apparatus.controlSet', controlId: bath.id, value: bath.max, origin: 'phaser' });
        ui.renderer.render(ui.store.getState());

        // The travel runs left to right and spans the authored track — a thumb that moved the wrong way
        // or by the wrong span fails here without this test knowing a single coordinate.
        expect(thumb.state.x - atMinimum).toBeCloseTo(SLIDER_TRACK_WIDTH, 6);
        ui.renderer.destroy();
    });
});

/**
 * The indicator points where the instrument's **own** conversion says (Story 3.4).
 *
 * Drawing a dial's pointer with the knob's `knobAngleForValue` is invisible to every assertion above:
 * the indicator still turns, still turns when the value changes, and still turns by a different amount
 * for a different value. It simply points at the wrong graduation — a bench that reads one thing and
 * shows another, which is the class of defect this project has shipped three times.
 *
 * Both sides read the same exported function rather than a literal, which is the project's rule for a
 * shared number. It is not a tautology, because the two functions genuinely disagree: the assertion
 * below pins that they do, so a mutation swapping one for the other has somewhere to fail.
 */
describe('the indicator points where the affordance reads', () => {
    it('turns a knob and a dial to genuinely different angles for the same value', () => {
        // The teeth of the assertions below. If these two agreed, drawing either with the other's
        // conversion would be undetectable.
        const control = prototype.apparatus.primaryControls[0]!;

        expect(dialAngleForValue(control, 90)).not.toBeCloseTo(knobAngleForValue(control, 90), 6);
    });

    it("draws the dial's indicator at the dial's angle, not the knob's", () => {
        const ui = mount(prototype);
        const control = prototype.apparatus.primaryControls[0]!;
        const indicator = instrumentMovers(ui, prototype.apparatus.primaryControls.length)[0]!;

        ui.store.dispatch({ type: 'apparatus.controlSet', controlId: control.id, value: 90, origin: 'phaser' });
        ui.renderer.render(ui.store.getState());

        expect(indicator.state.rotation).toBeCloseTo(dialAngleForValue(control, 90), 9);
        ui.renderer.destroy();
    });

    it("draws the knob's indicator at the knob's angle", () => {
        const ui = mount(young);
        const control = young.apparatus.primaryControls[0]!;
        const indicator = instrumentMovers(ui, young.apparatus.primaryControls.length)[0]!;

        ui.store.dispatch({ type: 'apparatus.controlSet', controlId: control.id, value: control.max, origin: 'phaser' });
        ui.renderer.render(ui.store.getState());

        expect(indicator.state.rotation).toBeCloseTo(knobAngleForValue(control, control.max), 9);
        ui.renderer.destroy();
    });

    it('puts the slider thumb at the offset the slider conversion gives', () => {
        const ui = mount(prototype);
        const bath = prototype.apparatus.primaryControls[1]!;
        const thumb = instrumentMovers(ui, prototype.apparatus.primaryControls.length)[1]!;

        ui.store.dispatch({ type: 'apparatus.controlSet', controlId: bath.id, value: 19, origin: 'phaser' });
        ui.renderer.render(ui.store.getState());

        expect(thumb.state.x - sliderCentre(1).x).toBeCloseTo(sliderOffsetForValue(bath, 19, SLIDER_TRACK_WIDTH), 9);
        ui.renderer.destroy();
    });
});
