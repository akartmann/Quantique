import type { Result } from '../errors/Result';
import { DEFAULT_LOCALE, type Locale } from '../i18n/Locale';
import { normalizeControlValue } from '../../domain/apparatus/ApparatusControl';
import { calculateYoungFringeSpacing } from '../../domain/apparatus/calculateYoungFringeSpacing';
import { isSourceEligibleForInspection, type CaseDefinition, type PrimaryControl, type WavelengthMode } from '../../domain/cases/CaseDefinition';
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
    /**
     * Which colleague's conclusion this revision adopted, when the player chose one rather than
     * writing their own. Provenance has to live here: `case.replayStarted` clears
     * `selectedConclusionProposalId`, so without it a completed investigation kept a colleague's
     * verbatim claim with nothing recording who said it, and the debrief and print view presented
     * their words as the player's own. Absent means hand-written, which is the pre-1.11 default.
     */
    conclusionProposalId?: string;
    selectedRunIds: readonly string[];
    selectedSourceIds: readonly string[];
    feedback: PeerReviewProjection;
    timestamp: string;
}>;

export type CompletionSnapshot = Readonly<{
    completedAt: string;
    finalDecision: DecisionHistoryEntry;
    decisionHistory: readonly DecisionHistoryEntry[];
    runs: readonly RunRecord[];
    inspectedSourceIds: readonly string[];
    comparison: ComparisonState;
    recognition: RecognitionState;
}>;

export type ReplayState = Readonly<{ isCounterfactual: boolean }>;

