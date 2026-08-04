import type { Result } from '../../core/errors/Result';
import type { PrimaryControl } from '../cases/CaseDefinition';

export type RunControls = Readonly<Record<PrimaryControl['id'], number>>;

export type ExperimentResult = Readonly<{
    label: string;
    value: number;
    unit: string;
}>;

export type RunRecord = Readonly<{
    id: string;
    caseId: string;
    controls: RunControls;
    result: ExperimentResult;
    timestamp: string;
    experimentModelVersion: string;
    linkedEvidenceIds: readonly string[];
}>;

export type CreateRunRecordInput = Readonly<{
    id: string;
    caseId: string;
    controls: RunControls;
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

const isNonBlankString = (value: string): boolean => value.trim().length > 0;

const isIsoTimestamp = (timestamp: string): boolean => {
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

const validateControls = (controls: RunControls): Result<RunControls> => {
    if (!controls || !Number.isFinite(controls.slitSpacingMm) || !Number.isFinite(controls.screenDistanceM)) {
        return failure('invalid-run-controls', 'A run needs finite snapshots of both apparatus controls.');
    }

    return {
        ok: true,
        value: Object.freeze({
            slitSpacingMm: controls.slitSpacingMm,
            screenDistanceM: controls.screenDistanceM
        })
    };
};

const validateResult = (result: ExperimentResult): Result<ExperimentResult> => {
    if (!result || !isNonBlankString(result.label) || !isNonBlankString(result.unit) || !Number.isFinite(result.value)) {
        return failure('invalid-run-result', 'A run needs a finite, labelled observed result.');
    }

    return { ok: true, value: Object.freeze({ label: result.label, value: result.value, unit: result.unit }) };
};

const validateLinkedEvidence = (linkedEvidenceIds: readonly string[]): Result<readonly string[]> => {
    if (linkedEvidenceIds.some((id) => !isNonBlankString(id)) || new Set(linkedEvidenceIds).size !== linkedEvidenceIds.length) {
        return failure('invalid-linked-evidence', 'Linked evidence IDs must be unique, non-empty identifiers.');
    }

    return { ok: true, value: Object.freeze([...linkedEvidenceIds]) };
};

export const createRunRecord = (
    input: CreateRunRecordInput,
    existingRunIds: readonly string[] = []
): Result<RunRecord> => {
    if (!isNonBlankString(input.id)) return failure('invalid-run-id', 'A run needs a stable identifier.');
    if (existingRunIds.includes(input.id)) return failure('duplicate-run-id', 'That observation has already been recorded.');
    if (!isNonBlankString(input.caseId)) return failure('invalid-case-id', 'A run needs a case identifier.');
    if (!isIsoTimestamp(input.timestamp)) return failure('invalid-run-timestamp', 'A run needs an ISO timestamp.');
    if (!isNonBlankString(input.experimentModelVersion)) return failure('invalid-experiment-model-version', 'A run needs an experiment model version.');

    const controls = validateControls(input.controls);
    if (!controls.ok) return controls;
    const result = validateResult(input.result);
    if (!result.ok) return result;
    const linkedEvidence = validateLinkedEvidence(input.linkedEvidenceIds ?? []);
    if (!linkedEvidence.ok) return linkedEvidence;

    return {
        ok: true,
        value: Object.freeze({
            id: input.id,
            caseId: input.caseId,
            controls: controls.value,
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
        result: calculated.value,
        timestamp: input.timestamp,
        experimentModelVersion: input.experimentModelVersion,
        linkedEvidenceIds: input.linkedEvidenceIds
    }, existingRunIds);
};
