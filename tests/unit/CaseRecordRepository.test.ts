import { describe, expect, it } from 'vitest';

import { CaseRecordRepository } from '../../src/adapters/persistence/caseRecordRepository';
import { CaseRecordSchema } from '../../src/schemas/CaseRecordSchema';

const record = CaseRecordSchema.parse({
    schemaVersion: 1, caseId: 'young-interference', caseDefinitionVersion: '1.0.0', phase: 'context',
    activeControlValues: { slitSpacingMm: 0.25, screenDistanceM: 2 }, inspectedSourceIds: [], runs: [],
    comparison: { selectedRunIds: [], notes: [] }, theory: { selectedRunIds: [], selectedSourceIds: [], conclusion: '', limitation: '' },
    decisionHistory: []
});

describe('case record repository', () => {
    it('keeps the prior valid record when a save fails and rejects invalid stored data', async () => {
        let stored: unknown = record;
        let failWrites = false;
        const repository = new CaseRecordRepository({
            read: async () => ({ ok: true, value: stored }),
            write: async (value) => failWrites
                ? { ok: false as const, error: { code: 'persistence-unavailable', message: 'Unavailable.' } }
                : (stored = value, { ok: true as const, value: undefined })
        });

        expect(await repository.load('young-interference')).toEqual({ ok: true, value: record });
        failWrites = true;
        expect(await repository.save({ ...record, phase: 'prediction' })).toMatchObject({ ok: false, error: { code: 'persistence-unavailable' } });
        expect(stored).toEqual(record);
        stored = { ...record, unknown: true };
        expect(await repository.load('young-interference')).toMatchObject({ ok: false, error: { code: 'invalid-import' } });
    });
});
