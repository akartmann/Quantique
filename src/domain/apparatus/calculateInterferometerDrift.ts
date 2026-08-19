import type { Result } from '../../core/errors/Result';
import type { ExperimentResult, RunControls } from '../evidence/RunRecord';

/**
 * The rotating-interferometer model: fringe displacement against orientation and bath temperature.
 *
 * **These constants are a prototype's shape, not a historical calibration.** They are chosen to make
 * the teaching loop of FR19 reachable — a near-null orientation signal buried under a temperature
 * confound that a patient experimenter can remove — and nothing here is sourced from the 1887 paper or
 * the 1907 report. Calibrating them against the published numbers, and having that agreement reviewed,
 * is **Story 4.2's** work. Do not cite these figures as historical.
 */

/** Fringe displacement, in fringe widths, contributed by orientation alone at its extremes. */
export const ORIENTATION_AMPLITUDE = 0.01;

/** Fringe displacement, in fringe widths, contributed per degree Celsius away from the stable window. */
export const THERMAL_COEFFICIENT = 0.05;

/** The bath temperature at which the thermal term vanishes and the orientation signal stands alone. */
export const STABLE_WINDOW_C = 20;

/** The authored control IDs this model reads. Checked against the case's apparatus at load. */
export const INTERFEROMETER_CONTROL_IDS = ['rotationDeg', 'bathTempC'] as const;

/**
 * Mirrors {@link calculateYoungFringeSpacing}'s stored precision rather than inventing a second one:
 * both results are read by the same notebook, the same printable record and the same bench readout,
 * and two precisions there would be two ways to render "the same" observation.
 */
const DISPLAY_DECIMAL_PLACES = 4;

const roundForStoredDisplay = (value: number): number => Number(value.toFixed(DISPLAY_DECIMAL_PLACES));

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Deterministic fringe displacement for the rotating interferometer.
 *
 * ```
 * displacement = ORIENTATION_AMPLITUDE * cos(2θ) + THERMAL_COEFFICIENT * (bathTempC - STABLE_WINDOW_C)
 * ```
 *
 * `cos(2θ)` is the orientation term's physical period: rotating 90° reverses the sign and 180° returns
 * to the start, which is what makes two orientations at the stable window a genuinely distinguishing
 * pair rather than a repetition. At 22 °C the thermal term is 0.10 and swamps the ±0.01 orientation
 * term entirely; at the stable window it vanishes and what remains is the near-null signal the
 * historical result actually was.
 */
export const calculateInterferometerDrift = (controls: RunControls): Result<ExperimentResult> => {
    const rotationDeg = controls.rotationDeg;
    const bathTempC = controls.bathTempC;
    if (!Number.isFinite(rotationDeg) || !Number.isFinite(bathTempC)) {
        return { ok: false, error: { code: 'invalid-experiment-model-input', message: 'The selected apparatus inputs cannot produce a fringe displacement.' } };
    }

    const displacement = ORIENTATION_AMPLITUDE * Math.cos(2 * rotationDeg * DEGREES_TO_RADIANS)
        + THERMAL_COEFFICIENT * (bathTempC - STABLE_WINDOW_C);
    if (!Number.isFinite(displacement)) {
        return { ok: false, error: { code: 'invalid-experiment-model-input', message: 'The selected apparatus inputs cannot produce a fringe displacement.' } };
    }

    return { ok: true, value: Object.freeze({ label: 'Fringe displacement', value: roundForStoredDisplay(displacement), unit: 'fringe widths' }) };
};
