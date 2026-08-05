import { z } from 'zod';

import type { Result } from '../core/errors/Result';
import { normalizeControlValue } from '../domain/apparatus/ApparatusControl';
import { isSourceEligibleForInspection, type CaseDefinition } from '../domain/cases/CaseDefinition';
import { createRunRecord } from '../domain/evidence/RunRecord';
import { evaluateConclusionReadiness } from '../domain/theory/conclusionReadiness';
import { evaluatePeerReview } from '../domain/review/peerReviewRules';
import { deriveRecognition, RECOGNITION_IDS, recognitionDefinitions } from '../domain/recognition/recognitionRules';
import { migrateCaseRecord } from './migrations/migrateCaseRecord';
import { evaluateContextReadiness, evaluatePredictionReadiness } from '../domain/cases/contextPredictionReadiness';

const text = z.string().trim().min(1);
const timestamp = z.string().refine((value) => {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}, 'Expected an ISO UTC timestamp.');
const unique = <T>(values: readonly T[]): boolean => new Set(values).size === values.length;

const RunRecordSchema = z.object({
    id: text,
    caseId: text,
    controls: z.object({ slitSpacingMm: z.number().finite(), screenDistanceM: z.number().finite() }).strict(),
    result: z.object({ label: text, value: z.number().finite(), unit: text }).strict(),
    timestamp,
    experimentModelVersion: text,
    linkedEvidenceIds: z.array(text)
}).strict();

const PeerReviewSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('unavailable'), message: text }).strict(),
    z.object({
        status: z.literal('reviewed'),
        issues: z.array(z.object({
            code: z.enum(['missing-evidence', 'unsupported-support', 'overreach']),
            ruleId: text,
            feedback: text,
            revisionPath: text
        }).strict())
    }).strict()
]);

const recognitionDefinitionById = new Map(recognitionDefinitions().map((item) => [item.id, item]));
const RecognitionItemSchema = z.object({
    id: z.enum(RECOGNITION_IDS),
    label: text,
    description: text,
    achieved: z.boolean()
}).strict();

const CurrentRecognitionSchema = z.object({
    version: z.literal(1),
    items: z.array(RecognitionItemSchema).length(RECOGNITION_IDS.length)
}).strict().superRefine((recognition, context) => {
    const ids = recognition.items.map(({ id }) => id);
    if (new Set(ids).size !== ids.length || RECOGNITION_IDS.some((id) => !ids.includes(id))) {
        context.addIssue({ code: 'custom', message: 'Recognition items must include each stable recognition ID once.' });
        return;
    }
    recognition.items.forEach((item) => {
        const expected = recognitionDefinitionById.get(item.id);
        if (!expected || item.label !== expected.label || item.description !== expected.description) {
            context.addIssue({ code: 'custom', message: 'Recognition labels and descriptions must match the authored contract.' });
        }
    });
});

/** Legacy marker is emitted only by explicit migration and is canonicalized on the next projection. */
const RecognitionSchema = z.discriminatedUnion('version', [
    z.object({ version: z.literal(0), items: z.tuple([]) }).strict(),
    CurrentRecognitionSchema
]);

export const CaseRecordSchema = z.object({
    schemaVersion: z.literal(2),
    caseId: z.literal('young-interference'),
    caseDefinitionVersion: text,
    phase: z.enum(['context', 'prediction', 'experiment', 'synthesis', 'review', 'debrief']),
    activeControlValues: z.object({ slitSpacingMm: z.number().finite(), screenDistanceM: z.number().finite() }).strict(),
    inspectedSourceIds: z.array(text),
    prediction: z.string().refine((value) => value === value.trim(), 'Prediction must be trimmed.'),
    runs: z.array(RunRecordSchema),
    comparison: z.object({
        selectedRunIds: z.array(text).max(2),
        notes: z.array(z.object({ runIds: z.tuple([text, text]), text }).strict())
    }).strict(),
    theory: z.object({ selectedRunIds: z.array(text), selectedSourceIds: z.array(text), conclusion: z.string(), limitation: z.string() }).strict(),
    decisionHistory: z.array(z.object({
        version: z.number().int().positive(),
        priorConclusion: z.string(),
        conclusion: z.string(),
        limitation: z.string(),
        selectedRunIds: z.array(text),
        selectedSourceIds: z.array(text),
        feedback: PeerReviewSchema,
        timestamp
    }).strict()),
    recognition: RecognitionSchema
}).strict();

export type CaseRecord = z.infer<typeof CaseRecordSchema>;

const failure = (code: 'invalid-import' | 'invalid-case-record' | 'incompatible-case-record', message: string): Result<never> => ({
    ok: false,
    error: { code, message }
});

const validIds = (values: readonly string[], available: ReadonlySet<string>): boolean => unique(values) && values.every((value) => available.has(value));

