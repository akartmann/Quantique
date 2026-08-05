import { describe, expect, it } from 'vitest';

import { createSceneRouter, type SceneRouterTarget } from '../../src/adapters/phaser/SceneRouter';
import { createInitialAppState, type AppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import type { CasePhase } from '../../src/domain/cases/CaseProgress';
import type { ScenarioScript, SceneKey } from '../../src/domain/cases/ScenarioScript';

const scenarioScript: ScenarioScript = {
    scenes: [
        { phase: 'context', sceneKey: 'Library' },
        { phase: 'prediction', sceneKey: 'Colleagues' },
        { phase: 'experiment', sceneKey: 'Laboratory' },
        { phase: 'synthesis', sceneKey: 'TheoryBoard' },
        { phase: 'review', sceneKey: 'TheoryBoard' },
        { phase: 'debrief', sceneKey: 'Debrief' }
    ]
};

const definition = {
    id: 'young-interference', prediction: { required: true }, requirements: { minimumRuns: 2, minimumSources: 2 },
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    contextualArtifacts: [
        { id: 'source-1', displayName: 'First source', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'first' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' },
        { id: 'source-2', displayName: 'Second source', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'second' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }
    ],
    experiment: { modelVersion: 'young-observation-v1' },
    scenarioScript
} as CaseDefinition;

/** Stands in for Phaser's scene manager: a headless Phaser.Game needs a canvas Vitest does not have. */
const createFakeSceneManager = (): SceneRouterTarget & { calls: string[]; active: Set<string> } => {
    const active = new Set<string>();
    const calls: string[] = [];
    return {
        active,
        calls,
        start: (sceneKey) => {
            calls.push(`start:${sceneKey}`);
            active.add(sceneKey);
        },
        stop: (sceneKey) => {
            calls.push(`stop:${sceneKey}`);
            active.delete(sceneKey);
        },
        isActive: (sceneKey) => active.has(sceneKey)
    };
};

const storeAtPhase = (phase: CasePhase): AppStore =>
    createStore({ ...createInitialAppState(definition), phase } as AppState);

const advanceToExperiment = (store: AppStore): void => {
    ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.recorded', prediction: 'A patterned result may appear.' });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
};

describe('SceneRouter', () => {
    it('activates the scene for the initial phase before any transition', () => {
        const scenes = createFakeSceneManager();

        const router = createSceneRouter(scenes, createStore(createInitialAppState(definition)), scenarioScript);

        expect(router.getActiveSceneKey()).toBe('Library');
        expect(scenes.calls).toEqual(['start:Library']);
        router.dispose();
    });

    it('follows the authoritative phase and stops the scene it leaves', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        const router = createSceneRouter(scenes, store, scenarioScript);

        advanceToExperiment(store);

        expect(router.getActiveSceneKey()).toBe('Laboratory');
        expect(scenes.calls).toEqual([
            'start:Library',
            'stop:Library', 'start:Colleagues',
            'stop:Colleagues', 'start:Laboratory'
        ]);
        expect([...scenes.active]).toEqual(['Laboratory']);
        router.dispose();
    });

    it('never dispatches a phase change of its own', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        const router = createSceneRouter(scenes, store, scenarioScript);

        expect(store.getState().phase).toBe('context');
        router.dispose();
    });

    it('leaves the scene running when a transition keeps the same authored scene', () => {
        const scenes = createFakeSceneManager();
        const store = storeAtPhase('synthesis');
        const router = createSceneRouter(scenes, store, scenarioScript);

        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'review' });

        expect(store.getState().phase).toBe('review');
        expect(router.getActiveSceneKey()).toBe('TheoryBoard');
        expect(scenes.calls).toEqual(['start:TheoryBoard']);
        router.dispose();
    });

    it('does not restart the active scene when the store notifies without a phase change', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        const router = createSceneRouter(scenes, store, scenarioScript);

        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'dom' });

        expect(scenes.calls).toEqual(['start:Library']);
        router.dispose();
    });

    it.each([
        ['experiment', 'Laboratory'],
        ['review', 'TheoryBoard'],
        ['debrief', 'Debrief']
    ] as const)('restores a reloaded session at the %s phase into the %s scene', (phase, sceneKey) => {
        const scenes = createFakeSceneManager();

        const router = createSceneRouter(scenes, storeAtPhase(phase), scenarioScript);

        expect(router.getActiveSceneKey()).toBe(sceneKey);
        expect(scenes.calls).toEqual([`start:${sceneKey}`]);
        router.dispose();
    });

    it('reports each activation so the shell can expose the active scene', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        const activated: SceneKey[] = [];

        const router = createSceneRouter(scenes, store, scenarioScript, (sceneKey) => activated.push(sceneKey));
        advanceToExperiment(store);

        expect(activated).toEqual(['Library', 'Colleagues', 'Laboratory']);
        router.dispose();
    });

    it('stops following the phase once disposed', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        const router = createSceneRouter(scenes, store, scenarioScript);

        router.dispose();
        advanceToExperiment(store);

        expect(scenes.calls).toEqual(['start:Library']);
        expect(router.getActiveSceneKey()).toBe('Library');
    });
});
