import { describe, expect, it } from 'vitest';

import { createRunRecord, runControlContract, type RunControlContract } from '../../src/domain/evidence/RunRecord';

const validInput = {
    id: 'run-001',
    caseId: 'young-interference',
    controls: { slitSpacingMm: 0.25, screenDistanceM: 2 },
    result: { label: 'Observed fringe spacing', value: 1.1, unit: 'mm' },
    timestamp: '2026-08-04T10:15:00.000Z',
    experimentModelVersion: 'young-observation-v1',
    linkedEvidenceIds: ['young-record']
};

/**
 * The authored control set a run is checked against since Story 3.1. It arrives by parameter rather
 * than being hard-coded inside `validateControls`, so a case authoring different controls gets its own
 * snapshot validated rather than Young's two silently required and everything else dropped.
 */
const contract: RunControlContract = { controlIds: ['slitSpacingMm', 'screenDistanceM'] };

describe('createRunRecord', () => {
    it('creates a deterministic, deeply immutable historical snapshot', () => {
        const controls = { ...validInput.controls };
        const result = { ...validInput.result };
        const linkedEvidenceIds = [...validInput.linkedEvidenceIds];
        const record = createRunRecord({ ...validInput, controls, result, linkedEvidenceIds }, contract);

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
        expect(createRunRecord(input, contract)).toMatchObject({ ok: false, error: { code: errorCode } });
    });

    it.each([
        [{ ...validInput, id: undefined }, 'invalid-run-id'],
        [{ ...validInput, result: { ...validInput.result, label: null } }, 'invalid-run-result'],
        [{ ...validInput, linkedEvidenceIds: 'young-record' }, 'invalid-linked-evidence'],
        [null, 'invalid-run-record']
    ])('returns a typed failure for malformed runtime input', (input, errorCode) => {
        expect(createRunRecord(input as never, contract)).toMatchObject({ ok: false, error: { code: errorCode } });
    });

    it('rejects a duplicate injected run ID without changing prior evidence', () => {
        expect(createRunRecord(validInput, contract, ['run-001'])).toMatchObject({
            ok: false,
            error: { code: 'duplicate-run-id' }
        });
    });

    // --- The control snapshot against the authored control set (Story 3.1) -----------------------
    //
    // `validateControls` used to hard-code Young's two keys and rebuild the snapshot from them. The
    // first two cases below are what that cost: a third authored control silently dropped from a
    // persisted run — so the run claimed a configuration it was not taken at, and
    // `countSignificantMeasures` counted two different arrangements as one — and a typo'd control ID
    // accepted, persisted, then read as `undefined` at every consumer that looks it up by name.
    it('snapshots every authored control, including one Young does not have', () => {
        const threeControls = { controlIds: ['slitSpacingMm', 'screenDistanceM', 'bathTempC'] };
        const record = createRunRecord({ ...validInput, controls: { slitSpacingMm: 0.25, screenDistanceM: 2, bathTempC: 20 } }, threeControls);

        expect(record.ok && record.value.controls).toEqual({ slitSpacingMm: 0.25, screenDistanceM: 2, bathTempC: 20 });
    });

    it.each([
        ['a control the case does not author', { slitSpacingMm: 0.25, screenDistanceM: 2, typoedControl: 3 }, 'A run may only snapshot the controls this case authors.'],
        ['a missing authored control', { slitSpacingMm: 0.25 }, 'A run needs finite snapshots of every apparatus control.']
    ])('rejects %s', (_description, controls, message) => {
        expect(createRunRecord({ ...validInput, controls }, contract)).toMatchObject({
            ok: false,
            error: { code: 'invalid-run-controls', message }
        });
    });

    it('snapshots in the authored order, so one configuration serialises one way', () => {
        // `configurationKey` joins the critical control values, and `countSignificantMeasures` counts
        // distinct keys — so a snapshot that preserved the *input's* key order would let the same
        // arrangement recorded through two code paths count as two significant measurements.
        const forward = createRunRecord({ ...validInput, controls: { slitSpacingMm: 0.25, screenDistanceM: 2 } }, contract);
        const reversed = createRunRecord({ ...validInput, controls: { screenDistanceM: 2, slitSpacingMm: 0.25 } }, contract);

        expect(forward.ok && reversed.ok && JSON.stringify(forward.value.controls)).toBe(reversed.ok ? JSON.stringify(reversed.value.controls) : '');
    });

    it('takes the control set as an object, so it cannot be confused with the run-ID list', () => {
        // Not a style point. Both were `readonly string[]` in an earlier draft of this change, adjacent
        // in the signature, and swapping them would have validated every run against a list of run IDs
        // with no compiler complaint at all.
        //
        // Asserted against the contract the *production* helper builds, not against the local fixture.
        // The earlier version read `Object.keys(contract)` — the literal declared in this file — so it
        // exercised no production symbol and could only fail if the fixture were edited. It stood in for a
        // compiler check that does not run: `tsconfig.json` includes only `src`, so no `tsc` invocation
        // sees this file at all (review 2026-08-19, `deferred-work.md`).
        expect(Object.keys(runControlContract({
            apparatus: { primaryControls: [{ id: 'slitSpacingMm' }, { id: 'screenDistanceM' }] }
        }))).toEqual(['controlIds']);
    });
});
