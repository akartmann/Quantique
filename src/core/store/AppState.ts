import type { Result } from '../errors/Result';
import { normalizeControlValue } from '../../domain/apparatus/ApparatusControl';
import type { CaseDefinition, PrimaryControl } from '../../domain/cases/CaseDefinition';
import { createRunRecord, type RunRecord } from '../../domain/evidence/RunRecord';
import type { AppAction } from './AppAction';

export type ComparisonNote = Readonly<{
    runIds: readonly [string, string];
    text: string;
}>;

export type ComparisonState = Readonly<{
    selectedRunIds: readonly string[];
    notes: readonly ComparisonNote[];
}>;

export type AppState = Readonly<{
    caseDefinition: CaseDefinition;
    activeControlValues: Readonly<Record<PrimaryControl['id'], number>>;
    runs: readonly RunRecord[];
    comparison: ComparisonState;
}>;

const freezeComparison = (comparison: ComparisonState): ComparisonState => Object.freeze({
    selectedRunIds: Object.freeze([...comparison.selectedRunIds]),
    notes: Object.freeze(comparison.notes.map((note) => Object.freeze({
        runIds: Object.freeze([note.runIds[0], note.runIds[1]]) as readonly [string, string],
        text: note.text
    })))
});

const freezeState = (state: AppState): AppState => Object.freeze({
    ...state,
    activeControlValues: Object.freeze({ ...state.activeControlValues }),
    runs: Object.freeze([...state.runs]),
    comparison: freezeComparison(state.comparison)
});

export const createInitialAppState = (caseDefinition: CaseDefinition): AppState => freezeState({
    caseDefinition,
    activeControlValues: Object.fromEntries(
        caseDefinition.apparatus.primaryControls.map((control) => [control.id, control.defaultValue])
    ) as Record<PrimaryControl['id'], number>,
    runs: [],
    comparison: { selectedRunIds: [], notes: [] }
});

const failure = (code: string, message: string): Result<never> => ({ ok: false, error: { code, message } });

const pairKey = (runIds: readonly [string, string]): string => [...runIds].sort().join('::');

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

    return { ok: true, value: freezeState({ ...state, runs: [...state.runs, validated.value] }) };
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
    }
};
