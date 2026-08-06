import type { AppStore } from '../../core/store/createStore';
import { selectCasePhase, selectRivalLabCritique } from '../../core/store/selectors';
import type { CasePhase } from '../../domain/cases/CaseProgress';
import { RIVAL_LAB_SCENE_KEY, type RoutableSceneKey, type ScenarioScript, type SceneKey } from '../../domain/cases/ScenarioScript';

/**
 * The slice of Phaser's scene manager the router drives, declared structurally so it can be
 * injected — a real Phaser.Game needs a canvas that the Vitest environment does not provide.
 */
export type SceneRouterTarget = Readonly<{
    start: (sceneKey: RoutableSceneKey) => unknown;
    stop: (sceneKey: RoutableSceneKey) => unknown;
    isActive: (sceneKey: RoutableSceneKey) => boolean | null;
    /**
     * Registers a one-shot listener for the scene having actually run `create`. The router reports an
     * activation only from this, never from its own intent: `start` is a request Phaser can decline
     * (an unregistered key only warns), so an intent-based signal can claim a scene that never ran.
     */
    onceCreated: (sceneKey: RoutableSceneKey, listener: () => void) => void;
}>;

export type SceneRouter = Readonly<{
    getActiveSceneKey: () => RoutableSceneKey | undefined;
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
    onSceneActivated?: (sceneKey: RoutableSceneKey) => void
): SceneRouter => {
    let activeSceneKey: RoutableSceneKey | undefined;

    const route = (): void => {
        const state = store.getState();
        // A standing rival-lab challenge overrides the phase's scene without moving the phase — which
        // is exactly why `RivalLab` is not in the content vocabulary and `resolveSceneKey` stays a pure
        // phase lookup. The router still only *reads*: the store owns when the challenge stands.
        const nextSceneKey: RoutableSceneKey = selectRivalLabCritique(state)
            ? RIVAL_LAB_SCENE_KEY
            : resolveSceneKey(scenarioScript, selectCasePhase(state));
        // The store notifies on every transition, and one scene can host several phases.
        if (nextSceneKey === activeSceneKey) return;

        if (activeSceneKey) scenes.stop(activeSceneKey);
        activeSceneKey = nextSceneKey;

        // Starting an already-running scene would restart it and discard its display objects. That
        // scene has already run `create`, so report it directly rather than waiting for an event
        // that will not fire again.
        if (scenes.isActive(nextSceneKey)) {
            onSceneActivated?.(nextSceneKey);
            return;
        }

        // Registered before `start` so a synchronous boot still reaches the listener. The guard drops
        // a late callback from a scene the router has since routed away from.
        scenes.onceCreated(nextSceneKey, () => {
            if (activeSceneKey === nextSceneKey) onSceneActivated?.(nextSceneKey);
        });
        scenes.start(nextSceneKey);
    };

    /**
     * The router runs as a store subscriber, so `route` executes inside `notify` inside `dispatch` —
     * and Phaser starts a scene synchronously, meaning `Scene.create` runs there too. An escaping
     * throw would advance the phase, skip every later subscriber, and break `dispatch`'s Result
     * contract for its caller. Routing failures stay routing failures.
     */
    const activate = (): void => {
        try {
            route();
        } catch (error) {
            // The previous scene may already be stopped, so no key can be trusted as active. Clearing
            // it lets the next transition route from scratch instead of skipping a stale match.
            activeSceneKey = undefined;
            console.error('The scene router could not activate the scene for the current phase.', error);
        }
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
