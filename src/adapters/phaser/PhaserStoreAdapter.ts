import type { AppStore } from '../../core/store/createStore';
import type { PrimaryControl } from '../../domain/cases/CaseDefinition';

/** Which proposal set a surface is choosing from. The two sets are looked up independently. */
export type ProposalKind = 'prediction' | 'conclusion';

export type PhaserStoreAdapter = Readonly<{
    getState: AppStore['getState'];
    setControlValue: (controlId: PrimaryControl['id'], value: number) => ReturnType<AppStore['dispatch']>;
    chooseProposal: (kind: ProposalKind, proposalId: string) => ReturnType<AppStore['dispatch']>;
    /** Putting the chosen conclusion in front of the rival lab. The adapter stamps the submission time. */
    submitConclusion: () => ReturnType<AppStore['dispatch']>;
    /** Answering a standing rival-lab challenge. Clears the challenge; keeps the choice and the draft. */
    requestRivalLabRevision: () => ReturnType<AppStore['dispatch']>;
    subscribe: AppStore['subscribe'];
}>;

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
    subscribe: store.subscribe
});