export type AppState = Readonly<{
    caseDefinition: CaseDefinition;
    /**
     * The active interface language, resolved once from the browser at boot. Deliberately absent
     * from `CaseRecord`: it describes the device, not the investigation.
     */
    locale: Locale;
    phase: CasePhase;
    activeControlValues: Readonly<Record<PrimaryControl['id'], number>>;
    selectedWavelengthNm: 450 | 550 | 650;
    selectedWavelengthMode: WavelengthMode;
    inspectedSourceIds: readonly string[];
    prediction: string;
    /**
     * The attributed proposal the player chose, when the prediction came from the colleague cast
     * rather than the free-text panel (Story 1.11). Absent means hand-written, and the two are kept
     * mutually exclusive: whichever path writes `prediction` owns it. The same holds for
     * `selectedConclusionProposalId` against `theory.conclusion` / `theory.limitation`.
     */
    selectedPredictionProposalId?: string;
    runs: readonly RunRecord[];
    comparison: ComparisonState;
    theory: TheoryBoardDraft;
    selectedConclusionProposalId?: string;
    consultation?: ConsultationProjection;
    peerReview?: PeerReviewProjection;
    decisionHistory: readonly DecisionHistoryEntry[];
    completion?: CompletionSnapshot;
    replay: ReplayState;
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

const freezeDecision = (entry: DecisionHistoryEntry): DecisionHistoryEntry => Object.freeze({
    ...entry,
    selectedRunIds: Object.freeze([...entry.selectedRunIds]),
    selectedSourceIds: Object.freeze([...entry.selectedSourceIds]),
    feedback: freezePeerReview(entry.feedback)
});

const freezeRun = (run: RunRecord): RunRecord => Object.freeze({
    id: run.id,
    caseId: run.caseId,
    controls: Object.freeze({ ...run.controls }),
    ...(run.modelInputs ? { modelInputs: Object.freeze({ ...run.modelInputs }) } : {}),
    result: Object.freeze({ ...run.result }),
    timestamp: run.timestamp,
    experimentModelVersion: run.experimentModelVersion,
    linkedEvidenceIds: Object.freeze([...run.linkedEvidenceIds])
});

const freezeCompletion = (completion: CompletionSnapshot | undefined): CompletionSnapshot | undefined => completion && Object.freeze({
    completedAt: completion.completedAt,
    finalDecision: freezeDecision(completion.finalDecision),
    decisionHistory: Object.freeze(completion.decisionHistory.map(freezeDecision)),
    runs: Object.freeze(completion.runs.map(freezeRun)),
    inspectedSourceIds: Object.freeze([...completion.inspectedSourceIds]),
    comparison: freezeComparison(completion.comparison),
    recognition: Object.freeze({
        version: completion.recognition.version,
        items: Object.freeze(completion.recognition.items.map((item) => Object.freeze({ ...item })))
    })
});

const freezeState = (state: Omit<AppState, 'recognition'>): AppState => Object.freeze({
    ...state,
    locale: state.locale,
    activeControlValues: Object.freeze({ ...state.activeControlValues }),
    selectedWavelengthNm: state.selectedWavelengthNm,
    selectedWavelengthMode: state.selectedWavelengthMode,
    inspectedSourceIds: Object.freeze([...state.inspectedSourceIds]),
    selectedPredictionProposalId: state.selectedPredictionProposalId,
    selectedConclusionProposalId: state.selectedConclusionProposalId,
    runs: Object.freeze(state.runs.map(freezeRun)),
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
    decisionHistory: Object.freeze(state.decisionHistory.map(freezeDecision)),
    completion: freezeCompletion(state.completion),
    replay: Object.freeze({ isCounterfactual: state.replay.isCounterfactual }),
    recognition: deriveRecognition(state.caseDefinition, state)
});

export const createInitialAppState = (caseDefinition: CaseDefinition, locale: Locale = DEFAULT_LOCALE): AppState => freezeState({
    caseDefinition,
    locale,
    phase: 'context',
    activeControlValues: Object.fromEntries(
        caseDefinition.apparatus.primaryControls.map((control) => [control.id, control.defaultValue])
    ) as Record<PrimaryControl['id'], number>,
    selectedWavelengthNm: 550,
    selectedWavelengthMode: 'minimum',
    inspectedSourceIds: [],
    prediction: '',
    runs: [],
    comparison: { selectedRunIds: [], notes: [] },
    theory: createTheoryBoardDraft(),
    decisionHistory: [],
    replay: { isCounterfactual: false }
});

/**
 * Creates the sole authoritative state from a validated, definition-compatible portable record.
 *
 * `locale` comes from the live session, never from the record: importing an investigation exported
 * by a French player must not switch an English player's interface language.
 */
export const createAppStateFromCaseRecord = (record: CaseRecord, caseDefinition: CaseDefinition, locale: Locale = DEFAULT_LOCALE): Result<AppState> => {
    const compatible = validateCaseRecordForDefinition(record, caseDefinition);
    if (!compatible.ok) return compatible;
    // The *validated* record from here on, never the argument: validation sanitizes a proposal ID
    // whose authored text has since been edited, and reading `record` again would put the stale ID
    // straight back into state and then back into the next save.
    const validated = compatible.value;

    const runs: RunRecord[] = [];
    for (const recordRun of validated.runs) {
        const snapshot = createRunRecord(recordRun, runs.map(({ id }) => id));
        if (!snapshot.ok) return { ok: false, error: snapshot.error };
        runs.push(snapshot.value);
    }

    return {
        ok: true,
        value: freezeState({
            caseDefinition,
            locale,
            phase: validated.phase,
            activeControlValues: validated.activeControlValues,
            selectedWavelengthNm: validated.selectedWavelengthNm ?? 550,
            selectedWavelengthMode: validated.selectedWavelengthMode ?? 'minimum',
            inspectedSourceIds: validated.inspectedSourceIds,
            prediction: validated.prediction,
            selectedPredictionProposalId: validated.selectedPredictionProposalId,
            runs,
            comparison: validated.comparison,
            theory: validated.theory,
            selectedConclusionProposalId: validated.selectedConclusionProposalId,
            decisionHistory: validated.decisionHistory,
            completion: validated.completion as CompletionSnapshot | undefined,
            replay: validated.replay
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
    if (state.phase !== 'experiment') {
        return failure('experiment-phase-required', 'Enter the experiment phase before running the apparatus.');
    }
    const validated = createRunRecord(record, state.runs.map(({ id }) => id));
    if (!validated.ok) return validated;
    if (validated.value.caseId !== state.caseDefinition.id) {
        return failure('run-case-mismatch', 'That observation belongs to a different investigation.');
    }
    if (validated.value.modelInputs) {
        if (validated.value.experimentModelVersion !== state.caseDefinition.experiment.modelVersion
            || validated.value.controls.slitSpacingMm !== state.activeControlValues.slitSpacingMm
            || validated.value.controls.screenDistanceM !== state.activeControlValues.screenDistanceM
            || validated.value.modelInputs.slitSpacingMm !== state.activeControlValues.slitSpacingMm
            || validated.value.modelInputs.screenDistanceM !== state.activeControlValues.screenDistanceM
            || validated.value.modelInputs.wavelengthNm !== state.selectedWavelengthNm
            || validated.value.modelInputs.wavelengthMode !== state.selectedWavelengthMode) {
            return failure('mismatched-experiment-record', 'The observation does not match the current validated experiment setup.');
        }
        const calculated = calculateYoungFringeSpacing(validated.value.modelInputs);
        if (!calculated.ok || calculated.value.label !== validated.value.result.label
            || calculated.value.value !== validated.value.result.value
            || calculated.value.unit !== validated.value.result.unit) {
            return failure('mismatched-experiment-record', 'The observation does not match the deterministic Young model.');
        }
    }
    if (!validated.value.linkedEvidenceIds.every((sourceId) => state.inspectedSourceIds.includes(sourceId))) {
        return failure('uninspected-linked-evidence', 'Linked evidence must be inspected before recording an observation.');
    }

    return { ok: true, value: freezeState({ ...state, runs: [...state.runs, validated.value], consultation: undefined, peerReview: undefined }) };
};

const minimumPathRunCount = (state: AppState): number => state.runs.filter((run) =>
    run.modelInputs?.wavelengthMode === 'minimum' && run.modelInputs.wavelengthNm === 550
).length;

const reduceWavelengthSet = (state: AppState, wavelengthNm: 450 | 550 | 650): Result<AppState> => {
    if (wavelengthNm === 550) {
        return { ok: true, value: freezeState({ ...state, selectedWavelengthNm: 550, selectedWavelengthMode: 'minimum', consultation: undefined, peerReview: undefined }) };
    }
    const choices: readonly number[] = state.caseDefinition.experiment.wavelengthComparison?.advancedChoicesNm ?? [];
    if (!choices.includes(wavelengthNm)) {
        return failure('unavailable-wavelength', 'That authored wavelength comparison is unavailable.');
    }
    if (minimumPathRunCount(state) < state.caseDefinition.requirements.minimumRuns) {
        return failure('advanced-wavelength-locked', 'Record two fixed 550 nm observations before using the optional wavelength comparison.');
    }
    return { ok: true, value: freezeState({
        ...state,
        selectedWavelengthNm: wavelengthNm,
        selectedWavelengthMode: 'advanced',
        consultation: undefined,
        peerReview: undefined
    }) };
};

const reduceApparatusReset = (state: AppState): Result<AppState> => ({
    ok: true,
    value: freezeState({
        ...state,
        activeControlValues: Object.fromEntries(state.caseDefinition.apparatus.primaryControls.map((control) => [control.id, control.defaultValue])) as Record<PrimaryControl['id'], number>,
        selectedWavelengthNm: 550,
        selectedWavelengthMode: 'minimum'
    })
});

const reduceExperimentRun = (state: AppState, action: Extract<AppAction, { type: 'experiment.run' }>): Result<AppState> => {
    if (state.phase !== 'experiment') {
        return failure('experiment-phase-required', 'Enter the experiment phase before running the apparatus.');
    }
    const advancedChoices: readonly number[] = state.caseDefinition.experiment.wavelengthComparison?.advancedChoicesNm ?? [];
    if ((state.selectedWavelengthMode === 'minimum' && state.selectedWavelengthNm !== 550)
        || (state.selectedWavelengthMode === 'advanced'
            && (!advancedChoices.includes(state.selectedWavelengthNm as 450 | 650)
                || minimumPathRunCount(state) < state.caseDefinition.requirements.minimumRuns))) {
        return failure('advanced-wavelength-locked', 'Record two fixed 550 nm observations before using the optional wavelength comparison.');
    }
    const result = calculateYoungFringeSpacing({
        slitSpacingMm: state.activeControlValues.slitSpacingMm,
        screenDistanceM: state.activeControlValues.screenDistanceM,
        wavelengthNm: state.selectedWavelengthNm
    });
    if (!result.ok) return result;
    const record = createRunRecord({
        id: action.id,
        caseId: state.caseDefinition.id,
        controls: state.activeControlValues,
        modelInputs: {
            slitSpacingMm: state.activeControlValues.slitSpacingMm,
            screenDistanceM: state.activeControlValues.screenDistanceM,
            wavelengthNm: state.selectedWavelengthNm,
            wavelengthMode: state.selectedWavelengthMode
        },
        result: result.value,
        timestamp: action.timestamp,
        experimentModelVersion: state.caseDefinition.experiment.modelVersion,
        linkedEvidenceIds: state.inspectedSourceIds
    }, state.runs.map(({ id }) => id));
    if (!record.ok) return record;
    return reduceRecordRun(state, record.value);
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
    const readiness = evaluateContextReadiness(state.caseDefinition, state.inspectedSourceIds);
    if (readiness.status === 'incomplete') {
        return failure('missing-contextual-sources', `Inspect ${readiness.missingArtifactLabels[0]} before recording a prediction.`);
    }
    const normalized = prediction.trim();
    if (!normalized) return failure('invalid-prediction', 'Enter a tentative prediction before recording it.');
    // The attribution survives exactly as long as it stays true. Editing a proposal's words drops it
    // — otherwise the record would claim a colleague wrote text they did not, and the consistency
    // check would reject it on load. Re-recording them *unchanged* keeps it: the DOM panel offers the
    // chosen proposal's canonical text straight back in the textarea, so clearing unconditionally let
    // "Record a prediction" silently un-choose a proposal without changing a single byte.
    // Short-circuits on the ID: with nothing chosen there is no attribution to preserve, and the
    // authored sets need never be consulted.
    const chosen = state.selectedPredictionProposalId === undefined
        ? undefined
        : state.caseDefinition.predictionProposals.find(({ id }) => id === state.selectedPredictionProposalId);
    return {
        ok: true,
        value: freezeState({
            ...state,
            prediction: normalized,
            selectedPredictionProposalId: chosen?.text.en === normalized ? state.selectedPredictionProposalId : undefined,
            consultation: undefined,
            peerReview: undefined
        })
    };
};

/**
 * The chosen proposal's canonical `.en` text becomes `prediction`, because that field is what every
 * phase gate, saved record, and printed page already reads — `evaluatePredictionReadiness`,
 * `DecisionHistoryEntry`, and `validateCaseRecordForDefinition` among them. Writing the *active*
 * locale here would make a French player's saved record fail revalidation in English.
 *
 * The context gate is the same one `reducePredictionRecord` applies: the choice is a prediction by
 * another route, not a way around the sources.
 */
const reducePredictionProposalChosen = (state: AppState, proposalId: string): Result<AppState> => {
    const proposal = state.caseDefinition.predictionProposals.find(({ id }) => id === proposalId);
    if (!proposal) return failure('unknown-prediction-proposal', 'That prediction is not one of the proposals on offer.');
    const readiness = evaluateContextReadiness(state.caseDefinition, state.inspectedSourceIds);
    if (readiness.status === 'incomplete') {
        return failure('missing-contextual-sources', `Inspect ${readiness.missingArtifactLabels[0]} before recording a prediction.`);
    }
    // No "already chosen" failure: AC2 makes the choice revisable, and re-choosing the same
    // proposal has to stay a no-op success rather than an error the surface must explain away.
    return {
        ok: true,
        value: freezeState({
            ...state,
            prediction: proposal.text.en,
            selectedPredictionProposalId: proposal.id,
            consultation: undefined,
            peerReview: undefined
        })
    };
};

const withTheory = (state: AppState, theory: TheoryBoardDraft): Result<AppState> => ({
    ok: true,
    value: freezeState({ ...state, theory, consultation: undefined, peerReview: undefined })
});

/**
 * The free-text counterpart of {@link reducePredictionRecord}'s clearing rule, for the conclusion —
 * and, the same way, it only clears when the text has actually stopped matching the chosen proposal.
 * Typing a character into the textarea and deleting it again must not cost the attribution.
 */
const withHandWrittenTheory = (state: AppState, theory: TheoryBoardDraft): Result<AppState> => {
    const chosen = state.selectedConclusionProposalId === undefined
        ? undefined
        : state.caseDefinition.conclusionProposals.find(({ id }) => id === state.selectedConclusionProposalId);
    const keepsAttribution = chosen !== undefined
        && chosen.claim.en === theory.conclusion
        && chosen.limitation.en === theory.limitation;
    return {
        ok: true,
        value: freezeState({
            ...state,
            theory,
            selectedConclusionProposalId: keepsAttribution ? state.selectedConclusionProposalId : undefined,
            consultation: undefined,
            peerReview: undefined
        })
    };
};

/**
 * Records the choice, and only the choice. It deliberately does not advance the phase, evaluate
 * defensibility, or block on it: the evidence gate is Story 2.3/2.6 and the critique is Story 2.5.
 */
const reduceTheoryConclusionProposalChosen = (state: AppState, proposalId: string): Result<AppState> => {
    const proposal = state.caseDefinition.conclusionProposals.find(({ id }) => id === proposalId);
    if (!proposal) return failure('unknown-conclusion-proposal', 'That conclusion is not one of the proposals on offer.');
    // The store decides when a conclusion can be chosen, not whichever scene happens to be mounted.
    // `synthesis` and `review` are the two phases the theory board hosts. This checks the phase and
    // nothing else: the *evidence* gate stays with Stories 2.3/2.6, exactly as the story directs.
    if (state.phase !== 'synthesis' && state.phase !== 'review') {
        return failure('conclusion-phase-unavailable', 'Reach the theory board before choosing a conclusion.');
    }
    return {
        ok: true,
        value: freezeState({
            ...state,
            theory: { ...state.theory, conclusion: proposal.claim.en, limitation: proposal.limitation.en },
            selectedConclusionProposalId: proposal.id,
            consultation: undefined,
            peerReview: undefined
        })
    };
};

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
    if (state.phase === 'review' && nextPhase === 'debrief') {
        return failure('debrief-completion-required', 'Open the historical debrief only through the reviewed completion action.');
    }
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
        inspectedSourceIds: state.inspectedSourceIds,
        comparisonNotes: state.comparison.notes
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
        // Captured at save time, because the live selection does not survive a counterfactual replay.
        conclusionProposalId: state.selectedConclusionProposalId,
        selectedRunIds: state.theory.selectedRunIds,
        selectedSourceIds: state.theory.selectedSourceIds,
        feedback: state.peerReview,
        timestamp
    };
    return { ok: true, value: freezeState({ ...state, decisionHistory: [...state.decisionHistory, entry], peerReview: undefined }) };
};

const isTimestamp = (value: string): boolean => {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const reduceDebriefComplete = (state: AppState, timestamp: string): Result<AppState> => {
    if (state.phase !== 'review') return failure('debrief-review-required', 'Save a reviewed revision before opening the historical debrief.');
    if (!isTimestamp(timestamp)) return failure('invalid-completion-timestamp', 'Provide a valid UTC completion timestamp.');
    const readiness = evaluateConclusionReadiness(state.caseDefinition, { ...reviewEvidence(state), comparisonNotes: state.comparison.notes }, state.theory);
    if (readiness.status !== 'ready') return failure('conclusion-not-ready', readiness.missing[0].message);
    const finalDecision = state.decisionHistory[state.decisionHistory.length - 1];
    if (!finalDecision || finalDecision.conclusion !== state.theory.conclusion || finalDecision.limitation !== state.theory.limitation
        || JSON.stringify(finalDecision.selectedRunIds) !== JSON.stringify(state.theory.selectedRunIds)
        || JSON.stringify(finalDecision.selectedSourceIds) !== JSON.stringify(state.theory.selectedSourceIds)) {
        return failure('reviewed-revision-required', 'Save the reviewed revision before opening the historical debrief.');
    }
    if (new Date(timestamp).getTime() < new Date(finalDecision.timestamp).getTime()) {
        return failure('invalid-completion-timestamp', 'Provide a completion timestamp no earlier than the saved reviewed revision.');
    }
    const transition = advanceCasePhase({ definition: state.caseDefinition, phase: state.phase }, 'debrief');
    if (!transition.ok) return transition;
    const completion: CompletionSnapshot = state.replay.isCounterfactual && state.completion ? state.completion : {
        completedAt: timestamp,
        finalDecision,
        decisionHistory: state.decisionHistory,
        runs: state.runs,
        inspectedSourceIds: state.inspectedSourceIds,
        comparison: state.comparison,
        recognition: state.recognition
    };
    return { ok: true, value: freezeState({ ...state, phase: transition.value.phase, completion, replay: { isCounterfactual: state.replay.isCounterfactual } }) };
};

const reduceReplayStart = (state: AppState): Result<AppState> => {
    if (state.phase !== 'debrief' || !state.completion) return failure('replay-unavailable', 'Complete the historical debrief before starting a counterfactual replay.');
    return {
        ok: true,
        value: freezeState({
            // `locale` is intentionally not reset by the spread below: a replay clears case
            // progress, and the interface language describes the device rather than progress.
            ...state,
            phase: 'context',
            activeControlValues: Object.fromEntries(state.caseDefinition.apparatus.primaryControls.map((control) => [control.id, control.defaultValue])) as Record<PrimaryControl['id'], number>,
            selectedWavelengthNm: 550,
            selectedWavelengthMode: 'minimum',
            inspectedSourceIds: [], prediction: '', runs: [], comparison: { selectedRunIds: [], notes: [] }, theory: createTheoryBoardDraft(),
            selectedPredictionProposalId: undefined, selectedConclusionProposalId: undefined,
            consultation: undefined, peerReview: undefined, decisionHistory: [], replay: { isCounterfactual: true }
        })
    };
};

export const reduceAppState = (state: AppState, action: AppAction): Result<AppState> => {
    switch (action.type) {
        case 'apparatus.controlSet':
            return reduceControlSet(state, action);
        case 'run.record':
            return reduceRecordRun(state, action.record);
        case 'experiment.run':
            return reduceExperimentRun(state, action);
        case 'apparatus.wavelengthSet':
            return reduceWavelengthSet(state, action.wavelengthNm);
        case 'apparatus.reset':
            return reduceApparatusReset(state);
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
        case 'prediction.proposalChosen':
            return reducePredictionProposalChosen(state, action.proposalId);
        case 'theory.supportRunSelected':
            return reduceTheorySupportRun(state, action.runId, true);
        case 'theory.supportRunUnselected':
            return reduceTheorySupportRun(state, action.runId, false);
        case 'theory.supportSourceSelected':
            return reduceTheorySupportSource(state, action.sourceId, true);
        case 'theory.supportSourceUnselected':
            return reduceTheorySupportSource(state, action.sourceId, false);
        case 'theory.conclusionSet':
            return withHandWrittenTheory(state, { ...state.theory, conclusion: action.conclusion });
        case 'theory.limitationSet':
            return withHandWrittenTheory(state, { ...state.theory, limitation: action.limitation });
        case 'theory.conclusionProposalChosen':
            return reduceTheoryConclusionProposalChosen(state, action.proposalId);
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
        case 'case.debriefCompleted':
            return reduceDebriefComplete(state, action.timestamp);
        case 'case.replayStarted':
            return reduceReplayStart(state);
    }
};
