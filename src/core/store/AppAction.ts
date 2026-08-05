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
    | TheorySupportRunSelectAction
    | TheorySupportRunUnselectAction
    | TheorySupportSourceSelectAction
    | TheorySupportSourceUnselectAction
    | TheoryConclusionSetAction
    | TheoryLimitationSetAction
    | TheoryReviewRequestAction
    | ConsultationRequestAction
    | PeerReviewRequestAction
    | RevisionSaveAction
    | CasePhaseAdvanceAction;
