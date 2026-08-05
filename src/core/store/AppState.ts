import type { Result } from '../errors/Result';
import { normalizeControlValue } from '../../domain/apparatus/ApparatusControl';
import { isSourceEligibleForInspection, type CaseDefinition, type PrimaryControl } from '../../domain/cases/CaseDefinition';
import { advanceCasePhase } from '../../domain/cases/caseReducer';
import { evaluateContextReadiness, evaluatePredictionReadiness } from '../../domain/cases/contextPredictionReadiness';
import type { CasePhase } from '../../domain/cases/CaseProgress';
import { createRunRecord, type RunRecord } from '../../domain/evidence/RunRecord';
import { createTheoryBoardDraft, evaluateConclusionReadiness, type TheoryBoardDraft } from '../../domain/theory/conclusionReadiness';
import { selectConsultation, type ConsultationProjection } from '../../domain/review/ConsultationRule';
import { evaluatePeerReview, type PeerReviewProjection } from '../../domain/review/peerReviewRules';
import { deriveRecognition, type RecognitionState } from '../../domain/recognition/recognitionRules';
import { validateCaseRecordForDefinition, type CaseRecord } from '../../schemas/CaseRecordSchema';
import type { AppAction } from './AppAction';

export type ComparisonNote = Readonly<{
    runIds: readonly [string, string];
    text: string;
}>;

export type ComparisonState = Readonly<{
    selectedRunIds: readonly string[];
    notes: readonly ComparisonNote[];
}>;

export type DecisionHistoryEntry = Readonly<{
    version: number;
    priorConclusion: string;
    conclusion: string;
    limitation: string;
    selectedRunIds: readonly string[];
    selectedSourceIds: readonly string[];
    feedback: PeerReviewProjection;
    timestamp: string;
}>;

export type AppState = Readonly<{
    caseDefinition: CaseDefinition;
    phase: CasePhase;
    activeControlValues: Readonly<Record<PrimaryControl['id'], number>>;
    inspectedSourceIds: readonly string[];
    prediction: string;
    runs: readonly RunRecord[];
    comparison: ComparisonState;
    theory: TheoryBoardDraft;
    consultation?: ConsultationProjection;
    peerReview?: PeerReviewProjection;
    decisionHistory: readonly DecisionHistoryEntry[];
    recognition: RecognitionState;
}>;

const freezeComparison = (comparison: ComparisonState): ComparisonState => Object.freeze({
    selectedRunIds: Object.freeze([...comparison.selectedRunIds]),
    notes: Object.freeze(comparison.notes.map((note) => Object.freeze({
        runIds: Object.freeze([note.runIds[0], note.runIds[1]]) as readonly [string, string],
        text: note.text
    })))
});

const freezePeerReview = (review: PeerReviewProjection): PeerReviewProjection => review.status === 'unavailable'
    ? Object.freeze({ status: 'unavailable', message: review.message })
    : Object.freeze({
        status: 'reviewed',
        issues: Object.freeze(review.issues.map((issue) => Object.freeze({ ...issue })))
    });

const freezeState = (state: Omit<AppState, 'recognition'>): AppState => Object.freeze({
    ...state,
    activeControlValues: Object.freeze({ ...state.activeControlValues }),
    inspectedSourceIds: Object.freeze([...state.inspectedSourceIds]),
    runs: Object.freeze([...state.runs]),
    comparison: freezeComparison(state.comparison),
    theory: Object.freeze({
        selectedRunIds: Object.freeze([...state.theory.selectedRunIds]),
        selectedSourceIds: Object.freeze([...state.theory.selectedSourceIds]),
        conclusion: state.theory.conclusion,
        limitation: state.theory.limitation
    }),
    consultation: state.consultation && Object.freeze({
        ruleId: state.consultation.ruleId,
        layers: Object.freeze({ ...state.consultation.layers }),
        nextStep: state.consultation.nextStep
    }),
    peerReview: state.peerReview && freezePeerReview(state.peerReview),
    decisionHistory: Object.freeze(state.decisionHistory.map((entry) => Object.freeze({
        ...entry,
        selectedRunIds: Object.freeze([...entry.selectedRunIds]),
        selectedSourceIds: Object.freeze([...entry.selectedSourceIds]),
        feedback: freezePeerReview(entry.feedback)
    }))),
    recognition: deriveRecognition(state.caseDefinition, state)
});

export const createInitialAppState = (caseDefinition: CaseDefinition): AppState => freezeState({
    caseDefinition,
    phase: 'context',
    activeControlValues: Object.fromEntries(
        caseDefinition.apparatus.primaryControls.map((control) => [control.id, control.defaultValue])
    ) as Record<PrimaryControl['id'], number>,
    inspectedSourceIds: [],
    prediction: '',
    runs: [],
    comparison: { selectedRunIds: [], notes: [] },
    theory: createTheoryBoardDraft(),
    decisionHistory: []
});

