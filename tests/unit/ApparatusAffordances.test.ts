import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApparatusRenderer } from '../../src/adapters/phaser/renderers/ApparatusRenderer';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import { CONTROL_AFFORDANCES, controlAffordance, type CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { selectControlValue, selectPrimaryControl } from '../../src/core/store/selectors';
import { SLIDER_TRACK_WIDTH, instrumentCentre } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';
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
    // Carried on the harness rather than looked up at each assertion, because it is a fact about *which
    // case was mounted* — see {@link TABLEAU_GRAPHICS}.
    return { ...slice, renderer, store, tableauGraphics: TABLEAU_GRAPHICS[definition.experiment.modelId]! };
};

/**
 * The graphics list, having first checked the tail really is the instruments' three-per-control.
 *
 * The net the two helpers below used to claim they had. A fourth graphics inside
 * `ApparatusInstrument.create`, or any graphics added after the instrument loop, slides every index —
 * so a test would go on passing while measuring the previous instrument's focus ring. This fails
 * instead, and says which number moved.
 */
const expectInstrumentTail = (ui: ReturnType<typeof mount>, controlCount: number): readonly DrawnObject[] => {
    const graphics = ui.ofKind('graphics');
    // Every instrument contributes exactly three, and the tableau's own graphics all precede them.
    expect(graphics.length).toBe(ui.tableauGraphics + (3 * controlCount));
    return graphics;
};

/**
 * How many graphics each **tableau** draws before the first instrument, by the model id that selects it.
 *
 * A magic number in a test is normally the thing this project forbids; these are here deliberately, as
 * the *fixture's* shape rather than the source's, and their only job is to go red when construction
 * order moves. That is exactly what they did when Story 4.2 split the apparatus out of the renderer.
 *
 * **It used to be one number for both cases** (`BENCH_GRAPHICS_BEFORE_INSTRUMENTS = 3`, described as
 * "the light, the screen and the frame"), which was true of Young's three additive layers and was
 * applied to the prototype as well — so the prototype's tail arithmetic was riding on its apparatus
 * having the same layer count as Young's. That is the same Young-for-both shape AC9 makes the geometry
 * sweep stop doing, one layer down, and it is why this is now keyed on `experiment.modelId`: the number
 * is a property of the artwork, so it belongs beside the thing that selects the artwork.
 *
 * Young: the fringe field, the beam and the wavefronts. The interferometer: the bath, the stone, the
 * apparatus, the fringe field and the beams.
 */
const TABLEAU_GRAPHICS: Readonly<Record<string, number>> = {
    'young-double-slit': 3,
    'morley-miller-interferometer': 5
};

/**
 * The moving part of each instrument: the third graphics of its triple (face, focus ring, mover).
 */
const instrumentMovers = (ui: ReturnType<typeof mount>, controlCount: number): readonly DrawnObject[] => {
    const graphics = expectInstrumentTail(ui, controlCount);
    const movers: DrawnObject[] = [];
    for (let index = 0; index < controlCount; index += 1) {
        movers.push(graphics[graphics.length - (3 * (controlCount - index)) + 2]!);
    }
    return movers;
};

/**
 * The instrument faces, found the way the renderer builds them rather than by a fabricated index.
 *
 * `ApparatusInstrument.create` adds, per instrument and in this order: the face, the focus ring and the
 * moving part. Taking the tail three-at-a-time therefore reads the instruments — **but only for a bench
 * mounted the way `mount` mounts one.**
 *
 * Story 3.4's code review corrected the claim that used to stand here. It said the tail was "the
 * renderer's own order and not this test's guess", kept honest by "the count assertion below" — and no
 * assertion on `ofKind('graphics').length` existed anywhere in this file. Worse, the tail only holds
 * because `mount` omits `openReference`: `ApparatusRenderer.create()` calls `createReferenceShelf()`
 * *after* the instrument loop, and on the bench players actually use it adds another graphics behind
 * them. So the arithmetic is a property of this file's fixture, which is now asserted rather than
 * assumed — {@link expectInstrumentTail} runs before every index is taken.
 */
