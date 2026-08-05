import { describe, expect, it } from 'vitest';

import { calculateYoungFringeSpacing } from '../../src/domain/apparatus/calculateYoungFringeSpacing';

describe('calculateYoungFringeSpacing', () => {
    it.each([
        [{ wavelengthNm: 550, screenDistanceM: 2, slitSpacingMm: 0.25 }, 4.4],
        [{ wavelengthNm: 450, screenDistanceM: 1, slitSpacingMm: 0.1 }, 4.5],
        [{ wavelengthNm: 650, screenDistanceM: 4, slitSpacingMm: 0.5 }, 5.2]
    ])('calculates deterministic adjacent-fringe spacing in millimetres', (inputs, expected) => {
        expect(calculateYoungFringeSpacing(inputs)).toEqual({
            ok: true,
            value: { label: 'Fringe spacing', value: expected, unit: 'mm' }
        });
    });

    it('uses one documented four-decimal display precision rule', () => {
        expect(calculateYoungFringeSpacing({ wavelengthNm: 550, screenDistanceM: 1.25, slitSpacingMm: 0.3 }))
            .toEqual({ ok: true, value: { label: 'Fringe spacing', value: 2.2917, unit: 'mm' } });
    });

    it('preserves the expected monotonic relationships', () => {
        const shortScreen = calculateYoungFringeSpacing({ wavelengthNm: 550, screenDistanceM: 1, slitSpacingMm: 0.25 });
        const longScreen = calculateYoungFringeSpacing({ wavelengthNm: 550, screenDistanceM: 4, slitSpacingMm: 0.25 });
        const baseline = calculateYoungFringeSpacing({ wavelengthNm: 550, screenDistanceM: 2, slitSpacingMm: 0.25 });
        const wideSlit = calculateYoungFringeSpacing({ wavelengthNm: 550, screenDistanceM: 2, slitSpacingMm: 0.5 });
        const redderLight = calculateYoungFringeSpacing({ wavelengthNm: 650, screenDistanceM: 2, slitSpacingMm: 0.25 });

        if (!shortScreen.ok || !longScreen.ok || !baseline.ok || !wideSlit.ok || !redderLight.ok) throw new Error('Fixtures must be valid.');
        expect(longScreen.value.value).toBeGreaterThan(shortScreen.value.value);
        expect(redderLight.value.value).toBeGreaterThan(shortScreen.value.value);
        expect(wideSlit.value.value).toBeLessThan(baseline.value.value);
    });

    it.each([
        { wavelengthNm: 0, screenDistanceM: 2, slitSpacingMm: 0.25 },
        { wavelengthNm: Number.NaN, screenDistanceM: 2, slitSpacingMm: 0.25 },
        { wavelengthNm: 550, screenDistanceM: Number.POSITIVE_INFINITY, slitSpacingMm: 0.25 },
        { wavelengthNm: 550, screenDistanceM: 2, slitSpacingMm: 0 }
    ])('returns a typed Result for malformed or non-physical inputs', (inputs) => {
        expect(calculateYoungFringeSpacing(inputs)).toMatchObject({ ok: false, error: { code: 'invalid-young-model-input' } });
    });
});
