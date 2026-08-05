import { describe, expect, it, vi } from 'vitest';

import { createSceneRouter, type SceneRouterTarget } from '../../src/adapters/phaser/SceneRouter';
import { createAppStateFromCaseRecord, createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { calculateYoungFringeSpacing } from '../../src/domain/apparatus/calculateYoungFringeSpacing';
import type { CasePhase } from '../../src/domain/cases/CaseProgress';
import { deriveRecognition } from '../../src/domain/recognition/recognitionRules';
import type { CaseRecord } from '../../src/schemas/CaseRecordSchema';
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
    id: 'young-interference', version: '1.0.0', prediction: { required: true }, requirements: { minimumRuns: 2, minimumSources: 2 },
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

/**
 * Stands in for Phaser's scene manager: a headless Phaser.Game needs a canvas Vitest does not have.
 * `start` runs the pending create listener synchronously, mirroring Phaser — `SceneManager.start`
 * boots the scene and emits `create` before returning.
 */
const createFakeSceneManager = (): SceneRouterTarget & { calls: string[]; active: Set<string> } => {
    const active = new Set<string>();
    const calls: string[] = [];
    const createListeners = new Map<string, () => void>();
    return {
        active,
        calls,
        start: (sceneKey) => {
            calls.push(`start:${sceneKey}`);
            active.add(sceneKey);
            const listener = createListeners.get(sceneKey);
            createListeners.delete(sceneKey);
            listener?.();
        },
        stop: (sceneKey) => {
            calls.push(`stop:${sceneKey}`);
            active.delete(sceneKey);
        },
        isActive: (sceneKey) => active.has(sceneKey),
        onceCreated: (sceneKey, listener) => createListeners.set(sceneKey, listener)
    };
};

/** Derived from the domain calculator so the run's stored result matches what restore recomputes. */
const youngRun = (id: string, slitSpacingMm: number, screenDistanceM: number) => {
    const modelInputs = { wavelengthNm: 550, wavelengthMode: 'minimum' as const, slitSpacingMm, screenDistanceM };
    const result = calculateYoungFringeSpacing(modelInputs);
    if (!result.ok) throw new Error(`The ${id} fixture is not a physical Young configuration.`);
    return {
        id,
        caseId: 'young-interference' as const,
        controls: { slitSpacingMm, screenDistanceM },
        modelInputs,
        result: result.value,
        timestamp: `2026-08-05T10:0${id.slice(-1)}:00.000Z`,
        experimentModelVersion: 'young-observation-v1',
        linkedEvidenceIds: ['source-1', 'source-2']
    };
};

const runs = [youngRun('run-001', 0.25, 2), youngRun('run-002', 0.35, 3)];
const runIds: readonly [string, string] = ['run-001', 'run-002'];

/**
 * A record that satisfies every readiness gate restore enforces at the given phase. Restoring at
 * `review` or `debrief` requires a conclusion-ready evidence chain — two distinct physical Young
 * configurations, a saved comparison of them, and a bounded claim — so the fixture carries it for
 * every phase rather than pretending a later phase can be reached without it.
 */
const recordAtPhase = (phase: CasePhase) => {
    const progress = {
        schemaVersion: 3 as const,
        caseId: 'young-interference' as const,
        caseDefinitionVersion: '1.0.0',
        phase,
        activeControlValues: { slitSpacingMm: 0.25, screenDistanceM: 2 },
        inspectedSourceIds: ['source-1', 'source-2'],
        prediction: 'A patterned result may appear.',
        runs,
        comparison: { selectedRunIds: [...runIds], notes: [{ runIds, text: 'Wider spacing narrowed the fringes.' }] },
        theory: {
            selectedRunIds: [...runIds],
            selectedSourceIds: ['source-1', 'source-2'],
            conclusion: 'Within this apparatus range the fringe spacing tracks the slit spacing.',
            limitation: 'Only two configurations were observed.'
        },
        decisionHistory: [],
        replay: { isCounterfactual: false }
    };
    // Restore rejects a record whose recognition disagrees with what the rules derive from it, so it
    // is derived here rather than transcribed.
    return { ...progress, recognition: deriveRecognition(definition, progress) };
};

/**
 * Restores through the same factory the reload path uses, so these cases exercise the mechanism AC2
 * actually relies on rather than a hand-stamped `phase` the reducers could never produce.
 */
const storeAtPhase = (phase: CasePhase): AppStore => {
    const restored = createAppStateFromCaseRecord(recordAtPhase(phase) as CaseRecord, definition);
    if (!restored.ok) throw new Error(`The ${phase} record did not restore: ${restored.error.message}`);
    return createStore(restored.value);
};

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

    it('never dispatches anything of its own, at construction or on a transition', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        // Spying after construction would miss an activation-time dispatch, so wrap before the router
        // exists and count: every call on the spy has to be one this test made.
        const dispatch = vi.spyOn(store, 'dispatch');
        const router = createSceneRouter(scenes, store, scenarioScript);

        expect(dispatch).not.toHaveBeenCalled();

        store.dispatch({ type: 'source.inspected', sourceId: 'source-1' });
        store.dispatch({ type: 'source.inspected', sourceId: 'source-2' });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });

        expect(dispatch).toHaveBeenCalledTimes(3);
        expect(store.getState().phase).toBe('prediction');
        expect(router.getActiveSceneKey()).toBe('Colleagues');
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

    // Restored through the real record path, so each phase here is one a saved session can actually
    // hold. `debrief` is absent deliberately: its record additionally requires a full peer-reviewed
    // completion snapshot, which would make this a persistence fixture rather than a routing test —
    // its phase→scene resolution is covered purely in tests/unit/SceneRouter.test.ts, and the E2E
    // reaches the debrief scene through the real flow.
    it.each([
        ['experiment', 'Laboratory'],
        ['synthesis', 'TheoryBoard'],
        ['review', 'TheoryBoard']
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

    it('reports an activation only once the scene has really been created', () => {
        // Phaser declines an unknown key with a console warning rather than a throw, so a router that
        // announced its own intent would claim a scene that never ran.
        const scenes = { ...createFakeSceneManager(), start: () => undefined };
        const store = createStore(createInitialAppState(definition));
        const activated: SceneKey[] = [];

        const router = createSceneRouter(scenes, store, scenarioScript, (sceneKey) => activated.push(sceneKey));

        expect(activated).toEqual([]);
        router.dispose();
    });

    it('contains a failed activation instead of breaking the dispatch that triggered it', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        const failing = {
            ...scenes,
            start: (sceneKey: SceneKey) => {
                if (sceneKey === 'Colleagues') throw new Error('The scene could not be created.');
                return scenes.start(sceneKey);
            }
        };
        const router = createSceneRouter(failing, store, scenarioScript);
        expect(router.getActiveSceneKey()).toBe('Library');
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));

        // A Phaser create() failure runs inside notify() inside dispatch(). If it escaped, the phase
        // would already have advanced while dispatch threw at its caller and later subscribers were
        // skipped, so the contract to check is that dispatch still returns its Result.
        const transition = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });

        expect(transition.ok).toBe(true);
        expect(store.getState().phase).toBe('prediction');
        // No scene is known to be running, so the next transition must route from scratch rather than
        // matching a stale key and skipping the start.
        expect(router.getActiveSceneKey()).toBeUndefined();
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
