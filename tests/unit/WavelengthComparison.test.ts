import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectAdvancedWavelengthUnlocked } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createRunRecord, runControlContract, type RunRecord } from '../../src/domain/evidence/RunRecord';
import { countFixedMinimumPathRuns, isAdvancedWavelengthUnlocked } from '../../src/domain/evidence/wavelengthComparison';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The optional wavelength comparison's gate, read from the authored baseline rather than a literal 550
 * (`deferred-work.md:99`, assigned to Story 3.1).
 *
 * The item was filed because `selectAdvancedWavelengthUnlocked` was a *second copy* of
 * `reduceWavelengthSet`'s gate with `550` written down in each. The reducer refuses the click; the
 * selector decides how the choice is painted before one. Two copies of one rule is a defect waiting for
 * a case that disagrees with the number, and this story is what makes such a case possible — so the
 * decisive test here is the one with a baseline that is **not** 550, which passed silently before.
 */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

const runAt = (id: string, wavelengthNm: 450 | 550 | 650, mode: 'minimum' | 'advanced', control: CaseDefinition): RunRecord => {
    const controls = Object.fromEntries(control.apparatus.primaryControls.map(({ id: controlId, defaultValue }) => [controlId, defaultValue]));
    const record = createRunRecord({
        id,
        caseId: control.id,
        controls,
        modelInputs: { slitSpacingMm: 0.25, screenDistanceM: 2, wavelengthNm, wavelengthMode: mode },
        result: { label: 'Fringe spacing', value: 4.4, unit: 'mm' },
        timestamp: `2026-08-06T12:00:0${id.at(-1)}.000Z`,
        experimentModelVersion: control.experiment.modelVersion
    }, runControlContract(control));
    if (!record.ok) throw new Error('Fixture run must be valid.');
    return record.value;
};

/** The same case with a different authored baseline, which no shipped content can express yet. */
const withBaseline = (fixedMinimumPathNm: number): CaseDefinition => ({
    ...definition,
    experiment: {
        ...definition.experiment,
        wavelengthComparison: { ...definition.experiment.wavelengthComparison!, fixedMinimumPathNm: fixedMinimumPathNm as 550 }
    }
});

describe('countFixedMinimumPathRuns', () => {
    it('counts the runs on the authored baseline path and nothing else', () => {
        const runs = [
            runAt('run-1', 550, 'minimum', definition),
            runAt('run-2', 550, 'minimum', definition),
            runAt('run-3', 450, 'advanced', definition)
        ];

        expect(countFixedMinimumPathRuns(definition, runs)).toBe(2);
    });

    it('counts nothing for a case that authors no comparison, so nothing can be painted unlocked', () => {
        // Not merely tidier than comparing against a literal 550: a case with no `wavelengthComparison`
        // has an empty `advancedChoicesNm`, so `reduceWavelengthSet` refuses *every* advanced choice.
        // A count that still matched 550 would have let the selector paint a control unlocked that no
        // dispatch could ever accept — a refusal with no way to earn it, which is the dead-end class
        // this codebase's validation exists to prevent.
        const withoutComparison = { ...definition, experiment: { ...definition.experiment, wavelengthComparison: undefined } };

        expect(countFixedMinimumPathRuns(withoutComparison, [runAt('run-1', 550, 'minimum', definition)])).toBe(0);
    });

    // The item's whole point, and the case that passed silently before. With a baseline of 450 authored,
    // two runs at 550 are runs on a path this case never described — and the old arithmetic counted both
    // of them, because the number it compared against was written into the function rather than read
    // from the case. Two of these runs used to unlock a comparison the case does not offer.
    //
    // The mirror assertion — two runs *at* 450/minimum counting 2 — is deliberately absent, because it is
    // not reachable yet: `validateModelInputs` refuses `minimum` mode at anything but 550, and
    // `YoungModelInputs.wavelengthNm` is a three-literal union. Both are the Young optical model, which
    // §Scope boundary keeps out of this story. Carried in `deferred-work.md` rather than faked here by
    // hand-building a `RunRecord` around its own validator.
    it('stops counting Young’s baseline once the case authors a different one', () => {
        const shifted = withBaseline(450);
        const onYoungsBaseline = [runAt('run-1', 550, 'minimum', shifted), runAt('run-2', 550, 'minimum', shifted)];

        expect(countFixedMinimumPathRuns(shifted, onYoungsBaseline)).toBe(0);
        expect(isAdvancedWavelengthUnlocked(shifted, onYoungsBaseline)).toBe(false);
    });
});

describe('the gate the reducer and the selector share', () => {
    it('stays shut below the authored floor and opens at it', () => {
        const oneRun = [runAt('run-1', 550, 'minimum', definition)];
        const twoRuns = [...oneRun, runAt('run-2', 550, 'minimum', definition)];

        expect(definition.requirements.minimumRuns).toBe(2);
        expect(isAdvancedWavelengthUnlocked(definition, oneRun)).toBe(false);
        expect(isAdvancedWavelengthUnlocked(definition, twoRuns)).toBe(true);
    });

    it('is the same answer the selector gives, on the shipped case, at every step', () => {
        // The two halves asserted against each other rather than each against `true`/`false`: that is the
        // property `deferred-work.md:99` was about, and the only assertion a future divergence must fail.
        const store = createStore(createInitialAppState(definition));
        const runs = [runAt('run-1', 550, 'minimum', definition), runAt('run-2', 550, 'minimum', definition)];

        runs.forEach((_run, index) => {
            const state = { ...store.getState(), runs: runs.slice(0, index + 1) };
            expect(selectAdvancedWavelengthUnlocked(state)).toBe(isAdvancedWavelengthUnlocked(state.caseDefinition, state.runs));
        });
    });

    it('and the same answer under a shifted baseline, where the selector used to say unlocked', () => {
        // The visible symptom of the duplicated gate: the bench paints the comparison available, and the
        // reducer then refuses every click on it. A refusal the player has no way to earn.
        const shifted = withBaseline(450);
        const state = {
            ...createInitialAppState(shifted),
            runs: [runAt('run-1', 550, 'minimum', shifted), runAt('run-2', 550, 'minimum', shifted)]
        };

        expect(selectAdvancedWavelengthUnlocked(state)).toBe(false);
        expect(selectAdvancedWavelengthUnlocked(state)).toBe(isAdvancedWavelengthUnlocked(shifted, state.runs));
    });
});