/** Creates the sole authoritative state from a validated, definition-compatible portable record. */
export const createAppStateFromCaseRecord = (record: CaseRecord, caseDefinition: CaseDefinition): Result<AppState> => {
    const compatible = validateCaseRecordForDefinition(record, caseDefinition);
    if (!compatible.ok) return compatible;

    const runs: RunRecord[] = [];
    for (const recordRun of record.runs) {
        const snapshot = createRunRecord(recordRun, runs.map(({ id }) => id));
        if (!snapshot.ok) return { ok: false, error: snapshot.error };
        runs.push(snapshot.value);
    }

    return {
        ok: true,
        value: freezeState({
            caseDefinition,
            phase: record.phase,
            activeControlValues: record.activeControlValues,
            inspectedSourceIds: record.inspectedSourceIds,
            prediction: record.prediction,
            runs,
            comparison: record.comparison,
            theory: record.theory,
            decisionHistory: record.decisionHistory
        })
    };
};

const failure = (code: string, message: string): Result<never> => ({ ok: false, error: { code, message } });

const pairKey = (runIds: readonly [string, string]): string => JSON.stringify([...runIds].sort());

const reduceControlSet = (state: AppState, action: Extract<AppAction, { type: 'apparatus.controlSet' }>): Result<AppState> => {
    const control = state.caseDefinition.apparatus.primaryControls.find(({ id }) => id === action.controlId);
    if (!control) {
        return {
            ok: false,
            error: { code: 'unknown-apparatus-control', message: 'That laboratory control is unavailable.' }
        };
    }

    const normalized = normalizeControlValue(control, action.value);
    if (!normalized.ok) {
        return normalized;
    }

    return {
        ok: true,
        value: freezeState({
            ...state,
            activeControlValues: { ...state.activeControlValues, [control.id]: normalized.value }
        })
    };
};

const reduceRecordRun = (state: AppState, record: RunRecord): Result<AppState> => {
    const validated = createRunRecord(record, state.runs.map(({ id }) => id));
    if (!validated.ok) return validated;
    if (validated.value.caseId !== state.caseDefinition.id) {
        return failure('run-case-mismatch', 'That observation belongs to a different investigation.');
    }
    if (!validated.value.linkedEvidenceIds.every((sourceId) => state.inspectedSourceIds.includes(sourceId))) {
        return failure('uninspected-linked-evidence', 'Linked evidence must be inspected before recording an observation.');
    }

    return { ok: true, value: freezeState({ ...state, runs: [...state.runs, validated.value], consultation: undefined, peerReview: undefined }) };
};

const reduceSelectRun = (state: AppState, runId: string): Result<AppState> => {
    if (!state.runs.some(({ id }) => id === runId)) return failure('unknown-run-id', 'That observation is unavailable for comparison.');
    if (state.comparison.selectedRunIds.includes(runId)) return failure('duplicate-comparison-run', 'Choose two different observations to compare.');
    if (state.comparison.selectedRunIds.length >= 2) return failure('too-many-comparison-runs', 'Choose only two observations to compare at once.');

    return {
        ok: true,
        value: freezeState({
            ...state,
            comparison: { ...state.comparison, selectedRunIds: [...state.comparison.selectedRunIds, runId] }
        })
    };
};

const reduceUnselectRun = (state: AppState, runId: string): Result<AppState> => {
    if (!state.runs.some(({ id }) => id === runId)) return failure('unknown-run-id', 'That observation is unavailable for comparison.');
    if (!state.comparison.selectedRunIds.includes(runId)) return failure('comparison-run-not-selected', 'That observation is not selected for comparison.');

    return {
        ok: true,
        value: freezeState({
            ...state,
            comparison: { ...state.comparison, selectedRunIds: state.comparison.selectedRunIds.filter((id) => id !== runId) }
        })
    };
};

const reduceSaveComparisonNote = (state: AppState, note: string): Result<AppState> => {
    if (state.comparison.selectedRunIds.length !== 2) return failure('comparison-pair-required', 'Select two observations before saving a comparison note.');
    if (!note.trim()) return failure('invalid-comparison-note', 'Enter a comparison note before saving it.');

    const runIds = [state.comparison.selectedRunIds[0], state.comparison.selectedRunIds[1]] as const;
    const existingIndex = state.comparison.notes.findIndex((existing) => pairKey(existing.runIds) === pairKey(runIds));
    const savedNote: ComparisonNote = { runIds, text: note.trim() };
    const notes = existingIndex === -1
        ? [...state.comparison.notes, savedNote]
        : state.comparison.notes.map((existing, index) => index === existingIndex ? savedNote : existing);

    return { ok: true, value: freezeState({ ...state, comparison: { ...state.comparison, notes } }) };
};

