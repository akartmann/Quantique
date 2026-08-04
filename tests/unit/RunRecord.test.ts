import { describe, expect, it } from 'vitest';

import { createRunRecord } from '../../src/domain/evidence/RunRecord';

const validInput = {
    id: 'run-001',
    caseId: 'young-interference',
    controls: { slitSpacingMm: 0.25, screenDistanceM: 2 },
    result: { label: 'Observed fringe spacing', value: 1.1, unit: 'mm' },
    timestamp: '2026-08-04T10:15:00.000Z',
    experimentModelVersion: 'young-observation-v1',
    linkedEvidenceIds: ['young-record']
};

describe('createRunRecord', () => {
    it('creates a deterministic, deeply immutable historical snapshot', () => {
        const controls = { ...validInput.controls };
        const result = { ...validInput.result };
        const linkedEvidenceIds = [...validInput.linkedEvidenceIds];
        const record = createRunRecord({ ...validInput, controls, result, linkedEvidenceIds });

        expect(record).toEqual({ ok: true, value: validInput });
        if (record.ok) {
            controls.slitSpacingMm = 0.5;
            result.value = 99;
            linkedEvidenceIds.push('later-source');

            expect(record.value.controls.slitSpacingMm).toBe(0.25);
            expect(record.value.result.value).toBe(1.1);
            expect(record.value.linkedEvidenceIds).toEqual(['young-record']);
            expect(Object.isFrozen(record.value)).toBe(true);
            expect(Object.isFrozen(record.value.controls)).toBe(true);
            expect(Object.isFrozen(record.value.result)).toBe(true);
            expect(Object.isFrozen(record.value.linkedEvidenceIds)).toBe(true);
        }
    });

    it.each([
        [{ ...validInput, id: '' }, 'invalid-run-id'],
        [{ ...validInput, timestamp: 'today' }, 'invalid-run-timestamp'],
        [{ ...validInput, controls: { ...validInput.controls, slitSpacingMm: Number.NaN } }, 'invalid-run-controls'],
        [{ ...validInput, result: { ...validInput.result, value: Number.POSITIVE_INFINITY } }, 'invalid-run-result'],
        [{ ...validInput, linkedEvidenceIds: ['duplicate', 'duplicate'] }, 'invalid-linked-evidence']
    ])('rejects invalid evidence data with a typed failure', (input, errorCode) => {
        expect(createRunRecord(input)).toMatchObject({ ok: false, error: { code: errorCode } });
    });

    it.each([
        [{ ...validInput, id: undefined }, 'invalid-run-id'],
        [{ ...validInput, result: { ...validInput.result, label: null } }, 'invalid-run-result'],
        [{ ...validInput, linkedEvidenceIds: 'young-record' }, 'invalid-linked-evidence'],
        [null, 'invalid-run-record']
    ])('returns a typed failure for malformed runtime input', (input, errorCode) => {
        expect(createRunRecord(input as never)).toMatchObject({ ok: false, error: { code: errorCode } });
    });

    it('rejects a duplicate injected run ID without changing prior evidence', () => {
        expect(createRunRecord(validInput, ['run-001'])).toMatchObject({
            ok: false,
            error: { code: 'duplicate-run-id' }
        });
    });
});
