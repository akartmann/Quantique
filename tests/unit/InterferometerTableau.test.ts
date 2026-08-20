import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApparatusRenderer } from '../../src/adapters/phaser/renderers/ApparatusRenderer';
import { BATH_LAYER_NAME, createBenchTableau, EXPERIMENT_MODEL_IDS, FRINGE_LAYER_NAME, LAMP_LAYER_NAME, TABLEAU_MODEL_IDS } from '../../src/adapters/phaser/renderers/benchTableau';
import { BENCH_LABEL_NAME, InterferometerTableau, SCREEN_LABEL_NAME } from '../../src/adapters/phaser/renderers/InterferometerTableau';
import { YoungOpticalTableau } from '../../src/adapters/phaser/renderers/YoungOpticalTableau';
import {
    ARM_LENGTH,
    BATH_OUTER_RADIUS,
    MIRROR_HALF_WIDTH,
    SCREEN_X,
    MIRROR_THICKNESS,
    SOURCE_GLOW_RADIUS,
    SOURCE_GLOW_SCALE_AT_FULL,
    STONE_CENTRE_X,
    STONE_CENTRE_Y,
    STONE_RADIUS,
    TABLEAU_FLOOR_Y,
    armEndPoint,
    bathFillColor,
    bathWarmth01,
    interferometerObjectBands,
    mirrorReachFromCentre,
    sourcePoint,
    sourceReachFromCentre
} from '../../src/adapters/phaser/renderers/interferometerGeometry';
import { ADVANCE_CONTROL_Y, BENCH_TOP, SIDE_COLUMN_LEFT } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';
import { STABLE_WINDOW_C } from '../../src/domain/apparatus/calculateInterferometerDrift';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { loadMorleyMillerCase, loadYoungCase } from './shippedCases';
import { makeSceneSlice, makeWindowStub } from './sceneSlice';

/**
 * The rotating interferometer's tableau and the seam that selects it (Story 4.2, AC1 / AC8 / AC9).
 *
 * Against the **shipped** cases rather than fixtures, for the reason `ApparatusCaseVoice.test.ts` gives:
 * the whole subject here is that a renderer stops assuming one case's shape, and a fixture would let the
 * artwork agree with a case nobody plays.
 *
 * What this file can and cannot see is stated once, because it decides every assertion below.
 * `sceneSlice` records Graphics draw commands since the last `clear()` **by name**, every tween config,
 * every `killTweensOf` target, and each object's position and rotation — so "paints nothing", "starts no
 * tween", "releases its tweens" and "the bath was repainted" can genuinely fail. It **cannot** see text
 * height, and `measureText` approximates width as `length × 7`. So every *coordinate* claim below is made
 * against an exported geometry constant and never against a recorded draw argument, which the harness
 * does not keep anyway — and AC9's by-eye confirmation at 1280×720 in both locales is what covers the
 * rest. That division is deliberate: a "the layout holds" claim proved only here is arithmetic.
 */

let young: CaseDefinition;
let prototype: CaseDefinition;

beforeAll(async () => {
    young = await loadYoungCase();
    prototype = await loadMorleyMillerCase();
});

const stub = makeWindowStub();

const storeAtTheBench = (definition: CaseDefinition, locale: 'en' | 'fr' = 'en'): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    return store;
};

const mount = (store: AppStore) => {
    const slice = makeSceneSlice();
    const renderer = new ApparatusRenderer(slice.scene, createPhaserStoreAdapter(store), { openNotebook: () => undefined });
    renderer.create();
    renderer.render(store.getState());
    return { ...slice, renderer, store };
};

