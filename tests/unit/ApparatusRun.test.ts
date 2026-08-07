import { readFile } from 'node:fs/promises';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApparatusRenderer, RUN_ANIMATION_MS } from '../../src/adapters/phaser/renderers/ApparatusRenderer';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';
import { makeSceneSlice, makeWindowStub } from './sceneSlice';

/**
 * The player-started light, asserted without a browser (Story 2.10, AC4, AC5, AC9, AC10).
 *
 * The scene is the **structural slice the renderer actually uses** — `add.{text,graphics,circle,
 * rectangle,zone}`, `events`, `input`, `tweens`, `scale` — which is the pattern `SceneRouterTarget`
 * established and `CharacterStage.test.ts` follows. A real `Phaser.Game` cannot be constructed here and
 * is not what is under test.
 *
 * **This file could not have been written before this story.** `ApparatusRenderer` imported
 * `BlendModes` as a value, so Vitest could not import it at all — the gap the 2.6 review found and
 * that `advanceView.ts` and `apparatusGeometry.ts` were the partial answer to. `setBlendMode('ADD')`
 * resolves through the same table, so the value import is gone and the renderer is reachable.
 *
 * The media query is stubbed rather than mocked at the module boundary, because the renderer caches
 * `matches` at construction and subscribes to `change` — both of which are the behaviour, not an
 * implementation detail.
 */

let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

const mount = (store: AppStore) => {
    const slice = makeSceneSlice();
    const renderer = new ApparatusRenderer(slice.scene, createPhaserStoreAdapter(store), { openNotebook: () => undefined });
    return { ...slice, renderer };
};

/** A store standing at the bench with the phase the apparatus needs, driven by public actions only. */
const storeAtTheBench = (): AppStore => {
    const store = createStore(createInitialAppState(definition));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    return store;
};

const stub = makeWindowStub();

beforeEach(() => {
    stub.setReducedMotion(false);
    stub.setNarrowViewport(false);
    vi.stubGlobal('window', stub.window);
});

afterEach(() => { vi.unstubAllGlobals(); });

/**
 * The light's own objects, found the way the renderer distinguishes them rather than by index.
 *
 * `createRichPattern` is the first thing `create()` calls and its comment states the layer order in as
 * many words — *"back to front: fringe pattern under a soft additive glow of light"* — so the first three
 * `graphics` are the fringes, the beam and the wavefronts, in that order. `scene.add.circle` is used
 * **twice in the whole renderer**, for the source's glow and its core. Both facts are the renderer's, not
 * this test's: a test that fabricated its own idea of which object was which would be the 2.9 defect
 * again, and that is what these accessors exist to avoid.
 */
const light = (ui: ReturnType<typeof mount>) => {
    const graphics = ui.ofKind('graphics');
    const circles = ui.ofKind('circle');
    expect(graphics.length).toBeGreaterThanOrEqual(3);
    expect(circles).toHaveLength(2);
    // The beam and the wavefronts are the additive pair, which the renderer marks itself.
    expect(graphics[1]!.state.blendMode).toBe('ADD');
    expect(graphics[2]!.state.blendMode).toBe('ADD');
    return {
        fringes: graphics[0]!,
        beam: graphics[1]!,
        wavefronts: graphics[2]!,
        sourceGlow: circles[0]!,
        sourceCore: circles[1]!
    };
};

