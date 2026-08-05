import type { Result } from '../../core/errors/Result';
import type { ExperimentResult } from '../evidence/RunRecord';

export type YoungFringeSpacingInputs = Readonly<{
    wavelengthNm: number;
    screenDistanceM: number;
    slitSpacingMm: number;
}>;

const DISPLAY_DECIMAL_PLACES = 4;

const roundForStoredDisplay = (value: number): number => Number(value.toFixed(DISPLAY_DECIMAL_PLACES));

/**
 * Calculates adjacent Young double-slit fringe spacing in millimetres using
 * Δy = λL/d. The conversion from nanometres to millimetres happens only here.
 */
export const calculateYoungFringeSpacing = (inputs: YoungFringeSpacingInputs): Result<ExperimentResult> => {
    if (!Number.isFinite(inputs.wavelengthNm) || !Number.isFinite(inputs.screenDistanceM) || !Number.isFinite(inputs.slitSpacingMm)
        || inputs.wavelengthNm <= 0 || inputs.screenDistanceM <= 0 || inputs.slitSpacingMm <= 0) {
        return { ok: false, error: { code: 'invalid-young-model-input', message: 'The selected apparatus inputs cannot produce a fringe spacing.' } };
    }

    const fringeSpacingMm = (inputs.wavelengthNm * 1e-3 * inputs.screenDistanceM) / inputs.slitSpacingMm;
    if (!Number.isFinite(fringeSpacingMm)) {
        return { ok: false, error: { code: 'invalid-young-model-input', message: 'The selected apparatus inputs cannot produce a fringe spacing.' } };
    }

    return { ok: true, value: Object.freeze({ label: 'Fringe spacing', value: roundForStoredDisplay(fringeSpacingMm), unit: 'mm' }) };
};
