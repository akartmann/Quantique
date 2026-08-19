import type { Result } from '../../core/errors/Result';
import type { PrimaryControl, WavelengthMode } from '../cases/CaseDefinition';

/**
 * A run's snapshot of the apparatus, keyed by authored control ID (Story 3.1). Which keys are required
 * is a claim about the *case*, so `createRunRecord` takes the authored control set and checks the
 * snapshot against it rather than against Young's two names.
 */
export type RunControls = Readonly<Record<PrimaryControl['id'], number>>;

/**
 * The authored control set a run is validated against.
 *
 * An object rather than a bare `readonly string[]` on purpose: `createRunRecord`'s other array
 * parameter is `existingRunIds`, and two adjacent `string[]` parameters are two parameters the compiler
 * cannot tell apart. Passing them the wrong way round would have made every run "valid" against a list
 * of run IDs, silently — so the shape is what makes the argument order a `tsc` error.
 */
export type RunControlContract = Readonly<{ controlIds: readonly string[] }>;

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

/** The control set of a loaded case, in the shape `createRunRecord` wants it. */
export const runControlContract = (definition: Readonly<{ apparatus: Readonly<{ primaryControls: readonly Readonly<{ id: string }>[] }> }>): RunControlContract =>
    ({ controlIds: definition.apparatus.primaryControls.map(({ id }) => id) });

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

/**
 * A run must snapshot **exactly** the controls its case authors: every authored control present and
 * finite, and nothing else.
 *
 * Before Story 3.1 this hard-coded Young's two names and rebuilt the snapshot from them, so a third
 * authored control would have been dropped from the persisted run record without a word — the run would
 * have claimed a configuration it was not taken at, and `countSignificantMeasures` would have counted
 * two different arrangements as one.
 *
 * The rejection of *extra* keys is the other half, and the reason the ids arrive by parameter rather
 * than this function accepting "any finite-valued keys" (D3): a typo'd control ID would otherwise pass
 * validation, persist, and then read as `undefined` at every consumer that looks it up by authored name.
 */
const validateControls = (controls: unknown, contract: RunControlContract): Result<RunControls> => {
    if (!controls || typeof controls !== 'object' || Array.isArray(controls)) {
        return failure('invalid-run-controls', 'A run needs finite snapshots of every apparatus control.');
    }
    const candidate = controls as Readonly<Record<string, unknown>>;
    if (contract.controlIds.some((controlId) => !Number.isFinite(candidate[controlId]))) {
        return failure('invalid-run-controls', 'A run needs finite snapshots of every apparatus control.');
    }
    if (Object.keys(candidate).some((key) => !contract.controlIds.includes(key))) {
        return failure('invalid-run-controls', 'A run may only snapshot the controls this case authors.');
    }

    // Rebuilt from the authored ids, not spread from the input: the snapshot is the *case's* control set
    // in the case's own order, so two runs of the same configuration serialise identically.
    return {
        ok: true,
        value: Object.freeze(Object.fromEntries(
            contract.controlIds.map((controlId) => [controlId, candidate[controlId] as number])
        ))
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
    contract: RunControlContract,
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

    const controls = validateControls(input.controls, contract);
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
    contract: RunControlContract,
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
    }, contract, existingRunIds);
};
