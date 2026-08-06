import type { AppStore } from '../../core/store/createStore';
import type { PrimaryControl } from '../../domain/cases/CaseDefinition';

/** Which proposal set a surface is choosing from. The two sets are looked up independently. */
export type ProposalKind = 'prediction' | 'conclusion';

/**
 * Every forward transition the adventure has, named after the move rather than after the action that
 * makes it (Story 2.7).
 *
 * The indirection earns its keep because **three of the six are not `case.phaseAdvance`**, and each
 * of the three fails differently if a surface guesses:
 *
 * - `synthesis → review` must dispatch `theory.reviewRequested`. `case.phaseAdvance` with
 *   `nextPhase: 'review'` would *succeed* — `advanceCasePhase` permits it and `reduceCasePhaseAdvance`
 *   has no gate for it — and silently bypass `evaluateConclusionReadiness`. It looks like it works.
 * - `review → debrief` must dispatch `case.debriefCompleted`. `reduceCasePhaseAdvance` refuses that
 *   pair outright (`debrief-completion-required`) as its very first check, so the uniform mapping
 *   makes the last transition permanently unreachable.
 * - the replay is `case.replayStarted`, which resets the investigation rather than moving a phase.
 *
 * A scene therefore names the *move* and never the action, and this module is the single place the
 * two are related. `tests/unit/PhaserStoreAdapter.test.ts` pins all three.
 */
export const ADVANCE_TRANSITION_IDS = [
    'context-to-prediction',
    'prediction-to-experiment',
    'experiment-to-synthesis',
    'synthesis-to-review',
    'review-to-debrief',
    'debrief-replay'
] as const;

export type AdvanceTransitionId = typeof ADVANCE_TRANSITION_IDS[number];

export type PhaserStoreAdapter = Readonly<{
    getState: AppStore['getState'];
    setControlValue: (controlId: PrimaryControl['id'], value: number) => ReturnType<AppStore['dispatch']>;
    chooseProposal: (kind: ProposalKind, proposalId: string) => ReturnType<AppStore['dispatch']>;
    /** Putting the chosen conclusion in front of the rival lab. The adapter stamps the submission time. */
    submitConclusion: () => ReturnType<AppStore['dispatch']>;
    /** Answering a standing rival-lab challenge. Clears the challenge; keeps the choice and the draft. */
    requestRivalLabRevision: () => ReturnType<AppStore['dispatch']>;
    /**
     * Taking one named forward transition (Story 2.7). It generalizes Story 2.6's `advanceToSynthesis`,
     * which was the only one of the six that had a canvas dispatcher at all.
     *
     * It decides nothing: the caller names the move that its phase authorizes, and every gate stays in
     * the reducer where it is answerable. The refusal comes back as the `Result` it was, because the
     * two registers a surface answers with — the authored colleague hint and the localized error —
     * are told apart by the error's `code`.
     */
    advanceCase: (transition: AdvanceTransitionId) => ReturnType<AppStore['dispatch']>;
    subscribe: AppStore['subscribe'];
}>;

/**
 * The exact action behind each move.
 *
 * Timestamps are stamped **here** and never in a reducer: a reducer that read the clock would not be
 * a pure function of its arguments, and `submitConclusion` already set that precedent.
 */
const ADVANCE_DISPATCHERS: Readonly<Record<AdvanceTransitionId, (store: AppStore) => ReturnType<AppStore['dispatch']>>> = {
    'context-to-prediction': (store) => store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' }),
    'prediction-to-experiment': (store) => store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' }),
    'experiment-to-synthesis': (store) => store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' }),
    'synthesis-to-review': (store) => store.dispatch({ type: 'theory.reviewRequested' }),
    'review-to-debrief': (store) => store.dispatch({ type: 'case.debriefCompleted', timestamp: new Date().toISOString() }),
    'debrief-replay': (store) => store.dispatch({ type: 'case.replayStarted' })
};

export const createPhaserStoreAdapter = (store: AppStore): PhaserStoreAdapter => ({
    getState: store.getState,
    setControlValue: (controlId, value) => store.dispatch({
        type: 'apparatus.controlSet',
        controlId,
        value,
        origin: 'phaser'
    }),
    chooseProposal: (kind, proposalId) => store.dispatch(kind === 'prediction'
        ? { type: 'prediction.proposalChosen', proposalId }
        : { type: 'theory.conclusionProposalChosen', proposalId }),
    // Stamped here rather than in the reducer: a reducer that read the clock would not be a pure
    // function of its arguments, and every other timestamped action follows the same rule.
    submitConclusion: () => store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: new Date().toISOString() }),
    requestRivalLabRevision: () => store.dispatch({ type: 'rivalLab.revisionRequested' }),
    advanceCase: (transition) => ADVANCE_DISPATCHERS[transition](store),
    subscribe: store.subscribe
});
