import { describe, expect, it } from 'vitest';

import { createSceneRouter, resolveSceneKey, type SceneRouterTarget } from '../../src/adapters/phaser/SceneRouter';
import { createInitialAppState, type AppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CASE_PHASES } from '../../src/domain/cases/CaseProgress';
import { RIVAL_LAB_SCENE_KEY, ROUTABLE_SCENE_KEYS, SCENE_KEYS, type ScenarioScript } from '../../src/domain/cases/ScenarioScript';

const youngScript: ScenarioScript = {
    scenes: [
        { phase: 'context', sceneKey: 'Library' },
        { phase: 'prediction', sceneKey: 'Colleagues' },
        { phase: 'experiment', sceneKey: 'Laboratory' },
        { phase: 'synthesis', sceneKey: 'TheoryBoard' },
        { phase: 'review', sceneKey: 'TheoryBoard' },
        { phase: 'debrief', sceneKey: 'Debrief' }
    ]
};

describe('resolveSceneKey', () => {
    it.each([
        ['context', 'Library'],
        ['prediction', 'Colleagues'],
        ['experiment', 'Laboratory'],
        ['synthesis', 'TheoryBoard'],
        ['review', 'TheoryBoard'],
        ['debrief', 'Debrief']
    ] as const)('maps the %s phase to the authored %s scene', (phase, sceneKey) => {
        expect(resolveSceneKey(youngScript, phase)).toBe(sceneKey);
    });

    it('resolves every case phase, so the authored map is total', () => {
        expect(CASE_PHASES.map((phase) => resolveSceneKey(youngScript, phase))).toHaveLength(CASE_PHASES.length);
    });

    it('reads the scene from the script rather than a hardcoded map', () => {
        const alternativeScript: ScenarioScript = {
            scenes: youngScript.scenes.map((scene) => scene.phase === 'synthesis' ? { ...scene, sceneKey: 'Laboratory' } : scene)
        };

        expect(resolveSceneKey(alternativeScript, 'synthesis')).toBe('Laboratory');
    });

    it('reports an uncovered phase instead of silently routing nowhere', () => {
        const incompleteScript = { scenes: youngScript.scenes.filter(({ phase }) => phase !== 'debrief') };

        expect(() => resolveSceneKey(incompleteScript, 'debrief')).toThrow(/debrief/);
    });

    /**
     * The rival lab is routable, not authorable, so `resolveSceneKey` must stay a pure phase lookup —
     * the override lives in the router, one layer up. If this ever changes, a case author could route a
     * phase to the rival lab and `SCENE_KEYS` would have stopped being the content contract.
     */
    it('never resolves the rival lab from a phase', () => {
        expect(CASE_PHASES.map((phase) => resolveSceneKey(youngScript, phase))).not.toContain(RIVAL_LAB_SCENE_KEY);
        expect(SCENE_KEYS).not.toContain(RIVAL_LAB_SCENE_KEY);
        expect(ROUTABLE_SCENE_KEYS).toContain(RIVAL_LAB_SCENE_KEY);
    });
});

/**
 * Minimal, because these cases are about routing and nothing else: the definition only has to carry
 * the scenario script the router obeys.
 */
const definition = { id: 'young-interference', version: '1.9.0', scenarioScript: youngScript, apparatus: { primaryControls: [] } } as unknown as CaseDefinition;

/**
 * Stands in for Phaser's scene manager — a real `Phaser.Game` needs a canvas Vitest does not have.
 * `start` runs the pending create listener synchronously, which is what `SceneManager.start` does.
 */
const createFakeSceneManager = (): SceneRouterTarget & { calls: string[] } => {
    const active = new Set<string>();
    const calls: string[] = [];
    const createListeners = new Map<string, () => void>();
    return {
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

/**
 * A state at `synthesis` with or without a standing challenge, assembled directly rather than driven
 * through the evidence gates: what is under test is the router's read of `rivalLabCritique`, and the
 * flow that *produces* it is covered end to end through public actions in
 * `tests/integration/RivalLabCritique.test.ts`.
 */
const stateAtSynthesis = (rivalLabCritique?: AppState['rivalLabCritique']): AppState =>
    ({ ...createInitialAppState(definition), phase: 'synthesis', rivalLabCritique });

describe('createSceneRouter rival-lab override', () => {
    it('routes to the rival lab while a challenge stands, without the phase moving', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(stateAtSynthesis({ critiqueId: 'critique-1', proposalId: 'c-1' }));

        const router = createSceneRouter(scenes, store, youngScript);

        expect(router.getActiveSceneKey()).toBe(RIVAL_LAB_SCENE_KEY);
        expect(store.getState().phase).toBe('synthesis');
        router.dispose();
    });

    it('routes back to the phase’s own scene when the challenge clears', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(stateAtSynthesis({ critiqueId: 'critique-1', proposalId: 'c-1' }));
        const router = createSceneRouter(scenes, store, youngScript);

        expect(store.dispatch({ type: 'rivalLab.revisionRequested' })).toEqual({ ok: true, value: undefined });

        expect(router.getActiveSceneKey()).toBe('TheoryBoard');
        expect(scenes.calls).toEqual(['start:RivalLab', 'stop:RivalLab', 'start:TheoryBoard']);
        router.dispose();
    });

    it('routes to the phase’s own scene when no challenge stands', () => {
        const scenes = createFakeSceneManager();
        const router = createSceneRouter(scenes, createStore(stateAtSynthesis()), youngScript);

        expect(router.getActiveSceneKey()).toBe('TheoryBoard');
        router.dispose();
    });
});