describe('the apparatus is dark until the player starts it (AC4)', () => {
    /**
     * AC4's *painted* half, which nothing asserted before this review.
     *
     * Replacing `const dark = …` with `const dark = false` in `paintLight` left the whole suite green:
     * the source lit at full alpha, the beam painted across the bench and the fringes visible before any
     * run, with 982 passing tests. The only evidence for this AC was a screenshot paragraph in the
     * story's Completion Notes and no artefact. Mutation-proved on the way back in.
     */
    it('paints no light at all before the first press', () => {
        const store = storeAtTheBench();
        const ui = mount(store);

        ui.renderer.create();
        ui.renderer.render(store.getState());
        const { fringes, beam, wavefronts, sourceGlow, sourceCore } = light(ui);

        // The source is out. 0.18 is the unlit core's own resting alpha, not a lit one.
        expect(sourceGlow.state.alpha).toBe(0);
        expect(sourceCore.state.alpha).toBe(0.18);
        // Nothing propagates: both additive layers were cleared and nothing was drawn back into them.
        expect(beam.state.clears).toBeGreaterThan(0);
        expect(beam.state.commands).toBe(0);
        expect(wavefronts.state.clears).toBeGreaterThan(0);
        expect(wavefronts.state.commands).toBe(0);
        // And no screen pattern beyond the static unlit bar.
        expect(fringes.state.visible).toBe(false);
        ui.renderer.destroy();
    });

    /** The same, for AC6's return to darkness — the setup has moved on from the run that was recorded. */
    it('returns to an unpainted bench when the setup changes under a recorded run', () => {
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        ui.renderer.render(store.getState());
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T10:00:00.000Z' });
        ui.renderer.render(store.getState());
        ui.tick(RUN_ANIMATION_MS + 100);
        // Resolved: the pattern is standing on the screen.
        expect(light(ui).fringes.state.visible).toBe(true);

        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'phaser' });
        ui.renderer.render(store.getState());

        const { fringes, beam, wavefronts, sourceGlow } = light(ui);
        expect(fringes.state.visible).toBe(false);
        expect(sourceGlow.state.alpha).toBe(0);
        expect(beam.state.commands).toBe(0);
        expect(wavefronts.state.commands).toBe(0);
        ui.renderer.destroy();
    });

    /**
     * A restored session arrives at a dark bench, not at somebody else's run.
     *
     * `main.ts` boots through `createAppStateFromCaseRecord`, which restores `runs` with the phase, and
     * `lastRunId` starting `undefined` made the first `render()` treat all of that as news: the bench
     * ignited and locked every control for 2.4 s for a run recorded in a previous session.
     */
    it('does not ignite for runs that were already recorded when the bench was built', () => {
        const store = storeAtTheBench();
        // Recorded before the renderer exists, which is what a reload looks like from here.
        store.dispatch({ type: 'experiment.run', id: 'run-before', timestamp: '2026-08-07T09:00:00.000Z' });
        const ui = mount(store);

        ui.renderer.create();
        ui.renderer.render(store.getState());

        // No loop, so no propagation and no lock — ADR-012 gates on a player-initiated run, never on the
        // scene's lifecycle.
        expect(ui.updateHandlers).toHaveLength(0);
        expect(light(ui).wavefronts.state.commands).toBe(0);

        // And the next real press still ignites: this suppresses history, not the player.
        store.dispatch({ type: 'experiment.run', id: 'run-after', timestamp: '2026-08-07T09:05:00.000Z' });
        ui.renderer.render(store.getState());

        expect(ui.updateHandlers).toHaveLength(1);
        ui.renderer.destroy();
    });

    it('registers no update loop from create(), and none while the bench sits idle', () => {
        const store = storeAtTheBench();
        const ui = mount(store);

        ui.renderer.create();
        ui.renderer.render(store.getState());

        // The thing ADR-012 removes, and what §Engine's don't-miss table names in as many words: the
        // light used to animate unattended from the moment the scene existed.
        expect(ui.updateHandlers).toHaveLength(0);

        // A control change is not a run, so it must not start one either.
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'phaser' });
        ui.renderer.render(store.getState());

        expect(ui.updateHandlers).toHaveLength(0);
        ui.renderer.destroy();
    });
});

describe('starting the light is the run (AC5)', () => {
    it('runs a loop only for the duration of the run, and releases it when the run resolves', () => {
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        ui.renderer.render(store.getState());

        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T10:00:00.000Z' });
        ui.renderer.render(store.getState());
        expect(ui.updateHandlers).toHaveLength(1);

        // Short of the bound the run is still in flight; past it, it is not — and the loop is gone.
        ui.tick(RUN_ANIMATION_MS - 100);
        expect(ui.updateHandlers).toHaveLength(1);
        ui.tick(200);

        expect(ui.updateHandlers).toHaveLength(0);
        expect(ui.removedUpdateHandlers).toHaveLength(1);
        ui.renderer.destroy();
    });

    it('completes inside the three seconds AC5 allows', () => {
        expect(RUN_ANIMATION_MS).toBeLessThanOrEqual(3_000);
        expect(RUN_ANIMATION_MS).toBeGreaterThan(0);
    });

    it('returns the bench to an unlit idle when the setup changes under a recorded run (AC6)', () => {
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T10:00:00.000Z' });
        ui.renderer.render(store.getState());
        ui.tick(RUN_ANIMATION_MS + 100);

        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'phaser' });
        ui.renderer.render(store.getState());

        // No loop, and nothing left running: the recorded pattern belonged to a setup that has moved.
        expect(ui.updateHandlers).toHaveLength(0);
        ui.renderer.destroy();
    });
});