/** Revalidates untrusted progress against the immutable definition already loaded by the app. */
export const validateCaseRecordForDefinition = (record: CaseRecord, definition: CaseDefinition): Result<CaseRecord> => {
    if (record.caseId !== definition.id || record.caseDefinitionVersion !== definition.version) {
        return failure('incompatible-case-record', 'This progress record is for a different version of this investigation. Your current work is unchanged.');
    }

    for (const control of definition.apparatus.primaryControls) {
        const value = record.activeControlValues[control.id];
        const normalized = normalizeControlValue(control, value);
        if (!normalized.ok || normalized.value !== value) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
    }

    const sources = new Map(definition.contextualArtifacts.map((source) => [source.id, source]));
    if (!validIds(record.inspectedSourceIds, new Set(sources.keys()))
        || record.inspectedSourceIds.some((sourceId) => !isSourceEligibleForInspection(sources.get(sourceId)!))) {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    if (record.phase !== 'context' && evaluateContextReadiness(definition, record.inspectedSourceIds).status !== 'ready') {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }
    if (['experiment', 'synthesis', 'review', 'debrief'].includes(record.phase)
        && evaluatePredictionReadiness(definition, record.prediction).status !== 'ready') {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    const runIds: string[] = [];
    for (const run of record.runs) {
        const validatedRun = createRunRecord(run, runIds);
        if (!validatedRun.ok || validatedRun.value.caseId !== definition.id
            || validatedRun.value.experimentModelVersion !== definition.experiment.modelVersion
            || !validatedRun.value.linkedEvidenceIds.every((sourceId) => record.inspectedSourceIds.includes(sourceId))
            || definition.apparatus.primaryControls.some((control) => {
                const normalized = normalizeControlValue(control, validatedRun.value.controls[control.id]);
                return !normalized.ok || normalized.value !== validatedRun.value.controls[control.id];
            })) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
        runIds.push(validatedRun.value.id);
    }

    const knownRunIds = new Set(runIds);
    if (!validIds(record.comparison.selectedRunIds, knownRunIds)
        || !record.comparison.notes.every((note) => note.runIds[0] !== note.runIds[1]
            && validIds(note.runIds, knownRunIds) && note.text.trim().length > 0)
        || new Set(record.comparison.notes.map((note) => JSON.stringify([...note.runIds].sort()))).size !== record.comparison.notes.length
        || !validIds(record.theory.selectedRunIds, knownRunIds)
        || !validIds(record.theory.selectedSourceIds, new Set(record.inspectedSourceIds))) {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    let previousTimestamp = '';
    let previousConclusion = '';
    for (let index = 0; index < record.decisionHistory.length; index += 1) {
        const entry = record.decisionHistory[index];
        if (entry.version !== index + 1 || !validIds(entry.selectedRunIds, knownRunIds)
            || !validIds(entry.selectedSourceIds, new Set(record.inspectedSourceIds))
            || !entry.conclusion.trim() || !entry.limitation.trim()
            || entry.priorConclusion !== previousConclusion
            || (previousTimestamp && entry.timestamp <= previousTimestamp)) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
        const feedback = evaluatePeerReview(definition, {
            runs: record.runs,
            inspectedSourceIds: record.inspectedSourceIds
        }, {
            selectedRunIds: entry.selectedRunIds,
            selectedSourceIds: entry.selectedSourceIds,
            conclusion: entry.conclusion,
            limitation: entry.limitation
        });
        if (feedback.status !== 'reviewed' || entry.feedback.status !== 'reviewed'
            || JSON.stringify(feedback.issues) !== JSON.stringify(entry.feedback.issues)) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
        previousTimestamp = entry.timestamp;
        previousConclusion = entry.conclusion;
    }

    if ((record.phase === 'review' || record.phase === 'debrief') && evaluateConclusionReadiness(definition, {
        runs: record.runs,
        inspectedSourceIds: record.inspectedSourceIds
    }, record.theory).status !== 'ready') {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    const derivedRecognition = deriveRecognition(definition, record);
    if (record.recognition.version === 1 && record.recognition.items.some((item) =>
        item.achieved !== derivedRecognition.items.find(({ id }) => id === item.id)?.achieved)) {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    return { ok: true, value: record };
};

/** Parses a selected JSON payload, migrates a supported record, and validates the current schema again. */
export const parseAndMigrateCaseRecord = (json: string): Result<CaseRecord> => {
    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(json) as unknown;
    } catch {
        return failure('invalid-import', 'This progress record could not be used. Your current work is unchanged.');
    }

    return migrateAndValidateCaseRecord(parsedJson);
};

/** Applies the supported migration boundary to already-decoded untrusted data. */
export const migrateAndValidateCaseRecord = (input: unknown): Result<CaseRecord> => {
    const migrated = migrateCaseRecord(input);
    if (!migrated.ok) return migrated;
    const parsed = CaseRecordSchema.safeParse(migrated.value);
    return parsed.success
        ? { ok: true, value: parsed.data }
        : failure('invalid-import', 'This progress record could not be used. Your current work is unchanged.');
};
