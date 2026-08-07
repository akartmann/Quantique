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

/**
 * The 1-of-4 attributed prediction choice (Story 1.11), and since Story 2.12 the **only** way a
 * prediction is written.
 *
 * `prediction.recorded` — free text out of the retired `CaseContextAndPrediction` panel — was removed
 * rather than given a canvas dispatcher. Keeping both paths live is the "free text must clear the
 * proposal ID" hazard: two writers for one field, one of which has to remember to un-attribute what the
 * other attributed. With no free-text path there is no way to desynchronise the ID from the text at
 * all, so the rule it needed disappears with it. Revisable by design: re-dispatching with
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

/**
 * The 1-of-4 attributed conclusion choice (Story 1.11), and since Story 2.12 the only way `conclusion`
 * and `limitation` are written — `theory.conclusionSet` and `theory.limitationSet` went with the
 * retired theory board, for the reason {@link PredictionProposalChosenAction} states.
 *
 * It writes the claim **and** its limitation together, out of one authored proposal. No blend, no
 * partial write: a state carrying one proposal's claim beside another's limitation was only ever
 * reachable through the two free-text actions, and `tests/integration/ProposalSelection.test.ts` is
 * where that invariant is now proven. It records the choice and nothing else: the
 * evidence gate, the defensibility critique, and the unlock timing belong to Stories 2.3/2.5/2.6.
 */
export type TheoryConclusionProposalChosenAction = Readonly<{
    type: 'theory.conclusionProposalChosen';
    proposalId: string;
}>;

/**
 * Putting the chosen conclusion in front of the rival lab (Story 2.5).
 *
 * Separate from `theory.conclusionProposalChosen` on purpose: choosing stays freely revisable and
 * draws no challenge, and submitting is the deliberate act that invites one. It evaluates
 * defensibility and nothing else — it never advances the phase or completes the case.
 */
export type TheoryConclusionSubmittedAction = Readonly<{
    type: 'theory.conclusionSubmitted';
    timestamp: string;
}>;

/** Answering a standing rival-lab challenge by going back to revise. It clears the challenge only. */
export type RivalLabRevisionRequestedAction = Readonly<{
    type: 'rivalLab.revisionRequested';
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
    | PredictionProposalChosenAction
    | TheorySupportRunSelectAction
    | TheorySupportRunUnselectAction
    | TheorySupportSourceSelectAction
    | TheorySupportSourceUnselectAction
    | TheoryConclusionProposalChosenAction
    | TheoryConclusionSubmittedAction
    | RivalLabRevisionRequestedAction
    | TheoryReviewRequestAction
    | ConsultationRequestAction
    | PeerReviewRequestAction
    | RevisionSaveAction
    | CasePhaseAdvanceAction
    | CaseDebriefCompleteAction
    | CaseReplayStartAction;