describe('the artwork is selected from the case\'s own experiment model', () => {
    beforeEach(() => { vi.stubGlobal('window', stub.window); });
    afterEach(() => { vi.unstubAllGlobals(); });

    /**
     * The exhaustiveness clause of AC1, asserted rather than left to the type.
     *
     * `BENCH_TABLEAU` is a `Record<ExperimentModelId, …>`, so a third model without artwork is a `tsc`
     * error — but `tsc` runs in a different program from this one and a `Record` can also be satisfied by
     * an entry that is present and wrong. This says every model the **domain** publishes has artwork, and
     * that the artwork record has invented no id of its own.
     */
    it('covers every experiment model the domain publishes, and no more', () => {
        expect([...TABLEAU_MODEL_IDS].sort()).toEqual([...EXPERIMENT_MODEL_IDS].sort());
    });

    it('draws Young\'s optical bench for Young and the interferometer for the prototype', () => {
        const slice = makeSceneSlice();

        // Mutation target: point either entry of `BENCH_TABLEAU` at the other tableau and this fails.
        // That is the whole of AC1's "never falls back to Young" — and it is the mutation §SS10 names
        // first, because the failure it guards against is a *silent* one: the wrong apparatus renders
        // perfectly, and every text assertion on the bench stays green.
        expect(createBenchTableau(young.experiment.modelId, slice.scene)).toBeInstanceOf(YoungOpticalTableau);
        expect(createBenchTableau(prototype.experiment.modelId, slice.scene)).toBeInstanceOf(InterferometerTableau);
    });

    /**
     * The `undefined` branch, which exists so the fact is stated rather than assumed.
     *
     * Unreachable from validated content — `CaseDefinitionSchema` refuses an unknown `experiment.modelId`
     * at load with the path named — and asserted anyway, because the thing that must **not** happen is a
     * fallback. An unimplemented model drawing Young's bench is the defect AC1's last clause forbids, and
     * it would be invisible: the apparatus would render, and only a reader would know it was the wrong one.
     */
    it('draws nothing at all for a model id this build does not implement, rather than falling back', () => {
        expect(createBenchTableau('not-a-model', makeSceneSlice().scene)).toBeUndefined();
    });

    it('resolves the artwork from the model id and not from the case id', () => {
        // A case id is a string this lookup must have no opinion about. Passing one proves the key space
        // is the model's — the distinction `project-context.md` calls "the trap" when the two are mixed.
        expect(createBenchTableau(prototype.id, makeSceneSlice().scene)).toBeUndefined();
        expect(createBenchTableau(young.id, makeSceneSlice().scene)).toBeUndefined();
    });

    it('resolves the artwork from the model id and not from the model version', () => {
        // `modelVersion` is the per-run provenance stamp; bumping it must not change what is drawn any
        // more than it changes which physics runs.
        expect(createBenchTableau(prototype.experiment.modelVersion, makeSceneSlice().scene)).toBeUndefined();
    });
});

