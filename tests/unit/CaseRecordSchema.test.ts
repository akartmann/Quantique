import { describe, expect, it } from 'vitest';

import { CaseRecordSchema, parseAndMigrateCaseRecord, validateCaseRecordForDefinition } from '../../src/schemas/CaseRecordSchema';
import { createAppStateFromCaseRecord, createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { createCaseRecordProjection } from '../../src/core/store/CaseRecordProjection';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

const definition = {
    id: 'young-interference', version: '1.0.0', prediction: { required: true }, requirements: { minimumRuns: 2, minimumSources: 2 },
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    contextualArtifacts: [
        { id: 'source-1', displayName: 'Source one', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' },
        { id: 'source-2', displayName: 'Source two', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }
    ],
    experiment: { modelVersion: 'young-v1' }
} as CaseDefinition;

const validRecord = {
    schemaVersion: 2,
    caseId: 'young-interference',
    caseDefinitionVersion: '1.0.0',
    phase: 'context',
    activeControlValues: { slitSpacingMm: 0.25, screenDistanceM: 2 },
    inspectedSourceIds: ['source-1'],
    prediction: '',
    runs: [{
        id: 'run-001', caseId: 'young-interference', controls: { slitSpacingMm: 0.25, screenDistanceM: 2 },
        result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp: '2026-08-05T10:00:00.000Z',
        experimentModelVersion: 'young-v1', linkedEvidenceIds: ['source-1']
    }],
    comparison: { selectedRunIds: ['run-001'], notes: [] },
    theory: { selectedRunIds: ['run-001'], selectedSourceIds: ['source-1'], conclusion: 'A bounded conclusion.', limitation: 'A limitation.' },
    decisionHistory: [],
    recognition: {
        version: 1,
        items: [
            { id: 'source-discipline', label: 'Source discipline recorded', description: 'Each reviewed contextual source has been inspected as evidence.', achieved: false },
            { id: 'replication', label: 'Replication recorded', description: 'Two observations use the same setup for comparison.', achieved: false },
            { id: 'variable-curiosity', label: 'Variable curiosity recorded', description: 'Two observations use different authored control settings for comparison.', achieved: false },
            { id: 'calibrated-conclusion', label: 'Calibrated conclusion recorded', description: 'A reviewed revision makes a bounded claim without an overreach finding.', achieved: false }
        ]
    }
};

describe('portable case records', () => {
    it('strictly parses the current projection and validates it against the loaded definition', () => {
        const parsed = CaseRecordSchema.safeParse(validRecord);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(validateCaseRecordForDefinition(parsed.data, definition)).toEqual({ ok: true, value: parsed.data });
        expect(createInitialAppState(definition).caseDefinition).toBe(definition);
    });

    it('rejects unknown fields, duplicate references, and incompatible records with neutral failures', () => {
        expect(CaseRecordSchema.safeParse({ ...validRecord, unexpected: true }).success).toBe(false);
        const duplicate = CaseRecordSchema.parse({ ...validRecord, inspectedSourceIds: ['source-1', 'source-1'] });
        expect(validateCaseRecordForDefinition(duplicate, definition)).toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });
        const mismatch = CaseRecordSchema.parse({ ...validRecord, caseDefinitionVersion: '2.0.0' });
        expect(validateCaseRecordForDefinition(mismatch, definition)).toMatchObject({ ok: false, error: { code: 'incompatible-case-record' } });
        expect(CaseRecordSchema.safeParse({
            ...validRecord,
            recognition: { ...validRecord.recognition, items: [...validRecord.recognition.items.slice(0, 3), validRecord.recognition.items[0]] }
        }).success).toBe(false);
        const unjustifiedRecognition = CaseRecordSchema.parse({
            ...validRecord,
            recognition: {
                ...validRecord.recognition,
                items: validRecord.recognition.items.map((item) => item.id === 'source-discipline' ? { ...item, achieved: true } : item)
            }
        });
        expect(validateCaseRecordForDefinition(unjustifiedRecognition, definition)).toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });
    });

    it('rejects impossible historical snapshots, bypassed debriefs, and malformed history', () => {
        const impossibleRun = CaseRecordSchema.parse({
            ...validRecord,
            runs: [{ ...validRecord.runs[0], controls: { slitSpacingMm: 0.9, screenDistanceM: 2 } }]
        });
        expect(validateCaseRecordForDefinition(impossibleRun, definition)).toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });

        const bypassedDebrief = CaseRecordSchema.parse({ ...validRecord, phase: 'debrief' });
        expect(validateCaseRecordForDefinition(bypassedDebrief, definition)).toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });

        const malformedHistory = CaseRecordSchema.parse({
            ...validRecord,
            decisionHistory: [{
                version: 1, priorConclusion: '', conclusion: '', limitation: '', selectedRunIds: ['run-001'], selectedSourceIds: ['source-1'],
                feedback: { status: 'unavailable', message: 'Unavailable.' }, timestamp: '2026-08-05T10:01:00.000Z'
            }]
        });
        expect(validateCaseRecordForDefinition(malformedHistory, definition)).toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });
    });

    it('migrates only supported prior versions and rejects malformed, future, and unsupported versions', () => {
        const { prediction: _prediction, ...legacyRecord } = validRecord;
        expect(parseAndMigrateCaseRecord(JSON.stringify({ ...legacyRecord, schemaVersion: 0 }))).toMatchObject({ ok: true, value: { schemaVersion: 2, prediction: '' } });
        expect(parseAndMigrateCaseRecord('{')).toMatchObject({ ok: false, error: { code: 'invalid-import' } });
        expect(parseAndMigrateCaseRecord(JSON.stringify({ ...legacyRecord, schemaVersion: 1 }))).toMatchObject({ ok: true, value: { schemaVersion: 2, prediction: '' } });
        expect(parseAndMigrateCaseRecord(JSON.stringify({ ...validRecord, schemaVersion: 3 }))).toMatchObject({ ok: false, error: { code: 'incompatible-record-version' } });
        expect(parseAndMigrateCaseRecord(JSON.stringify({ ...validRecord, schemaVersion: -1 }))).toMatchObject({ ok: false, error: { code: 'invalid-import' } });
        const migratedRecognition = parseAndMigrateCaseRecord(JSON.stringify({ ...validRecord, recognition: {} }));
        expect(migratedRecognition).toMatchObject({ ok: true, value: { recognition: { version: 0, items: [] } } });

        const legacyProgress = parseAndMigrateCaseRecord(JSON.stringify({
            ...legacyRecord,
            schemaVersion: 1,
            phase: 'experiment',
            inspectedSourceIds: ['source-1', 'source-2'],
            recognition: { version: 0, items: [] }
        }));
        expect(legacyProgress).toMatchObject({ ok: true, value: { phase: 'prediction', prediction: '' } });
        if (legacyProgress.ok) {
            const migrated = CaseRecordSchema.parse(legacyProgress.value);
            expect(validateCaseRecordForDefinition(migrated, definition)).toEqual({ ok: true, value: migrated });
        }
    });

    it('creates a frozen restored state only from a definition-compatible record', () => {
        const restored = createAppStateFromCaseRecord(CaseRecordSchema.parse(validRecord), definition);
        expect(restored).toMatchObject({ ok: true, value: { runs: [{ id: 'run-001' }], inspectedSourceIds: ['source-1'] } });
        if (restored.ok) {
            expect(Object.isFrozen(restored.value)).toBe(true);
            expect(Object.isFrozen(restored.value.runs[0])).toBe(true);
            expect(Object.isFrozen(restored.value.runs[0].controls)).toBe(true);
        }
    });

    it('projects and hydrates strict recognition with the portable record', () => {
        const projected = createCaseRecordProjection(createInitialAppState(definition));
        expect(projected).toMatchObject({ ok: true, value: { schemaVersion: 2, prediction: '', recognition: { version: 1 } } });
        if (!projected.ok) return;
        expect(projected.value.recognition.items[0]).toMatchObject({ id: 'source-discipline', achieved: false });
        const restored = createAppStateFromCaseRecord(projected.value, definition);
        expect(restored).toMatchObject({ ok: true, value: { recognition: projected.value.recognition } });
    });

    it('only replaces store state through record validation and serializes progress operations', () => {
        const store = createStore(createInitialAppState(definition));
        const mismatch = CaseRecordSchema.parse({ ...validRecord, caseDefinitionVersion: '2.0.0' });
        expect(store.replaceWithValidatedRecord(mismatch)).toMatchObject({ ok: false, error: { code: 'incompatible-case-record' } });
        expect(store.getState().phase).toBe('context');

        const lock = store.acquireExclusiveOperation();
        expect(lock.ok).toBe(true);
        if (!lock.ok) return;
        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' })).toMatchObject({ ok: false, error: { code: 'progress-operation-active' } });
        lock.value();
        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' })).toMatchObject({ ok: false, error: { code: 'missing-contextual-sources' } });
    });
});
