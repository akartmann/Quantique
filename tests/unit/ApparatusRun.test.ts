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

describe('the apparatus is dark until the player starts it (AC4)', () => {
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

    it('resolves a run already in flight when the OS setting is turned on mid-play', () => {
        const store = storeAtTheBench();
        const ui = mount(store);
        ui.renderer.create();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T10:00:00.000Z' });
        ui.renderer.render(store.getState());
        expect(ui.updateHandlers).toHaveLength(1);

        stub.setReducedMotion(true);
        stub.listeners().forEach((listener) => listener());

        // Not merely paused: a stranded run would leave the bench locked with nothing to unlock it.
        expect(ui.updateHandlers).toHaveLength(0);
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
