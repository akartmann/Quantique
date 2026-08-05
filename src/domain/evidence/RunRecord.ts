import type { Result } from '../../core/errors/Result';
import type { PrimaryControl, WavelengthMode } from '../cases/CaseDefinition';

export type RunControls = Readonly<Record<PrimaryControl['id'], number>>;

export type ExperimentResult = Readonly<{
    label: string;
    value: number;
    unit: string;
}>;

export type YoungModelInputs = Readonly<{
    slitSpacingMm: number;
    screenDistanceM: number;
    wavelengthNm: 450 | 550 | 650;
    wavelengthMode: WavelengthMode;
}>;

export type RunRecord = Readonly<{
    id: string;
    caseId: string;
    controls: RunControls;
    modelInputs?: YoungModelInputs;
    result: ExperimentResult;
    timestamp: string;
    experimentModelVersion: string;
    linkedEvidenceIds: readonly string[];
}>;

export type CreateRunRecordInput = Readonly<{
    id: string;
    caseId: string;
    controls: RunControls;
    modelInputs?: YoungModelInputs;
    result: ExperimentResult;
    timestamp: string;
    experimentModelVersion: string;
    linkedEvidenceIds?: readonly string[];
}>;

/** A pure calculation seam supplied by composition until Story 2.2 owns the model. */
export type CalculateExperimentResult = (controls: RunControls) => Result<ExperimentResult>;

export type CreateCalculatedRunRecordInput = Omit<CreateRunRecordInput, 'result'> & Readonly<{
    calculateResult: CalculateExperimentResult;
}>;

const failure = (code: string, message: string): Result<never> => ({
    ok: false,
    error: { code, message }
});

const isNonBlankString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const isIsoTimestamp = (timestamp: unknown): timestamp is string => {
    if (typeof timestamp !== 'string') return false;
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{3})?Z$/.exec(timestamp);
    if (!parts) return false;

    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = parts;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const daysInMonth = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1]
        && hour <= 23 && minute <= 59 && second <= 59;
};

const validateControls = (controls: unknown): Result<RunControls> => {
    if (!controls || typeof controls !== 'object'
        || !Number.isFinite((controls as RunControls).slitSpacingMm)
        || !Number.isFinite((controls as RunControls).screenDistanceM)) {
        return failure('invalid-run-controls', 'A run needs finite snapshots of both apparatus controls.');
    }
    const snapshot = controls as RunControls;

    return {
        ok: true,
        value: Object.freeze({
            slitSpacingMm: snapshot.slitSpacingMm,
            screenDistanceM: snapshot.screenDistanceM
        })
    };
};

const validateResult = (result: unknown): Result<ExperimentResult> => {
    if (!result || typeof result !== 'object'
        || !isNonBlankString((result as ExperimentResult).label)
        || !isNonBlankString((result as ExperimentResult).unit)
        || !Number.isFinite((result as ExperimentResult).value)) {
        return failure('invalid-run-result', 'A run needs a finite, labelled observed result.');
    }
    const snapshot = result as ExperimentResult;

    return { ok: true, value: Object.freeze({ label: snapshot.label, value: snapshot.value, unit: snapshot.unit }) };
};

const validateModelInputs = (modelInputs: unknown): Result<YoungModelInputs | undefined> => {
    if (modelInputs === undefined) return { ok: true, value: undefined };
    if (!modelInputs || typeof modelInputs !== 'object'
        || !Number.isFinite((modelInputs as YoungModelInputs).slitSpacingMm)
        || !Number.isFinite((modelInputs as YoungModelInputs).screenDistanceM)
        || ![450, 550, 650].includes((modelInputs as YoungModelInputs).wavelengthNm)
        || !['minimum', 'advanced'].includes((modelInputs as YoungModelInputs).wavelengthMode)) {
        return failure('invalid-run-model-inputs', 'A physical Young run needs complete, valid model inputs.');
    }
    const inputs = modelInputs as YoungModelInputs;
    if ((inputs.wavelengthMode === 'minimum' && inputs.wavelengthNm !== 550)
        || (inputs.wavelengthMode === 'advanced' && inputs.wavelengthNm === 550)) {
        return failure('invalid-run-model-inputs', 'The selected wavelength mode does not match the recorded wavelength.');
    }
    return { ok: true, value: Object.freeze({
        slitSpacingMm: inputs.slitSpacingMm,
        screenDistanceM: inputs.screenDistanceM,
        wavelengthNm: inputs.wavelengthNm,
        wavelengthMode: inputs.wavelengthMode
    }) };
};

const validateLinkedEvidence = (linkedEvidenceIds: unknown): Result<readonly string[]> => {
    if (!Array.isArray(linkedEvidenceIds)) {
        return failure('invalid-linked-evidence', 'Linked evidence IDs must be unique, non-empty identifiers.');
    }

    if (linkedEvidenceIds.some((id) => !isNonBlankString(id)) || new Set(linkedEvidenceIds).size !== linkedEvidenceIds.length) {
        return failure('invalid-linked-evidence', 'Linked evidence IDs must be unique, non-empty identifiers.');
    }

    return { ok: true, value: Object.freeze([...linkedEvidenceIds]) };
};

export const createRunRecord = (
    input: CreateRunRecordInput,
    existingRunIds: readonly string[] = []
): Result<RunRecord> => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return failure('invalid-run-record', 'A run needs a complete evidence record.');
    }
    if (!isNonBlankString(input.id)) return failure('invalid-run-id', 'A run needs a stable identifier.');
    if (Array.isArray(existingRunIds) && existingRunIds.includes(input.id)) return failure('duplicate-run-id', 'That observation has already been recorded.');
    if (!isNonBlankString(input.caseId)) return failure('invalid-case-id', 'A run needs a case identifier.');
    if (!isIsoTimestamp(input.timestamp)) return failure('invalid-run-timestamp', 'A run needs an ISO timestamp.');
    if (!isNonBlankString(input.experimentModelVersion)) return failure('invalid-experiment-model-version', 'A run needs an experiment model version.');

    const controls = validateControls(input.controls);
    if (!controls.ok) return controls;
    const result = validateResult(input.result);
    if (!result.ok) return result;
    const modelInputs = validateModelInputs(input.modelInputs);
    if (!modelInputs.ok) return modelInputs;
    const linkedEvidence = validateLinkedEvidence(input.linkedEvidenceIds ?? []);
    if (!linkedEvidence.ok) return linkedEvidence;

    return {
        ok: true,
        value: Object.freeze({
            id: input.id,
            caseId: input.caseId,
            controls: controls.value,
            ...(modelInputs.value ? { modelInputs: modelInputs.value } : {}),
            result: result.value,
            timestamp: input.timestamp,
            experimentModelVersion: input.experimentModelVersion,
            linkedEvidenceIds: linkedEvidence.value
        })
    };
};

export const createCalculatedRunRecord = (
    input: CreateCalculatedRunRecordInput,
    existingRunIds: readonly string[] = []
): Result<RunRecord> => {
    const calculated = input.calculateResult(input.controls);
    if (!calculated.ok) return calculated;

    return createRunRecord({
        id: input.id,
        caseId: input.caseId,
        controls: input.controls,
        modelInputs: input.modelInputs,
        result: calculated.value,
        timestamp: input.timestamp,
        experimentModelVersion: input.experimentModelVersion,
        linkedEvidenceIds: input.linkedEvidenceIds
    }, existingRunIds);
};
