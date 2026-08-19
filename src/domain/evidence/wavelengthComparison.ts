import type { CaseDefinition } from '../cases/CaseDefinition';
import type { RunRecord } from './RunRecord';

/**
 * How many recorded runs walked the case's **fixed minimum path** — the authored baseline wavelength,
 * at the authored minimum mode — and therefore count towards unlocking the optional comparison.
 *
 * One function, because before Story 3.1 this arithmetic existed four times with `550` written down in
 * each: `AppState`'s `minimumPathRunCount`, `selectAdvancedWavelengthUnlocked`, and twice more inside
 * record validation. The reducer refuses the click and the selector decides how the choice is *painted*
 * before one, so a drift between them shows the player an unlocked control that then refuses — and a
 * case authoring `fixedMinimumPathNm: 500` would have had every one of the four disagree with it
 * silently (`deferred-work.md:99`, assigned to this story).
 *
 * The threshold is deliberately **not** here: it is `requirements.minimumRuns`, read by each caller, so
 * this stays "how many qualify" and does not become a second copy of the gate itself.
 *
 * Unauthored `wavelengthComparison` yields 0. A case with no comparison has nothing to unlock, and
 * `reduceWavelengthSet` already refuses every advanced choice against an empty `advancedChoicesNm` — so
 * 0 keeps the selector from painting a control unlocked that no reducer would ever accept. For Young,
 * which authors the comparison at 550 nm, the count is unchanged.
 */
export const countFixedMinimumPathRuns = (definition: CaseDefinition, runs: readonly RunRecord[]): number => {
    const fixedMinimumPathNm = definition.experiment.wavelengthComparison?.fixedMinimumPathNm;
    if (fixedMinimumPathNm === undefined) return 0;

    return runs.filter((run) => run.modelInputs?.wavelengthMode === 'minimum'
        && run.modelInputs.wavelengthNm === fixedMinimumPathNm).length;
};

/**
 * Whether the optional comparison is available yet, from the authored baseline and the authored floor.
 *
 * The gate itself, stated once. `selectAdvancedWavelengthUnlocked` and `reduceWavelengthSet` both call
 * it rather than each comparing a count against `minimumRuns` themselves — which is the half of
 * `deferred-work.md:99` that mattered: two copies of a *rule*, not just two copies of a number.
 */
export const isAdvancedWavelengthUnlocked = (definition: CaseDefinition, runs: readonly RunRecord[]): boolean =>
    countFixedMinimumPathRuns(definition, runs) >= definition.requirements.minimumRuns;
