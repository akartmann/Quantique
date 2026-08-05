import type { AppStore } from '../../core/store/createStore';
import { selectCasePhase } from '../../core/store/selectors';
import type { CasePhase } from '../../domain/cases/CaseProgress';
import type { ScenarioScript, SceneKey } from '../../domain/cases/ScenarioScript';

/**
 * The slice of Phaser's scene manager the router drives, declared structurally so it can be
 * injected — a real Phaser.Game needs a canvas that the Vitest environment does not provide.
 */
export type SceneRouterTarget = Readonly<{
    start: (sceneKey: SceneKey) => unknown;
    stop: (sceneKey: SceneKey) => unknown;
    isActive: (sceneKey: SceneKey) => boolean | null;
}>;

export type SceneRouter = Readonly<{
    getActiveSceneKey: () => SceneKey | undefined;
    dispose: () => void;
}>;

/**
 * Resolves the scene that mirrors a phase from the authored scenario script (ADR-009).
 * Pure and Phaser-free: the case content owns the map, the router only obeys it.
 * Loading validation guarantees the script covers every phase, so a miss is a content defect.
 */
export const resolveSceneKey = (scenarioScript: ScenarioScript, phase: CasePhase): SceneKey => {
    const scene = scenarioScript.scenes.find((candidate) => candidate.phase === phase);
    if (!scene) {
        throw new Error(`The scenario script does not map the ${phase} phase to a scene.`);
    }
    return scene.sceneKey;
};

/**
 * Keeps the active Phaser scene mirroring the authoritative case phase (ADR-001, ADR-009).
 *
 * The router is read-only over the store: it never dispatches and never infers a phase from scene
 * state. It activates the scene for the *current* phase at construction, which is also what
 * restores a reloaded session — the persisted phase is already in the initial state.
 */
export const createSceneRouter = (
    scenes: SceneRouterTarget,
    store: AppStore,
    scenarioScript: ScenarioScript,
    onSceneActivated?: (sceneKey: SceneKey) => void
): SceneRouter => {
    let activeSceneKey: SceneKey | undefined;

    const activate = (): void => {
        const nextSceneKey = resolveSceneKey(scenarioScript, selectCasePhase(store.getState()));
        // The store notifies on every transition, and one scene can host several phases.
        if (nextSceneKey === activeSceneKey) return;

        if (activeSceneKey) scenes.stop(activeSceneKey);
        activeSceneKey = nextSceneKey;
        // Starting an already-running scene would restart it and discard its display objects.
        if (!scenes.isActive(nextSceneKey)) scenes.start(nextSceneKey);
        onSceneActivated?.(nextSceneKey);
    };

    activate();
    const unsubscribe = store.subscribe(activate);

    return {
        getActiveSceneKey: () => activeSceneKey,
        dispose: () => {
            unsubscribe();
        }
    };
};
