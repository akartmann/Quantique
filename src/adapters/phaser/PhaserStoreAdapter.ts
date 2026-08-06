import type { AppStore } from '../../core/store/createStore';
import type { PrimaryControl } from '../../domain/cases/CaseDefinition';

/** Which proposal set a surface is choosing from. The two sets are looked up independently. */
export type ProposalKind = 'prediction' | 'conclusion';

export type PhaserStoreAdapter = Readonly<{
    getState: AppStore['getState'];
    setControlValue: (controlId: PrimaryControl['id'], value: number) => ReturnType<AppStore['dispatch']>;
    chooseProposal: (kind: ProposalKind, proposalId: string) => ReturnType<AppStore['dispatch']>;
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
    subscribe: store.subscribe
});
