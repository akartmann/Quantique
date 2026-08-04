import { describe, expect, it } from 'vitest';

import { normalizeControlValue } from '../../src/domain/apparatus/ApparatusControl';
import type { PrimaryControl } from '../../src/domain/cases/CaseDefinition';

const slitSpacing: PrimaryControl = {
    id: 'slitSpacingMm',
    label: 'Slit spacing',
    unit: 'mm',
    min: 0.1,
    max: 0.5,
    step: 0.05,
    defaultValue: 0.25
};

describe('normalizeControlValue', () => {
    it.each([
        [0.25, 0.25],
        [0.01, 0.1],
        [0.9, 0.5],
        [0.23, 0.25],
        [0.225, 0.25]
    ])('normalizes %s to %s using the authored interval and tie-up rule', (requested, accepted) => {
        expect(normalizeControlValue(slitSpacing, requested)).toEqual({ ok: true, value: accepted });
    });

    it('rejects non-finite values as recoverable results', () => {
        expect(normalizeControlValue(slitSpacing, Number.NaN)).toMatchObject({ ok: false, error: { code: 'invalid-control-value' } });
        expect(normalizeControlValue(slitSpacing, Number.POSITIVE_INFINITY)).toMatchObject({ ok: false, error: { code: 'invalid-control-value' } });
    });
});