const reduceSourceInspection = (state: AppState, sourceId: string): Result<AppState> => {
    const source = state.caseDefinition.contextualArtifacts.find(({ id }) => id === sourceId);
    if (!source) return failure('unknown-source-id', 'That source is unavailable in this investigation.');
    if (!isSourceEligibleForInspection(source)) {
        return failure('source-not-eligible', 'That source cannot be inspected as verified evidence right now. Try another contextual source.');
    }
    if (state.inspectedSourceIds.includes(sourceId)) {
        return failure('duplicate-inspected-source', 'That source is already recorded as inspected.');
    }

    return { ok: true, value: freezeState({ ...state, inspectedSourceIds: [...state.inspectedSourceIds, sourceId], consultation: undefined, peerReview: undefined }) };
};

const reducePredictionRecord = (state: AppState, prediction: string): Result<AppState> => {
    const normalized = prediction.trim();
    if (!normalized) return failure('invalid-prediction', 'Enter a tentative prediction before recording it.');
    return {
        ok: true,
        value: freezeState({ ...state, prediction: normalized, consultation: undefined, peerReview: undefined })
    };
};

const withTheory = (state: AppState, theory: TheoryBoardDraft): Result<AppState> => ({
    ok: true,
    value: freezeState({ ...state, theory, consultation: undefined, peerReview: undefined })
});

const reduceTheorySupportRun = (state: AppState, runId: string, selected: boolean): Result<AppState> => {
    if (!state.runs.some(({ id }) => id === runId)) return failure('unknown-theory-run', 'That observation is unavailable as conclusion support.');
    const isSelected = state.theory.selectedRunIds.includes(runId);
    if (selected && isSelected) return failure('duplicate-theory-run', 'That observation is already supporting this conclusion.');
    if (!selected && !isSelected) return failure('theory-run-not-selected', 'That observation is not selected as conclusion support.');
    return withTheory(state, {
        ...state.theory,
        selectedRunIds: selected
            ? [...state.theory.selectedRunIds, runId]
            : state.theory.selectedRunIds.filter((id) => id !== runId)
    });
};

const reduceTheorySupportSource = (state: AppState, sourceId: string, selected: boolean): Result<AppState> => {
    if (!state.inspectedSourceIds.includes(sourceId)) return failure('uninspected-theory-source', 'Inspect that reviewed source before using it as conclusion support.');
    const isSelected = state.theory.selectedSourceIds.includes(sourceId);
    if (selected && isSelected) return failure('duplicate-theory-source', 'That source is already supporting this conclusion.');
    if (!selected && !isSelected) return failure('theory-source-not-selected', 'That source is not selected as conclusion support.');
    return withTheory(state, {
        ...state.theory,
        selectedSourceIds: selected
            ? [...state.theory.selectedSourceIds, sourceId]
            : state.theory.selectedSourceIds.filter((id) => id !== sourceId)
    });
};

const reduceCasePhaseAdvance = (state: AppState, nextPhase: CasePhase): Result<AppState> => {
    const transition = advanceCasePhase({ definition: state.caseDefinition, phase: state.phase }, nextPhase);
    if (!transition.ok) return transition;
    if (state.phase === 'context' && nextPhase === 'prediction') {
        const readiness = evaluateContextReadiness(state.caseDefinition, state.inspectedSourceIds);
        if (readiness.status === 'incomplete') {
            return failure('missing-contextual-sources', `Inspect ${readiness.missingArtifactLabels[0]} before continuing to prediction.`);
        }
    }
    if (state.phase === 'prediction' && nextPhase === 'experiment'
        && evaluatePredictionReadiness(state.caseDefinition, state.prediction).status === 'incomplete') {
        return failure('missing-prediction', 'Record a tentative prediction before continuing to experimentation.');
    }
    return { ok: true, value: freezeState({ ...state, phase: transition.value.phase }) };
};

const reduceTheoryReviewRequest = (state: AppState): Result<AppState> => {
    const readiness = evaluateConclusionReadiness(state.caseDefinition, {
        runs: state.runs,
        inspectedSourceIds: state.inspectedSourceIds
    }, state.theory);
    if (readiness.status === 'incomplete') {
        return failure('conclusion-not-ready', readiness.missing[0].message);
    }
    return reduceCasePhaseAdvance(state, 'review');
};

