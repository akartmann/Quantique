import type { Result } from '../../core/errors/Result';
import type { PrimaryControl } from '../cases/CaseDefinition';

const decimalPlaces = (value: number): number => {
    const [coefficient, exponentPart] = value.toString().toLowerCase().split('e');
    const fractionalPlaces = coefficient.split('.')[1]?.length ?? 0;
    const exponent = Number(exponentPart ?? 0);
    return Math.max(0, fractionalPlaces - exponent);
};

const normalizationScale = (control: PrimaryControl, value: number): number => {
    const decimals = Math.min(12, Math.max(
        decimalPlaces(control.min),
        decimalPlaces(control.max),
        decimalPlaces(control.step),
        decimalPlaces(value)
    ));
    return 10 ** decimals;
};

/**
 * Clamps to the authored range then snaps to its nearest step. Exact halfway
 * requests snap upward, providing one documented deterministic tie rule.
 */
export const normalizeControlValue = (control: PrimaryControl, requestedValue: number): Result<number> => {
    if (!Number.isFinite(requestedValue)) {
        return {
            ok: false,
            error: { code: 'invalid-control-value', message: 'Enter a finite control value.' }
        };
    }

    const scale = normalizationScale(control, requestedValue);
    const min = Math.round(control.min * scale);
    const max = Math.round(control.max * scale);
    const step = Math.round(control.step * scale);
    const clamped = Math.min(max, Math.max(min, Math.round(requestedValue * scale)));
    const snapped = min + Math.floor(((clamped - min) / step) + 0.5) * step;

    return { ok: true, value: Math.min(max, Math.max(min, snapped)) / scale };
};
