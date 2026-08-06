import type { PrimaryControl } from '../../domain/cases/CaseDefinition';
import type { CasePhase } from '../../domain/cases/CaseProgress';
import type { RunRecord } from '../../domain/evidence/RunRecord';

export type ApparatusControlSetAction = Readonly<{
    type: 'apparatus.controlSet';
    controlId: PrimaryControl['id'];
    value: number;
    origin: 'dom' | 'phaser';
}>;

export type RunRecordAction = Readonly<{
    type: 'run.record';
    record: RunRecord;
}>;

export type ExperimentRunAction = Readonly<{
    type: 'experiment.run';
    id: string;
    timestamp: string;
}>;

export type ApparatusWavelengthSetAction = Readonly<{
    type: 'apparatus.wavelengthSet';
    wavelengthNm: 450 | 550 | 650;
}>;

export type ApparatusResetAction = Readonly<{
    type: 'apparatus.reset';
}>;

export type ComparisonRunSelectAction = Readonly<{
    type: 'comparison.runSelected';
    runId: string;
}>;

export type ComparisonRunUnselectAction = Readonly<{
    type: 'comparison.runUnselected';
    runId: string;
}>;

export type ComparisonNoteSaveAction = Readonly<{
    type: 'comparison.noteSaved';
    note: string;
}>;

export type SourceInspectedAction = Readonly<{
    type: 'source.inspected';
    sourceId: string;
}>;

export type PredictionRecordedAction = Readonly<{
    type: 'prediction.recorded';
    prediction: string;
}>;

/**
 * The 1-of-4 attributed prediction choice (Story 1.11). Revisable by design: re-dispatching with
 * any authored proposal replaces the choice and never fails on "already chosen".
 */
export type PredictionProposalChosenAction = Readonly<{
    type: 'prediction.proposalChosen';
    proposalId: string;
}>;

export type TheorySupportRunSelectAction = Readonly<{
    type: 'theory.supportRunSelected';
    runId: string;
}>;

export type TheorySupportRunUnselectAction = Readonly<{
    type: 'theory.supportRunUnselected';
    runId: string;
}>;

export type TheorySupportSourceSelectAction = Readonly<{
    type: 'theory.supportSourceSelected';
    sourceId: string;
}>;

export type TheorySupportSourceUnselectAction = Readonly<{
    type: 'theory.supportSourceUnselected';
    sourceId: string;
}>;

export type TheoryConclusionSetAction = Readonly<{
    type: 'theory.conclusionSet';
    conclusion: string;
}>;

export type TheoryLimitationSetAction = Readonly<{
    type: 'theory.limitationSet';
    limitation: string;
}>;

/**
 * The 1-of-4 attributed conclusion choice (Story 1.11). It records the choice and nothing else: the
 * evidence gate, the defensibility critique, and the unlock timing belong to Stories 2.3/2.5/2.6.
 */
export type TheoryConclusionProposalChosenAction = Readonly<{
    type: 'theory.conclusionProposalChosen';
    proposalId: string;
}>;

export type TheoryReviewRequestAction = Readonly<{
    type: 'theory.reviewRequested';
}>;

export type ConsultationRequestAction = Readonly<{
    type: 'consultation.requested';
}>;

export type PeerReviewRequestAction = Readonly<{
    type: 'peerReview.requested';
}>;

export type RevisionSaveAction = Readonly<{
    type: 'revision.saved';
    timestamp: string;
}>;

export type CasePhaseAdvanceAction = Readonly<{
    type: 'case.phaseAdvance';
    nextPhase: CasePhase;
}>;

export type CaseDebriefCompleteAction = Readonly<{
    type: 'case.debriefCompleted';
    timestamp: string;
}>;

export type CaseReplayStartAction = Readonly<{
    type: 'case.replayStarted';
}>;

export type AppAction = ApparatusControlSetAction
    | RunRecordAction
    | ExperimentRunAction
    | ApparatusWavelengthSetAction
    | ApparatusResetAction
    | ComparisonRunSelectAction
    | ComparisonRunUnselectAction
    | ComparisonNoteSaveAction
    | SourceInspectedAction
    | PredictionRecordedAction
    | PredictionProposalChosenAction
    | TheorySupportRunSelectAction
    | TheorySupportRunUnselectAction
    | TheorySupportSourceSelectAction
    | TheorySupportSourceUnselectAction
    | TheoryConclusionSetAction
    | TheoryLimitationSetAction
    | TheoryConclusionProposalChosenAction
    | TheoryReviewRequestAction
    | ConsultationRequestAction
    | PeerReviewRequestAction
    | RevisionSaveAction
    | CasePhaseAdvanceAction
    | CaseDebriefCompleteAction
    | CaseReplayStartAction;