/**
 * AC3's keyboard half, which had no assertion at any layer.
 *
 * Doubling `step(direction)` to two consecutive calls — the exact defect the story's own Dev Agent Record
 * names as *"AC3's 'exactly one authored step', broken invisibly"*, caused by Phaser replaying its
 * keyboard queue within a frame — left 982 tests green. `SingleKeyDelivery.test.ts` covers the guard in
 * isolation and nothing wired it to an instrument; the e2e walk drives the *pointer* affordance. So the
 * one path the guard exists for was the one nothing drove.
 *
 * Driven through the surface: focus by pressing the knob's own hit area, then deliver a real `keydown` to
 * the handler the renderer registered. No private method is called.
 */
describe('the keyboard reaches the same record as the pointer (AC3)', () => {
    /** The knob hit areas, in authored control order — `createBench` builds one instrument per control. */
    const knobs = (ui: ReturnType<typeof mount>) =>
        ui.ofKind('zone').filter(({ handlers }) => handlers.has('pointerdown'));

    const pressKey = (ui: ReturnType<typeof mount>, key: string): void => {
        const handlers = ui.keyboardHandlersFor('keydown');
        expect(handlers).toHaveLength(1);
        handlers[0]!({ key, preventDefault: () => undefined } as unknown as KeyboardEvent);
    };

    const focusFirstKnob = (ui: ReturnType<typeof mount>): void => {
        const [first] = knobs(ui);
        expect(first).toBeDefined();
        first!.handlers.get('pointerdown')!({ id: 1, x: 0, y: 0 });
    };

    it('moves exactly one authored step per arrow press, never two', () => {
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        ui.renderer.render(store.getState());
        const control = definition.apparatus.primaryControls[0]!;
        const before = store.getState().activeControlValues[control.id];

        focusFirstKnob(ui);
        pressKey(ui, 'ArrowRight');

        // Exactly one step. A doubled delivery lands two, which is the invisible break.
        expect(store.getState().activeControlValues[control.id]).toBeCloseTo(before + control.step, 10);

        pressKey(ui, 'ArrowLeft');
        expect(store.getState().activeControlValues[control.id]).toBeCloseTo(before, 10);
        ui.renderer.destroy();
    });

    it('delivers one press once even when Phaser replays it inside the same frame', () => {
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        ui.renderer.render(store.getState());
        const control = definition.apparatus.primaryControls[0]!;
        const before = store.getState().activeControlValues[control.id];

        focusFirstKnob(ui);
        // The replay: `KeyboardPlugin.update()` dispatches everything in the manager's queue and does not
        // clear it, so the *same event object* arrives more than once within a frame.
        const handler = ui.keyboardHandlersFor('keydown')[0]!;
        const event = { key: 'ArrowRight', preventDefault: () => undefined } as unknown as KeyboardEvent;
        handler(event);
        handler(event);
        handler(event);

        expect(store.getState().activeControlValues[control.id]).toBeCloseTo(before + control.step, 10);
        ui.renderer.destroy();
    });

    it('does not step an instrument that has not been focused', () => {
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        ui.renderer.render(store.getState());
        const control = definition.apparatus.primaryControls[0]!;
        const before = store.getState().activeControlValues[control.id];

        pressKey(ui, 'ArrowRight');

        expect(store.getState().activeControlValues[control.id]).toBe(before);
        ui.renderer.destroy();
    });

    /** D4: the focus ring is drawn, and AC3's "with the knob focused" is unsatisfiable without it. */
    it('shows a focus treatment on the instrument the player touched, and only that one', () => {
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        ui.renderer.render(store.getState());
        const ringsBefore = ui.ofKind('graphics').filter(({ state }) => state.visible).length;

        focusFirstKnob(ui);

        // One more visible graphics than before: the ring on the touched knob.
        expect(ui.ofKind('graphics').filter(({ state }) => state.visible).length).toBe(ringsBefore + 1);
        ui.renderer.destroy();
    });

    /**
     * The arrow-key capture is global in Phaser and drives `preventDefault`, so it must be held exactly as
     * long as an instrument is focused — taken on focus and released only in `destroy()`, it swallowed
     * page scrolling for the rest of the scene's life after a single knob click.
     */
    it('holds the arrow-key capture only while an instrument is focused', () => {
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        ui.renderer.render(store.getState());
        expect(ui.capturedKeys()).toEqual([]);

        focusFirstKnob(ui);
        expect(ui.capturedKeys()).toEqual(expect.arrayContaining(['LEFT', 'RIGHT', 'UP', 'DOWN']));

        // An overlay taking the bench's input gives the keys back to the page.
        ui.renderer.setInputEnabled(false);
        expect(ui.capturedKeys()).toEqual([]);

        ui.renderer.destroy();
        expect(ui.capturedKeys()).toEqual([]);
    });
});