const instrumentFaces = (ui: ReturnType<typeof mount>, controlCount: number): readonly DrawnObject[] => {
    const graphics = expectInstrumentTail(ui, controlCount);
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
        //
        // The comment here used to justify deriving the count by saying the prototype's two controls
        // "differ from each other (12 steps against 12)" — which names the same number twice. They do
        // not differ: `rotationDeg` is (180−0)/15 and `bathTempC` is (24−18)/0.5, both 12, so the
        // literal 13 would satisfy every shipped control and this sweep would prove nothing about the
        // derivation. It is derived because a *future* control will differ, and that is the honest
        // reason; the fixture below is what makes the derivation load-bearing today.
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

            // Focus an instrument first. Without this the capture is never taken and both assertions
            // compare `[]` to `[]` — which is how this test passed with `removeCapture` deleted
            // outright, the 2.10 fix it is named for left completely unguarded.
            const zone = ui.ofKind('zone')[0]!;
            zone.handlers.get('pointerdown')!({ x: 0, y: 0 });
            expect(ui.capturedKeys().length).toBeGreaterThan(0);

            ui.renderer.destroy();

            expect(ui.capturedKeys()).toEqual([]);
            expect(ui.pointerHandlersFor('pointermove')).toHaveLength(0);
            expect(ui.pointerHandlersFor('pointerup')).toHaveLength(0);
            expect(ui.pointerHandlersFor('pointerupoutside')).toHaveLength(0);
        });
    });

    it('keeps two discrete step affordances per instrument, whatever it is drawn as', () => {
        // ADR-012 again: every draggable instrument keeps its step affordances. A slider that dropped
        // them would leave the keyboard path with nothing to point at.
        //
        // Counted **per instrument, at its own slot**, not averaged over the bench. The average was the
        // defect: `rectangles / controls >= 2` ran at 8.5 against a floor of 2 for the prototype, so a
        // slider drawing none and a dial drawing four passed — and deleting the slider's step
        // affordances outright left the whole suite green.
        // Measured **differentially**, one affordance against another, because neither an absolute
        // count nor a position filter can be trusted here: the bench draws pressable rectangles that
        // are not step affordances, and the harness discards a rectangle's constructor coordinates
        // (see `deferred-work.md`). What no affordance may do is draw *fewer* than another, and that is
        // exactly the regression — a slider that dropped its pair leaves the keyboard path with nothing
        // to point at, while `knob` goes on passing and names the culprit.
        const pressableRectangles = (affordance: string): number => {
            const definition = structuredClone(prototype) as unknown as Record<string, unknown>;
            const controls = (definition.apparatus as { primaryControls: Array<Record<string, unknown>> }).primaryControls;
            controls.forEach((control) => { control.affordance = affordance; });
            return mount(definition as unknown as CaseDefinition)
                .ofKind('rectangle').filter(({ handlers }) => handlers.has('pointerup')).length;
        };

        const baseline = pressableRectangles('knob');
        // Two per control, plus whatever the bench itself contributes — the +4 is what must not move.
        expect(baseline).toBeGreaterThanOrEqual(2 * prototype.apparatus.primaryControls.length);
        CONTROL_AFFORDANCES.forEach((affordance) => {
            expect({ affordance, count: pressableRectangles(affordance) }).toEqual({ affordance, count: baseline });
        });
    });

    it('paints a static frame and starts no tween under reduced motion, for the prototype too', () => {
        // Both halves asserted, because the reduced-motion half alone is insensitive to the flag: an
        // idle bench registers no update handler and starts no tween in *either* mode, so flipping
        // `setReducedMotion(true)` to `false` used to leave this green. What the flag must actually
        // change is the painted frame, and what it must not change is the tween count.
        stub.setReducedMotion(true);
        const reduced = mount(prototype);
        expect(reduced.updateHandlers).toHaveLength(0);
        expect(reduced.tweens).toHaveLength(0);
        const reducedFrame = instrumentFaces(reduced, prototype.apparatus.primaryControls.length)
            .map(({ state }) => state.commandNames.join(','));
        reduced.renderer.destroy();

        stub.setReducedMotion(false);
        const full = mount(prototype);
        expect(full.tweens).toHaveLength(0);
        const fullFrame = instrumentFaces(full, prototype.apparatus.primaryControls.length)
            .map(({ state }) => state.commandNames.join(','));
        full.renderer.destroy();

        // The instrument faces are drawn once and never animated, so they must be identical — that is
        // what "a static frame" means here, and it is now a comparison rather than an assumption.
        expect(reducedFrame).toEqual(fullFrame);
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
        // This used to assert `expect(CONTROL_AFFORDANCES).toContain(affordance)` while iterating
        // `CONTROL_AFFORDANCES` — true for any array whatsoever, and it never imported the schema whose
        // agreement it is named for. Narrowing `PrimaryControlSchema` to `z.enum(['knob','dial'])`
        // passed it. Parse a real control through the production schema instead.
        const definition = structuredClone(prototype) as unknown as Record<string, unknown>;
        const controls = (definition.apparatus as { primaryControls: Array<Record<string, unknown>> }).primaryControls;
        controls[0]!.affordance = affordance;

        expect(CaseDefinitionSchema.safeParse(definition).success).toBe(true);
    });

    it('refuses an affordance the vocabulary does not carry', () => {
        // The other half: an enum that accepted anything would pass every row above.
        const definition = structuredClone(prototype) as unknown as Record<string, unknown>;
        const controls = (definition.apparatus as { primaryControls: Array<Record<string, unknown>> }).primaryControls;
        controls[0]!.affordance = 'lever';

        expect(CaseDefinitionSchema.safeParse(definition).success).toBe(false);
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

        expect(thumb.state.x - instrumentCentre('slider', 1).x).toBeCloseTo(sliderOffsetForValue(bath, 19, SLIDER_TRACK_WIDTH), 9);
        ui.renderer.destroy();
    });
});
