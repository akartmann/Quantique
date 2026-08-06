import { describe, expect, it } from 'vitest';

import {
    ADVANCE_TRANSITION_IDS,
    createPhaserStoreAdapter,
    type AdvanceTransitionId
} from '../../src/adapters/phaser/PhaserStoreAdapter';
import type { AppAction } from '../../src/core/store/AppAction';
import type { AppState } from '../../src/core/store/AppState';
import type { AppStore } from '../../src/core/store/createStore';

/**
 * Which action each forward transition actually dispatches (Story 2.7, Task 1).
 *
 * This is the cheapest place to pin the three traps the story names, and every one of them produces
 * a *plausible* implementation that a phase-level test would still let through:
 *
 * 1. `case.phaseAdvance { nextPhase: 'debrief' }` is refused outright by the reducer, so a uniform
 *    "always dispatch `case.phaseAdvance`" mapping makes the last transition permanently unreachable.
 * 2. `case.phaseAdvance { nextPhase: 'review' }` would *succeed* and be wrong — `advanceCasePhase`
 *    permits `synthesis → review` and no gate stands in front of it, so it silently bypasses
 *    `evaluateConclusionReadiness`, which `theory.reviewRequested` exists to enforce. An integration
 *    test walking the happy path cannot see this: the phase moves either way.
 * 3. `case.debriefCompleted` carries a timestamp, and it is stamped in the adapter rather than in a
 *    reducer — a reducer that read the clock would not be a pure function of its arguments.
 *
 * A recording double rather than a real store: the subject here is the action, not its effect.
 */
const recordingStore = (): Readonly<{ store: AppStore; actions: AppAction[] }> => {
    const actions: AppAction[] = [];
    const store: AppStore = {
        getState: () => ({} as AppState),
        dispatch: (action) => {
            actions.push(action);
            return { ok: true, value: undefined };
        },
        subscribe: () => () => undefined,
        subscribeToUpdates: () => () => undefined,
        replaceWithValidatedRecord: () => ({ ok: true, value: undefined }),
        acquireExclusiveOperation: () => ({ ok: true, value: () => undefined })
    };
    return { store, actions };
};

const dispatched = (transition: AdvanceTransitionId): AppAction => {
    const { store, actions } = recordingStore();
    createPhaserStoreAdapter(store).advanceCase(transition);
    expect(actions).toHaveLength(1);
    return actions[0]!;
};

describe('the adapter dispatcher for each forward transition', () => {
    it('leaves the library for the colleagues by advancing the phase', () => {
        expect(dispatched('context-to-prediction')).toEqual({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    });

    it('leaves the colleagues for the bench by advancing the phase', () => {
        expect(dispatched('prediction-to-experiment')).toEqual({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    });

    it('leaves the laboratory for the theory board by advancing the phase', () => {
        expect(dispatched('experiment-to-synthesis')).toEqual({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
    });

    it('asks for review rather than advancing the phase, so the readiness check is not bypassed', () => {
        // Trap 2, and the most dangerous of the three because the phase-advance version *works*.
        expect(dispatched('synthesis-to-review')).toEqual({ type: 'theory.reviewRequested' });
    });

    it('completes the debrief rather than advancing the phase, which the reducer refuses outright', () => {
        // Trap 1. `reduceCasePhaseAdvance` fails `review → debrief` with `debrief-completion-required`
        // before it reaches `advanceCasePhase`, so the uniform mapping is a dead end, not a bug report.
        const action = dispatched('review-to-debrief');

        expect(action.type).toBe('case.debriefCompleted');
    });

    it('stamps the completion timestamp in the adapter, as a valid round-tripping UTC instant', () => {
        // Trap 3. The reducer rejects anything `new Date(t).toISOString() !== t`, and it must not read
        // the clock itself; `submitConclusion` set the precedent this follows.
        const action = dispatched('review-to-debrief');
        const timestamp = action.type === 'case.debriefCompleted' ? action.timestamp : '';

        expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('starts a replay with its own action', () => {
        expect(dispatched('debrief-replay')).toEqual({ type: 'case.replayStarted' });
    });

    it('dispatches exactly one action per transition, for every transition there is', () => {
        // Guards the sweep above against a transition being added to the union and forgotten here.
        expect(ADVANCE_TRANSITION_IDS).toHaveLength(6);
        ADVANCE_TRANSITION_IDS.forEach((transition) => {
            const { store, actions } = recordingStore();
            createPhaserStoreAdapter(store).advanceCase(transition);
            expect(actions).toHaveLength(1);
        });
    });

    it('reports the store\'s refusal back to the caller rather than swallowing it', () => {
        const store: AppStore = {
            ...recordingStore().store,
            dispatch: () => ({ ok: false, error: { code: 'replay-unavailable', message: 'No.' } })
        };

        const result = createPhaserStoreAdapter(store).advanceCase('debrief-replay');

        expect(result.ok).toBe(false);
    });
});