describe('reduced motion gets the resolved frame, not the journey (AC9)', () => {
    it('registers no loop at all and paints the result straight in', () => {
        stub.setReducedMotion(true);
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        ui.renderer.render(store.getState());

        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T10:00:00.000Z' });
        ui.renderer.render(store.getState());

        // The assertion AC9 actually names. A renderer that registered here would animate on a machine
        // whose owner asked for none.
        expect(ui.updateHandlers).toHaveLength(0);
        ui.renderer.destroy();
    });

    /**
     * The record is identical either way — asserted rather than argued (AC9).
     *
     * It is true **by construction** and this pins the construction: the record is made by
     * `experiment.run` before either path is chosen, so the motion path and the still path cannot
     * disagree about it. Both stores are driven through the same public actions.
     */
    it('records byte-identical runs on the motion path and the still path', () => {
        stub.setReducedMotion(false);
        const moving = storeAtTheBench();
        const movingUi = mount(moving);
        movingUi.renderer.create();
        moving.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T10:00:00.000Z' });
        movingUi.renderer.render(moving.getState());
        movingUi.tick(RUN_ANIMATION_MS + 100);

        stub.setReducedMotion(true);
        const still = storeAtTheBench();
        const stillUi = mount(still);
        stillUi.renderer.create();
        still.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T10:00:00.000Z' });
        stillUi.renderer.render(still.getState());

        expect(still.getState().runs).toEqual(moving.getState().runs);
        expect(still.getState().runs).toHaveLength(1);
        movingUi.renderer.destroy();
        stillUi.renderer.destroy();
    });

    /**
     * Turning `reduce` on mid-run hands the bench back, rather than stranding it locked.
     *
     * The previous version of this test asserted only that the update loop was gone — and it passed while
     * the bench stayed **fully unusable** (review 2026-08-07). `settleRun()` writes `runInFlight` and
     * detaches the loop; it does not decide input state, the start label or the readout's visibility,
     * because `render` is the one place that decides those, and this was the only settle path that did not
     * call it. Every instrument, the chooser, the start control and the notebook control stayed
     * `disableInteractive()`, the start control still read "Light running…", and nothing on the bench could
     * produce the dispatch that would have released it. Its own comment described the defect it had.
     */
    it('resolves a run already in flight when the OS setting is turned on mid-play', () => {
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        ui.renderer.render(store.getState());
        const usableWhenIdle = ui.drawn.filter(({ state }) => state.interactive).length;
        expect(usableWhenIdle).toBeGreaterThan(0);

        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T10:00:00.000Z' });
        ui.renderer.render(store.getState());
        expect(ui.updateHandlers).toHaveLength(1);
        // Locked for the run's duration, which is AC6's half of the bargain.
        expect(ui.drawn.filter(({ state }) => state.interactive).length).toBeLessThan(usableWhenIdle);

        stub.setReducedMotion(true);
        stub.listeners().forEach((listener) => listener());

        // Not merely paused: a stranded run would leave the bench locked with nothing to unlock it.
        expect(ui.updateHandlers).toHaveLength(0);
        // The load-bearing assertion. Every control the run took away is back.
        expect(ui.drawn.filter(({ state }) => state.interactive).length).toBe(usableWhenIdle);
        // And the start control has stopped claiming a run is under way.
        expect(ui.texts()).not.toContain('Light running…');
        ui.renderer.destroy();
    });
});

describe('teardown', () => {
    it('lets go of the update loop even when destroyed mid-run', () => {
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T10:00:00.000Z' });
        ui.renderer.render(store.getState());
        expect(ui.updateHandlers).toHaveLength(1);

        ui.renderer.destroy();

        expect(ui.updateHandlers).toHaveLength(0);
        expect(ui.drawn.length).toBeGreaterThan(0);
        expect(ui.drawn.every(({ state }) => state.destroyed)).toBe(true);
    });
});
