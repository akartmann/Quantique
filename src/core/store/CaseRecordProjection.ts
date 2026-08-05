import type { Result } from '../errors/Result';
import { CaseRecordSchema, type CaseRecord } from '../../schemas/CaseRecordSchema';
import type { AppState } from './AppState';

/** Projects only portable player progress; immutable case content and transient UI projections are omitted. */
export const createCaseRecordProjection = (state: AppState): Result<CaseRecord> => {
    const parsed = CaseRecordSchema.safeParse({
        schemaVersion: 2,
        caseId: state.caseDefinition.id,
        caseDefinitionVersion: state.caseDefinition.version,
        phase: state.phase,
        activeControlValues: state.activeControlValues,
        selectedWavelengthNm: state.selectedWavelengthNm,
        selectedWavelengthMode: state.selectedWavelengthMode,
        inspectedSourceIds: state.inspectedSourceIds,
        prediction: state.prediction,
        runs: state.runs,
        comparison: state.comparison,
        theory: state.theory,
        decisionHistory: state.decisionHistory,
        recognition: state.recognition
    });
    return parsed.success
        ? { ok: true, value: parsed.data }
        : { ok: false, error: { code: 'invalid-case-record', message: 'Progress could not be saved right now. Your current work is unchanged.' } };
};