const reviewEvidence = (state: AppState) => ({ runs: state.runs, inspectedSourceIds: state.inspectedSourceIds });

const reduceConsultationRequest = (state: AppState): Result<AppState> => {
    const consultation = selectConsultation(state.caseDefinition.consultationRules, { ...reviewEvidence(state), theory: state.theory });
    return consultation
        ? { ok: true, value: freezeState({ ...state, consultation }) }
        : failure('consultation-unavailable', 'No additional authored consultation applies to the current evidence.');
};

const reducePeerReviewRequest = (state: AppState): Result<AppState> => {
    if (state.phase !== 'review') {
        return failure('peer-review-unavailable', 'Move the bounded theory draft to review before requesting peer feedback.');
    }
    return { ok: true, value: freezeState({ ...state, peerReview: evaluatePeerReview(state.caseDefinition, reviewEvidence(state), state.theory) }) };
};

const reduceRevisionSave = (state: AppState, timestamp: string): Result<AppState> => {
    if (!state.peerReview || state.peerReview.status !== 'reviewed') return failure('revision-review-required', 'Request available peer feedback before saving a revision.');
    const parsedTimestamp = new Date(timestamp);
    if (Number.isNaN(parsedTimestamp.getTime()) || parsedTimestamp.toISOString() !== timestamp) return failure('invalid-revision-timestamp', 'Provide a valid UTC revision timestamp.');
    const knownRunIds = new Set(state.runs.map(({ id }) => id));
    const knownSourceIds = new Set(state.inspectedSourceIds);
    if (new Set(state.theory.selectedRunIds).size !== state.theory.selectedRunIds.length || !state.theory.selectedRunIds.every((id) => knownRunIds.has(id))) {
        return failure('invalid-revision-runs', 'Revision support must reference unique recorded observations.');
    }
    if (new Set(state.theory.selectedSourceIds).size !== state.theory.selectedSourceIds.length || !state.theory.selectedSourceIds.every((id) => knownSourceIds.has(id))) {
        return failure('invalid-revision-sources', 'Revision support must reference unique inspected sources.');
    }
    const previous = state.decisionHistory[state.decisionHistory.length - 1];
    if (previous && parsedTimestamp.getTime() <= new Date(previous.timestamp).getTime()) {
        return failure('invalid-revision-timestamp', 'Provide a revision timestamp later than the previous saved revision.');
    }
    const entry: DecisionHistoryEntry = {
        version: state.decisionHistory.length + 1,
        priorConclusion: previous?.conclusion ?? '',
        conclusion: state.theory.conclusion,
        limitation: state.theory.limitation,
        selectedRunIds: state.theory.selectedRunIds,
        selectedSourceIds: state.theory.selectedSourceIds,
        feedback: state.peerReview,
        timestamp
    };
    return { ok: true, value: freezeState({ ...state, decisionHistory: [...state.decisionHistory, entry], peerReview: undefined }) };
};

export const reduceAppState = (state: AppState, action: AppAction): Result<AppState> => {
    switch (action.type) {
        case 'apparatus.controlSet':
            return reduceControlSet(state, action);
        case 'run.record':
            return reduceRecordRun(state, action.record);
        case 'comparison.runSelected':
            return reduceSelectRun(state, action.runId);
        case 'comparison.runUnselected':
            return reduceUnselectRun(state, action.runId);
        case 'comparison.noteSaved':
            return reduceSaveComparisonNote(state, action.note);
        case 'source.inspected':
            return reduceSourceInspection(state, action.sourceId);
        case 'prediction.recorded':
            return reducePredictionRecord(state, action.prediction);
        case 'theory.supportRunSelected':
            return reduceTheorySupportRun(state, action.runId, true);
        case 'theory.supportRunUnselected':
            return reduceTheorySupportRun(state, action.runId, false);
        case 'theory.supportSourceSelected':
            return reduceTheorySupportSource(state, action.sourceId, true);
        case 'theory.supportSourceUnselected':
            return reduceTheorySupportSource(state, action.sourceId, false);
        case 'theory.conclusionSet':
            return withTheory(state, { ...state.theory, conclusion: action.conclusion });
        case 'theory.limitationSet':
            return withTheory(state, { ...state.theory, limitation: action.limitation });
        case 'theory.reviewRequested':
            return reduceTheoryReviewRequest(state);
        case 'consultation.requested':
            return reduceConsultationRequest(state);
        case 'peerReview.requested':
            return reducePeerReviewRequest(state);
        case 'revision.saved':
            return reduceRevisionSave(state, action.timestamp);
        case 'case.phaseAdvance':
            return reduceCasePhaseAdvance(state, action.nextPhase);
    }
};
