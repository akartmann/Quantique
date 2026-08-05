import type { ContextualArtifact, PrimaryControl } from '../../domain/cases/CaseDefinition';
import type { RunRecord } from '../../domain/evidence/RunRecord';
import type { AppState, ComparisonNote, CompletionSnapshot, ReplayState } from './AppState';
import type { ConsultationProjection } from '../../domain/review/ConsultationRule';
import type { PeerReviewProjection } from '../../domain/review/peerReviewRules';
import type { DecisionHistoryEntry } from './AppState';
import { evaluateConclusionReadiness, type ConclusionReadiness, type TheoryBoardDraft } from '../../domain/theory/conclusionReadiness';
import type { CasePhase } from '../../domain/cases/CaseProgress';
import { createCaseRecordProjection } from './CaseRecordProjection';
import type { Result } from '../errors/Result';
import type { CaseRecord } from '../../schemas/CaseRecordSchema';
import type { RecognitionState } from '../../domain/recognition/recognitionRules';
import { evaluateContextReadiness, evaluatePredictionReadiness, type ContextReadiness, type PredictionReadiness } from '../../domain/cases/contextPredictionReadiness';

const decimalPlaces = (value: number): number => value.toString().split('.')[1]?.length ?? 0;

export const selectPrimaryControl = (state: AppState, controlId: PrimaryControl['id']): PrimaryControl => {
    const control = state.caseDefinition.apparatus.primaryControls.find(({ id }) => id === controlId);
    if (!control) {
        throw new Error(`Unknown authored control: ${controlId}`);
    }
    return control;
};

export const selectControlValue = (state: AppState, controlId: PrimaryControl['id']): number =>
    state.activeControlValues[controlId];

export const selectFormattedControlValue = (state: AppState, controlId: PrimaryControl['id']): string => {
    const control = selectPrimaryControl(state, controlId);
    return `${selectControlValue(state, controlId).toFixed(decimalPlaces(control.step))} ${control.unit}`;
};

export const selectNotebookObservations = (state: AppState): readonly RunRecord[] => state.runs;

export const selectContextualArtifacts = (state: AppState): readonly ContextualArtifact[] => state.caseDefinition.contextualArtifacts;

export const selectSourceById = (state: AppState, sourceId: string): ContextualArtifact | undefined =>
    selectContextualArtifacts(state).find(({ id }) => id === sourceId);

export const selectInspectedSourceIds = (state: AppState): readonly string[] => state.inspectedSourceIds;

export const selectSavedPrediction = (state: AppState): string => state.prediction;

export const selectContextualReadiness = (state: AppState): ContextReadiness =>
    evaluateContextReadiness(state.caseDefinition, state.inspectedSourceIds);

export const selectMissingContextArtifactLabels = (state: AppState): readonly string[] =>
    selectContextualReadiness(state).missingArtifactLabels;

export const selectPredictionReadiness = (state: AppState): PredictionReadiness =>
    evaluatePredictionReadiness(state.caseDefinition, state.prediction);

export const selectIsSourceInspected = (state: AppState, sourceId: string): boolean =>
    selectInspectedSourceIds(state).includes(sourceId);

export const selectSourceLabel = (state: AppState, sourceId: string): string =>
    selectSourceById(state, sourceId)?.displayName ?? `Unavailable source (${sourceId})`;

export const selectRunObservation = (state: AppState, runId: string): Readonly<{ order: number; record: RunRecord }> | undefined => {
    const order = state.runs.findIndex(({ id }) => id === runId);
    return order === -1 ? undefined : { order: order + 1, record: state.runs[order] };
};

export const selectSelectedComparisonPair = (state: AppState): readonly [RunRecord, RunRecord] | undefined => {
    if (state.comparison.selectedRunIds.length !== 2) return undefined;
    const selected = state.comparison.selectedRunIds.map((id) => state.runs.find((run) => run.id === id));
    return selected[0] && selected[1] ? [selected[0], selected[1]] : undefined;
};

const pairKey = (runIds: readonly [string, string]): string => JSON.stringify([...runIds].sort());

export const selectComparisonNote = (state: AppState): ComparisonNote | undefined => {
    const pair = selectSelectedComparisonPair(state);
    if (!pair) return undefined;
    return state.comparison.notes.find((note) => pairKey(note.runIds) === pairKey([pair[0].id, pair[1].id]));
};

export const selectCasePhase = (state: AppState): CasePhase => state.phase;

export const selectTheoryBoardDraft = (state: AppState): TheoryBoardDraft => state.theory;

export const selectSelectedSupportingRuns = (state: AppState): readonly RunRecord[] =>
    state.theory.selectedRunIds.flatMap((id) => state.runs.filter((run) => run.id === id));

export const selectSelectedSupportingSources = (state: AppState): readonly ContextualArtifact[] =>
    state.theory.selectedSourceIds.flatMap((id) => selectSourceById(state, id) ? [selectSourceById(state, id)!] : []);

export const selectConclusionReadiness = (state: AppState): ConclusionReadiness => evaluateConclusionReadiness(state.caseDefinition, {
    runs: state.runs,
    inspectedSourceIds: state.inspectedSourceIds
}, state.theory);

export const selectConsultation = (state: AppState): ConsultationProjection | undefined => state.consultation;

export const selectPeerReview = (state: AppState): PeerReviewProjection | undefined => state.peerReview;

export const selectDecisionHistory = (state: AppState): readonly DecisionHistoryEntry[] => state.decisionHistory;

export const selectRecognition = (state: AppState): RecognitionState => state.recognition;

export const selectCompletionSnapshot = (state: AppState): CompletionSnapshot | undefined => state.completion;

export const selectReplayState = (state: AppState): ReplayState => state.replay;

export const selectPortableCaseRecord = (state: AppState): Result<CaseRecord> => createCaseRecordProjection(state);