describe('the interferometer tableau paints its own apparatus', () => {
    beforeEach(() => { vi.stubGlobal('window', stub.window); });

    /**
     * The centring `interferometerObjectBands()` assumes, asserted on the objects that have to have it.
     *
     * The bench and screen labels are measured as `centre ± wrap / 2`, which is only their extent if they
     * are drawn with `setOrigin(0.5, …)`. `setOrigin` was unrecorded by the harness until the 4.2 code
     * review, so deleting either call left the two labels overlapping on the shared label row — the exact
     * thing the non-overlap row below exists to catch — with the whole suite green.
     *
     * Mutation: drop `.setOrigin(0.5, 0)` from either label in `InterferometerTableau.create()` and this
     * fails by name.
     */
    it('centres the labels its bands are measured from', () => {
        const ui = mount(storeAtTheBench(prototype));

        // The bath label is left-anchored by design (its band starts at `BATH_LABEL_X`); these two are
        // measured as `centre ± wrap / 2`, which is their extent only if they are centred. Found by name
        // because the harness still discards the constructor coordinates they are positioned by.
        ([BENCH_LABEL_NAME, SCREEN_LABEL_NAME]).forEach((name) => {
            const label = ui.named(name);
            expect(label).toBeDefined();
            expect(label!.state.originX).toBe(0.5);
            expect(label!.state.originY).toBe(0);
        });
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('paints the bath, the stone and the apparatus without any run at all', () => {
        const ui = mount(storeAtTheBench(prototype));

        // The apparatus is scenery: it stands there whether or not the player has started anything. What
        // must be dark with no run is the *light*, which the next rows assert.
        //
        // Asked of the three objects by name, not of the bench in aggregate: `ofKind('graphics')` returns
        // every instrument's graphics too, so `painted.length > 0` was true with `paintFixedScenery`,
        // `paintBath` and `paintApparatus` all deleted (4.2 code review).
        const bath = ui.named(BATH_LAYER_NAME);
        expect(bath?.state.commands ?? 0).toBeGreaterThan(0);
        // The stone and the arms are not separately named — they are one layer drawn in one pass — so they
        // are asked for through the shapes they issue: a face, and two arms crossed by a splitter.
        const apparatusCommands = ui.ofKind('graphics')
            .flatMap(({ state }) => state.commandNames)
            .filter((name) => name === 'fillCircle' || name === 'fillRect' || name === 'fillTriangle');
        expect(apparatusCommands).toContain('fillCircle');
        expect(apparatusCommands).toContain('fillTriangle');
    });

    it('leaves the light dark and the fringe field blank until the player starts it (ADR-012)', () => {
        const ui = mount(storeAtTheBench(prototype));

        expect(ui.named(FRINGE_LAYER_NAME)!.state.commands).toBe(0);
        // No loop, and no tween, from `create()`. This is the clause whose failure is silent: an idle
        // animation looks like a nicer bench and costs NFR1 budget for nobody.
        expect(ui.updateHandlers).toHaveLength(0);
        expect(ui.tweens).toHaveLength(0);
    });

    it('paints the fringe field once a run is recorded', () => {
        const store = storeAtTheBench(prototype);
        const run = store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-20T10:00:00.000Z' });
        if (!run.ok) throw new Error(`The bench refused the run: ${run.error.code}`);

        expect(mount(store).named(FRINGE_LAYER_NAME)!.state.commands).toBeGreaterThan(0);
    });

    /**
     * AC1's second clause: the bench's rotation is visibly at the authored `rotationDeg` and **turns**.
     *
     * Asserted through the lamp, which rides the stone: the harness records `setPosition`, so a lamp that
     * moved is a fact rather than an inference. Mutation target: drop the `sourcePoint` call at the end of
     * `paintApparatus`, or make `armEndPoint` ignore its rotation, and this fails.
     *
     * The arms and the mirrors are `Graphics` fills, whose *coordinates* the harness deliberately does not
     * keep — so their rotation is asserted below against `armEndPoint` directly, which is the pure
     * function the painter calls.
     */
    it('moves the apparatus when the bench is turned', () => {
        const store = storeAtTheBench(prototype);
        const ui = mount(store);
        const lamp = ui.named(LAMP_LAYER_NAME)!;
        const lampBefore = { x: lamp.state.x, y: lamp.state.y };

        const turned = store.dispatch({ type: 'apparatus.controlSet', controlId: 'rotationDeg', value: 90, origin: 'phaser' });
        if (!turned.ok) throw new Error(`The bench refused the turn: ${turned.error.code}`);
        ui.renderer.render(store.getState());
        const lampAfter = { x: lamp.state.x, y: lamp.state.y };

        expect(lampAfter).not.toEqual(lampBefore);
        // And it is the *authored* angle, not an arbitrary move: 90° puts the lamp where `sourcePoint`
        // says, which is the one function the painter and this assertion share.
        expect(lampAfter.x).toBeCloseTo(sourcePoint(90).x, 6);
        expect(lampAfter.y).toBeCloseTo(sourcePoint(90).y, 6);
    });

    it('repaints the bath when the bath temperature changes, and only then', () => {
        const store = storeAtTheBench(prototype);
        const ui = mount(store);
        // By name. This read `ofKind('graphics')[0]` until the 4.2 code review — the exact index habit this
        // file's own `FRINGE_LAYER_NAME` docstring exists to end, and reordering the two `add.graphics()`
        // calls in `create()` would have retargeted it onto the stone, which is never cleared, so the row
        // would then have passed forever.
        const bath = ui.named(BATH_LAYER_NAME)!;
        const clearsAfterFirstPaint = bath.state.clears;

        // A repaint with nothing changed must not re-issue the fills: the signature guard is what keeps a
        // store change that moved the rotation from redrawing the trough (§Performance).
        ui.renderer.render(store.getState());
        expect(bath.state.clears).toBe(clearsAfterFirstPaint);

        const warmed = store.dispatch({ type: 'apparatus.controlSet', controlId: 'bathTempC', value: 24, origin: 'phaser' });
        if (!warmed.ok) throw new Error(`The bench refused the bath change: ${warmed.error.code}`);
        ui.renderer.render(store.getState());
        expect(bath.state.clears).toBeGreaterThan(clearsAfterFirstPaint);
    });

    /**
     * AC2's in-fiction statement of the stable window, on the picture rather than in prose.
     *
     * The ring is drawn only while the bath is **at** {@link STABLE_WINDOW_C} — no tolerance, because the
     * thermal term vanishes at one temperature and not in a neighbourhood of it, and a softer definition
     * here would show the player a steady bath while they still read a thermal contribution.
     *
     * Mutation target: draw the ring unconditionally, or widen it to a tolerance, and this fails.
     *
     * **The tolerance half needed the walk back out.** Until the 4.2 code review the row only moved *to*
     * the window and asserted the strokes rose, which a tolerance of `|bath − 20| < 2` passes: the default
     * is 22, `|22 − 20|` is not `< 2`, so the baseline was unchanged and the count still rose. Leaving the
     * window again and asserting the ring is gone is the assertion that catches it. The command *names*
     * are what the harness keeps, and `strokeCircle` is what the ring issues.
     */
    it('rings the bath only when it is actually at the model\'s stable window', () => {
        const store = storeAtTheBench(prototype);
        const ui = mount(store);
        const bath = ui.named(BATH_LAYER_NAME)!;
        const ringStrokes = (): number => bath.state.commandNames.filter((name) => name === 'strokeCircle').length;

        const setBath = (value: number): void => {
            const moved = store.dispatch({ type: 'apparatus.controlSet', controlId: 'bathTempC', value, origin: 'phaser' });
            if (!moved.ok) throw new Error(`The bench refused a bath of ${value}: ${moved.error.code}`);
            ui.renderer.render(store.getState());
        };

        // The authored default is 22, which is not the window — so the ring appears where it did not.
        expect(prototype.apparatus.primaryControls.find(({ id }) => id === 'bathTempC')!.defaultValue).not.toBe(STABLE_WINDOW_C);
        const strokesAtDefault = ringStrokes();

        setBath(STABLE_WINDOW_C);
        const strokesAtWindow = ringStrokes();
        expect(strokesAtWindow).toBeGreaterThan(strokesAtDefault);

        // One step off the window in each direction, which is where a tolerance would keep the ring lit.
        const bathControl = prototype.apparatus.primaryControls.find(({ id }) => id === 'bathTempC')!;
        ([STABLE_WINDOW_C + bathControl.step, STABLE_WINDOW_C - bathControl.step]).forEach((offWindow) => {
            setBath(offWindow);
            expect(ringStrokes()).toBe(strokesAtDefault);
        });
    });

    it('releases every display object and tween it made', () => {
        const ui = mount(storeAtTheBench(prototype));
        const mine = ui.drawn.length;

        ui.renderer.destroy();

        expect(ui.drawn.filter(({ state }) => !state.destroyed)).toEqual([]);
        expect(mine).toBeGreaterThan(0);
        expect(ui.killedTweenTargets.length).toBeGreaterThan(0);
    });

    /**
     * The reduced-motion contract, on the tableau this story adds (AC8's last clause, ADR-012).
     *
     * `ApparatusRun.test.ts` is the pattern and it drives Young. This drives the interferometer, because
     * "the framework is shared so it must work" is precisely the assumption Story 3.2's three walls each
     * falsified.
     */
    it('registers no loop and starts no tween under reduced motion, and paints the resolved frame', () => {
        const reduced = makeWindowStub();
        reduced.setReducedMotion(true);
        vi.stubGlobal('window', reduced.window);
        const store = storeAtTheBench(prototype);
        const ui = mount(store);
        const run = store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-20T10:00:00.000Z' });
        if (!run.ok) throw new Error(`The bench refused the run: ${run.error.code}`);
        ui.renderer.render(store.getState());

        expect(ui.updateHandlers).toHaveLength(0);
        expect(ui.tweens).toHaveLength(0);
        // The resolved frame, painted directly: the pattern is there and fully opaque, with nothing moving.
        const fringes = ui.named(FRINGE_LAYER_NAME)!;
        expect(fringes.state.commands).toBeGreaterThan(0);
        expect(fringes.state.visible).toBe(true);
        expect(fringes.state.alpha).toBe(1);
    });
});

describe('the interferometer\'s geometry fits the surface it is laid out on', () => {

    it('keeps the whole apparatus inside the canvas and clear of the side column above it', () => {
        const outside = interferometerObjectBands()
            .filter(({ left, right, top, bottom }) => left < 0 || right > DESIGN_WIDTH || top < 0 || bottom > DESIGN_HEIGHT)
            .map(({ name }) => name);

        expect(outside).toEqual([]);
        // The side column's own objects start at `ADVANCE_CONTROL_Y`, so the tableau may reach past
        // `SIDE_COLUMN_LEFT` in x — Young's screen does, at its longest throw, and that is the documented
        // reason `ADVANCE_CONTROL_Y` is 360 rather than 130. What must hold is that nothing in the tableau
        // reaches *down* into the column.
        expect(TABLEAU_FLOOR_Y).toBeLessThan(ADVANCE_CONTROL_Y);
        expect(BENCH_TOP).toBeGreaterThan(TABLEAU_FLOOR_Y);
    });

    it('stacks the apparatus, the screen and the three labels without any two overlapping', () => {
        const bands = interferometerObjectBands();
        const overlaps: string[] = [];
        bands.forEach((a, index) => bands.slice(index + 1).forEach((b) => {
            const horizontal = a.left < b.right && b.left < a.right;
            const vertical = a.top < b.bottom && b.top < a.bottom;
            if (horizontal && vertical) overlaps.push(`${a.name} overlaps ${b.name}`);
        }));

        expect(overlaps).toEqual([]);
        // A guard on the sweep: an empty band list makes the assertion vacuous, which is how a geometry
        // test starts passing because the thing it protects moved out of it.
        expect(bands.length).toBeGreaterThan(4);
    });

    /**
     * Both bounds, measured at the corner and the scale the painter actually draws (4.2 code review).
     *
     * Two numbers were wrong here and both were wrong in the loose direction:
     *
     * - The mirror bound read `hypot(ARM_LENGTH, MIRROR_HALF_WIDTH)` ≈ 69.6, and `paintApparatus` gives
     *   each mirror `MIRROR_THICKNESS` of depth *along* the arm, so the drawn corner is at ≈ 74.5.
     *   `MIRROR_THICKNESS: 5 → 20` put a bar off the stone at every angle with the old row green.
     * - The lamp bound read `SOURCE_DISTANCE + SOURCE_GLOW_RADIUS` = 79, and `paintLight` scales the glow
     *   to `1.9×` for every lit frame, so it reaches 94.3 — *past* `STONE_RADIUS`, which is why the bound
     *   asserted here is the bath's outer edge and the docstring now says so.
     *
     * The per-angle loop below asserted `hypot(armEndPoint(deg, i) − centre) === ARM_LENGTH`, which is
     * `armEndPoint`'s own body restated, and likewise for the lamp — true for every input, so it could not
     * observe the property its name claims. It asks the reach question instead, at each authored angle.
     */
    it('keeps both end mirrors and the lamp wholly on the apparatus at every authored angle', () => {
        // Mutation: raise `MIRROR_THICKNESS`, `ARM_LENGTH`, `SOURCE_DISTANCE` or `SOURCE_GLOW_RADIUS` and
        // the matching row fails by name. Both read exported helpers, so the number and the drawing move
        // together rather than the test carrying its own copy of the arithmetic.
        expect(mirrorReachFromCentre()).toBeLessThanOrEqual(STONE_RADIUS);
        expect(mirrorReachFromCentre()).toBeGreaterThan(Math.hypot(ARM_LENGTH, MIRROR_HALF_WIDTH));

        // Dark, the lamp is unscaled and sits on the stone; lit, its glow spills over the trough and must
        // still stay inside the apparatus's own outer edge.
        expect(sourceReachFromCentre(0)).toBeLessThanOrEqual(STONE_RADIUS);
        expect(sourceReachFromCentre(1)).toBeGreaterThan(STONE_RADIUS);
        expect(sourceReachFromCentre(1)).toBeLessThanOrEqual(BATH_OUTER_RADIUS);

        // And every authored angle really does keep them there, rather than the bounds above holding only
        // for the two axes the arms happen to start on. The mirror's far corner is the arm's end pushed
        // `MIRROR_THICKNESS` further out along its own axis and `MIRROR_HALF_WIDTH` across it.
        const rotation = prototype.apparatus.primaryControls.find(({ id }) => id === 'rotationDeg')!;
        let anglesChecked = 0;
        for (let deg = rotation.min; deg <= rotation.max + 1e-9; deg += rotation.step) {
            ([0, 1] as const).forEach((armIndex) => {
                const end = armEndPoint(deg, armIndex);
                const fromCentre = Math.hypot(end.x - STONE_CENTRE_X, end.y - STONE_CENTRE_Y);
                expect(fromCentre + MIRROR_THICKNESS).toBeLessThanOrEqual(STONE_RADIUS);
                expect(Math.hypot(fromCentre + MIRROR_THICKNESS, MIRROR_HALF_WIDTH)).toBeLessThanOrEqual(STONE_RADIUS);
            });
            const lamp = sourcePoint(deg);
            const lampFromCentre = Math.hypot(lamp.x - STONE_CENTRE_X, lamp.y - STONE_CENTRE_Y);
            expect(lampFromCentre + (SOURCE_GLOW_RADIUS * (1 + SOURCE_GLOW_SCALE_AT_FULL))).toBeLessThanOrEqual(BATH_OUTER_RADIUS);
            anglesChecked += 1;
        }
        // The loop must have run: a step the authored range cannot reach would make every row above vacuous.
        expect(anglesChecked).toBe(1 + ((rotation.max - rotation.min) / rotation.step));
    });

    it('keeps the two arms at right angles to each other, which is what the model\'s period is about', () => {
        // `cos(2θ)` is the orientation term's period *because* the arms are perpendicular. If the drawing
        // put them at any other angle the picture would contradict the physics it illustrates.
        [0, 15, 90, 135, 180].forEach((deg) => {
            const first = armEndPoint(deg, 0);
            const second = armEndPoint(deg, 1);
            const dot = ((first.x - STONE_CENTRE_X) * (second.x - STONE_CENTRE_X))
                + ((first.y - STONE_CENTRE_Y) * (second.y - STONE_CENTRE_Y));
            expect(dot).toBeCloseTo(0, 6);
        });
    });

    /**
     * Why 0° and 180° read the same, stated about the drawing as well as the model.
     *
     * The first draft of this row asserted the arms *return to where they started* at 180°. They do not,
     * and it is worth recording why the wrong version was tempting: the authored travel is 0–180 against
     * `cos(2θ)`, so the two travel ends are one reading — the correction the e2e walk carries — and it is
     * easy to slide from "the reading repeats" to "the picture repeats". A real interferometer turned half
     * a revolution genuinely looks different: each arm's mirror is on the opposite side of the stone.
     *
     * What *is* invariant, and what the `cos(2θ)` period is actually about, is the pair of arm **axes**
     * taken as unoriented directions. `{θ, θ+90}` and `{θ+180, θ+270}` are the same two axes mod 180°, so
     * the apparatus presents the same geometry to a direction in space while sitting visibly turned round.
     */
    it('presents the same pair of arm axes at 0° and 180°, which is what makes the reading repeat', () => {
        const axisDeg = (deg: number, armIndex: 0 | 1): number => {
            const end = armEndPoint(deg, armIndex);
            const raw = (Math.atan2(end.y - STONE_CENTRE_Y, end.x - STONE_CENTRE_X) * 180) / Math.PI;
            // Unoriented: an axis and its reverse are one axis, so fold onto [0, 180).
            return ((raw % 180) + 180) % 180;
        };
        const axesAt = (deg: number): number[] => [axisDeg(deg, 0), axisDeg(deg, 1)].map((a) => Number(a.toFixed(6))).sort((a, b) => a - b);

        expect(axesAt(180)).toEqual(axesAt(0));
        expect(axesAt(105)).toEqual(axesAt(15));
        // And the drawing really has turned: the arms are not where they were, which is the half of this
        // the first draft got backwards.
        expect(armEndPoint(180, 0)).not.toEqual(armEndPoint(0, 0));
    });

    it('reads the bath\'s warmth from the authored bounds rather than from written-down ones', () => {
        const bath = prototype.apparatus.primaryControls.find(({ id }) => id === 'bathTempC')!;

        expect(bathWarmth01(bath.min, bath.min, bath.max)).toBe(0);
        expect(bathWarmth01(bath.max, bath.min, bath.max)).toBe(1);
        expect(bathWarmth01(bath.defaultValue, bath.min, bath.max)).toBeGreaterThan(0);
        // Clamped and total, because a restored record against a changed `case.json` can hold a value
        // outside today's bounds — and a colour component outside 0–255 is a silently wrong fill.
        expect(bathWarmth01(bath.max + 100, bath.min, bath.max)).toBe(1);
        expect(bathWarmth01(bath.min - 100, bath.min, bath.max)).toBe(0);
        expect(bathWarmth01(Number.NaN, bath.min, bath.max)).toBe(0);
        expect(bathWarmth01(21, 20, 20)).toBe(0);
    });

    it('produces a colour inside the ramp for every warmth, and a different one at each end', () => {
        expect(bathFillColor(0)).not.toBe(bathFillColor(1));
        [0, 0.25, 0.5, 0.75, 1].forEach((warmth) => {
            const colour = bathFillColor(warmth);
            expect(colour).toBeGreaterThanOrEqual(0);
            expect(colour).toBeLessThanOrEqual(0xffffff);
        });
    });

    it('stands its screen clear of the stone it reads, and inside the surface', () => {
        expect(SCREEN_X).toBeGreaterThan(STONE_CENTRE_X + BATH_OUTER_RADIUS);
        expect(SCREEN_X).toBeLessThan(DESIGN_WIDTH);
        // Above the side column's first object, so a label beside the screen cannot reach a control.
        expect(TABLEAU_FLOOR_Y).toBeLessThan(ADVANCE_CONTROL_Y);
        expect(SIDE_COLUMN_LEFT).toBeGreaterThan(0);
    });
});
