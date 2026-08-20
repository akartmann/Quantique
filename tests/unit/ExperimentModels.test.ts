import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import {
    ETHER_DEMANDED_DISPLACEMENT_FRINGE_WIDTHS, ORIENTATION_AMPLITUDE, PUBLISHED_CERTAINTY_FRACTION,
    PUBLISHED_RESIDUAL_BOUND_FRINGE_WIDTHS, STABLE_WINDOW_C, THERMAL_COEFFICIENT, calculateInterferometerDrift
} from '../../src/domain/apparatus/calculateInterferometerDrift';
import { calculateYoungFringeSpacing } from '../../src/domain/apparatus/calculateYoungFringeSpacing';
import { decimalPlaces } from '../../src/core/i18n/formatNumber';
import {
    EXPERIMENT_MODEL_IDS, isExperimentModelId, resolveExperimentModel
} from '../../src/domain/apparatus/experimentModels';
import { evaluateConclusionReadiness } from '../../src/domain/theory/conclusionReadiness';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import type { RunRecord } from '../../src/domain/evidence/RunRecord';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';

/**
 * One authored control from the **shipped** prototype, so the constant-anchoring rows read the case's own
 * bounds rather than a literal 18–24 that could drift from `case.json` without any test noticing.
 */
let prototypeDefinition: CaseDefinition | undefined;
const interferometerControl = (controlId: string) => {
    if (!prototypeDefinition) throw new Error('The prototype case must be loaded before a control is read.');
    const control = prototypeDefinition.apparatus.primaryControls.find(({ id }) => id === controlId);
    if (!control) throw new Error(`The prototype must author a ${controlId} control.`);
    return control;
};

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/morley-miller/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Morley–Miller case must parse.');
    prototypeDefinition = parsed.data as CaseDefinition;
});

describe('the experiment model registry', () => {
    it('resolves every implemented model, and nothing else', () => {
        EXPERIMENT_MODEL_IDS.forEach((modelId) => {
            const model = resolveExperimentModel(modelId);
            expect(model?.id).toBe(modelId);
            expect(model!.requiredControlIds.length).toBeGreaterThan(0);
        });

        expect(resolveExperimentModel('newtonian-corpuscle')).toBeUndefined();
        expect(isExperimentModelId('newtonian-corpuscle')).toBe(false);
    });

    /**
     * The guarantee that keeps a run-time failure path out of the store: an unimplemented model is
     * refused at *load*, with its own path named, rather than at the moment the player presses start.
     */
    it('refuses a case naming a model this build does not implement, at load, with the path named', async () => {
        const raw = JSON.parse(await readFile('public/cases/morley-miller/case.json', 'utf8')) as Record<string, unknown>;
        (raw.experiment as Record<string, unknown>).modelId = 'aether-drag-v2';

        const parsed = CaseDefinitionSchema.safeParse(raw);
        expect(parsed.success).toBe(false);
        expect(parsed.success ? [] : parsed.error.issues).toEqual([expect.objectContaining({
            path: ['experiment', 'modelId'],
            message: `An experiment model must be one this build implements: ${EXPERIMENT_MODEL_IDS.join(', ')}.`
        })]);
    });

    /**
     * Wall 1, one layer down: a model reading a control the case does not author resolves to
     * `undefined` and refuses every run. Closed at load rather than left to the bench.
     */
    it('refuses a case whose apparatus cannot feed the model it names', async () => {
        const raw = JSON.parse(await readFile('public/cases/morley-miller/case.json', 'utf8')) as Record<string, unknown>;
        const apparatus = raw.apparatus as { primaryControls: { id: string }[] };
        apparatus.primaryControls[1]!.id = 'bathTemperatureC';

        const parsed = CaseDefinitionSchema.safeParse(raw);
        expect(parsed.success).toBe(false);
        expect(parsed.success ? [] : parsed.error.issues).toContainEqual(expect.objectContaining({
            path: ['apparatus', 'primaryControls'],
            message: 'The morley-miller-interferometer model reads bathTempC, which this apparatus does not author.'
        }));
    });

    /**
     * The seam must not have changed Young's arithmetic. Asserted against the calculator directly, so
     * this test fails if `bind` ever feeds it anything but the controls and the selected wavelength.
     */
    it('routes Young through its own calculator, bit for bit', () => {
        const model = resolveExperimentModel('young-double-slit')!;
        const controls = { slitSpacingMm: 0.25, screenDistanceM: 2 };

        const throughSeam = model.bind({ selectedWavelengthNm: 550, selectedWavelengthMode: 'minimum' })(controls);
        const direct = calculateYoungFringeSpacing({ slitSpacingMm: 0.25, screenDistanceM: 2, wavelengthNm: 550 });

        expect(throughSeam).toEqual(direct);
        expect(throughSeam.ok && throughSeam.value).toEqual({ label: 'Fringe spacing', value: 4.4, unit: 'mm' });
        expect(model.recordInputs!({ selectedWavelengthNm: 450, selectedWavelengthMode: 'advanced' }, controls))
            .toEqual({ slitSpacingMm: 0.25, screenDistanceM: 2, wavelengthNm: 450, wavelengthMode: 'advanced' });
    });

    it('gives the interferometer no model inputs to record', () => {
        expect(resolveExperimentModel('morley-miller-interferometer')!.recordInputs).toBeUndefined();
    });
});

describe('the interferometer drift model', () => {
    const drift = (rotationDeg: number, bathTempC: number): number => {
        const result = calculateInterferometerDrift({ rotationDeg, bathTempC });
        if (!result.ok) throw new Error(`Refused: ${result.error.code}`);
        return result.value.value;
    };

    /**
     * At the stable window the thermal term vanishes and the orientation signal stands alone — which is
     * the whole teaching loop of FR19, and the reason two orientations *there* are a distinguishing
     * pair. Asserted from the exported constants, never from a magic number shared with the source.
     */
    it('leaves only the orientation signal at the stable window', () => {
        expect(drift(0, STABLE_WINDOW_C)).toBeCloseTo(ORIENTATION_AMPLITUDE, 10);
        expect(drift(90, STABLE_WINDOW_C)).toBeCloseTo(-ORIENTATION_AMPLITUDE, 10);
        expect(drift(180, STABLE_WINDOW_C)).toBeCloseTo(ORIENTATION_AMPLITUDE, 10);
        // cos(2θ) is the physical period: 90° reverses the sign, 180° returns to the start.
        expect(drift(0, STABLE_WINDOW_C)).not.toBeCloseTo(drift(90, STABLE_WINDOW_C), 10);
    });

    it('lets the thermal term swamp the orientation term away from the window', () => {
        const warm = drift(0, STABLE_WINDOW_C + 2);
        expect(warm).toBeCloseTo(ORIENTATION_AMPLITUDE + 2 * THERMAL_COEFFICIENT, 10);
        // The confound is real: two degrees of warmth outweigh the whole orientation swing.
        expect(Math.abs(2 * THERMAL_COEFFICIENT)).toBeGreaterThan(2 * ORIENTATION_AMPLITUDE);
    });

    /**
     * The two teaching-chosen constants' **stated design requirement**, asserted (Story 4.2, AC3).
     *
     * `THERMAL_COEFFICIENT` and `STABLE_WINDOW_C` are not derived from anything the 1907 report publishes,
     * because it publishes no coefficient — it says only that *"the temperature effects could never be
     * entirely eliminated"*, so a derivation would be a fabrication dressed as a citation. AC3's second
     * branch therefore applies: they are documented with the design reason they are not derived. This is
     * that reason made executable, so the docstring cannot go quietly false the way five stories' worth of
     * comments in this codebase already have.
     *
     * Mutation target: bring `THERMAL_COEFFICIENT` down to the orientation amplitude's own scale, or move
     * `STABLE_WINDOW_C` off the authored range, and one of these rows fails.
     */
    it('keeps the thermal confound an order of magnitude above the signal at the authored default', () => {
        const bath = interferometerControl('bathTempC');
        const thermalAtDefault = Math.abs(THERMAL_COEFFICIENT * (bath.defaultValue - STABLE_WINDOW_C));

        // Swamps, not merely exceeds: the point of the loop is that a player reading the default bench
        // cannot see the orientation signal at all until they bring the bath back.
        expect(thermalAtDefault).toBeGreaterThanOrEqual(10 * ORIENTATION_AMPLITUDE);
        // And it genuinely vanishes at the window, so what remains there is only the signal.
        // Asked of the model, not of the arithmetic: `x * (a - a) === 0` is true for every finite x and
        // proved nothing about the calculator (4.2 code review). Two runs at one orientation, one at the
        // window and one off it, and the *difference between the recorded results* is the thermal term.
        const atWindow = drift(0, STABLE_WINDOW_C);
        const offWindow = drift(0, STABLE_WINDOW_C + 2);
        expect(offWindow - atWindow).toBeCloseTo(THERMAL_COEFFICIENT * 2, 10);
        // And at the window the thermal term contributes nothing: the reading is the orientation term alone.
        expect(atWindow).toBeCloseTo(ORIENTATION_AMPLITUDE, 10);
    });

    it('puts the stable window inside the authored range, so the instruction can actually be followed', () => {
        const bath = interferometerControl('bathTempC');

        // A window outside the authored bounds would make `experiment.resetPath` — "bring the bath back to
        // its steady window" — an instruction no player could carry out: a gate made unsatisfiable by
        // code, asked of a constant rather than of a predicate.
        expect(STABLE_WINDOW_C).toBeGreaterThanOrEqual(bath.min);
        expect(STABLE_WINDOW_C).toBeLessThanOrEqual(bath.max);
        // And reachable *exactly*, because the thermal term vanishes at one temperature and the authored
        // step is what decides whether the player can land on it.
        expect(Number(((STABLE_WINDOW_C - bath.min) / bath.step).toFixed(6)) % 1).toBe(0);
    });

    /**
     * The historical anchor for {@link ORIENTATION_AMPLITUDE} (Story 4.2, AC3).
     *
     * The case's own 1907 transcription states both published numbers: a stationary ether demanded **1.53
     * wave-lengths**, and the observations were certain to **one eightieth** of that. So the largest
     * residual orientation signal 1907 could *not* exclude is ≈ 0.019 fringe widths, and the property that
     * makes this case honest is that its apparatus reads something smaller than that.
     *
     * That property used to be a coincidence a docstring could not claim. It is now a guarantee that fails
     * with its own justification, which is the whole of what AC3 asks for on this constant — see the
     * calculator's header for why the amplitude is *bounded by* the published figure rather than *derived
     * from* it, and what a derivation would cost a returning player.
     *
     * **What this row asserts, and what it deliberately does not (4.2 code review).** It asserts the
     * *amplitude* is inside the published bound. It used to also assert that twice the amplitude — the
     * peak-to-peak swing a player reads as a difference between two orientations — was **greater** than
     * the bound, under a comment claiming the opposite in writing. `2 × 0.01 = 0.02` against `0.019125`,
     * so the comment was false and the row pinned the swing *outside* the bound; worse, it pointed the
     * wrong way, turning red for `ORIENTATION_AMPLITUDE = 0.009`, which is the change that would make the
     * model *more* honest. The swing being marginally outside the bound is a property of a
     * teaching-chosen amplitude and is not something to freeze in either direction — bringing it inside
     * would mean lowering the amplitude, which changes every recorded value and walks into the
     * `experiment.modelVersion` refusal D2 declined for good reason.
     *
     * Mutation target: raise `ORIENTATION_AMPLITUDE` above 0.019125 and this fails by name. That is now
     * true of the whole row rather than of one assertion in it.
     */
    it('keeps the orientation signal inside the bound the 1907 observations could exclude', () => {
        expect(ORIENTATION_AMPLITUDE).toBeLessThan(PUBLISHED_RESIDUAL_BOUND_FRINGE_WIDTHS);
        // The two published figures are the ones the case's own record quotes. That they cannot drift
        // apart from the transcription is asserted where the transcription is read, in
        // `MorleyMillerPrototype.test.ts` — not here, and it was claimed here before the 4.2 review found
        // no such assertion existed anywhere.
        expect(ETHER_DEMANDED_DISPLACEMENT_FRINGE_WIDTHS).toBe(1.53);
        expect(PUBLISHED_CERTAINTY_FRACTION).toBe(1 / 80);
    });

    it('rounds for storage exactly as the Young calculator does', () => {
        // Four decimals, the shared precision — two would be two ways to render one observation.
        //
        // Asserted against the **literal** stored value. This compared the function's output to itself
        // re-rounded until the review of 3.2, which is green for any rounding coarser than the one it
        // names: at three, two, one or zero decimals `0.1` still equals `Number((0.1).toFixed(4))`, so
        // the row detected only the total absence of rounding. The raw term is 0.06775637355817003.
        expect(drift(37, 21.3)).toBe(0.0678);
        // And the claim in the title: the same precision the Young calculator stores at, which this row
        // never actually referenced.
        const young = calculateYoungFringeSpacing({ slitSpacingMm: 0.25, screenDistanceM: 2, wavelengthNm: 550 });
        expect(young.ok).toBe(true);
        if (young.ok) {
            expect(decimalPlaces(young.value.value)).toBeLessThanOrEqual(4);
            expect(young.value.value).toBe(Number(young.value.value.toFixed(4)));
        }
        // -0 never reaches storage: `cos(270°)` is -1.84e-16, and `(-0).toString()` is "0", so the
        // formatter would print "-0" at zero decimals beside every other run's four (review 2026-08-19).
        expect(Object.is(drift(135, STABLE_WINDOW_C), -0)).toBe(false);
        expect(drift(135, STABLE_WINDOW_C)).toBe(0);
    });

    it('refuses inputs it cannot compute from', () => {
        expect(calculateInterferometerDrift({ rotationDeg: Number.NaN, bathTempC: 20 }))
            .toEqual({ ok: false, error: { code: 'invalid-experiment-model-input', message: 'The selected apparatus inputs cannot produce a fringe displacement.' } });
        expect(calculateInterferometerDrift({ rotationDeg: 0 }).ok).toBe(false);
    });
});

/**
 * The two evaluator rules Story 3.2 re-expressed, tested on a case that records no Young model inputs.
 *
 * Both were **permanently unsatisfiable** for such a case, and both were green: `non-physical-young-run`
 * refused every selected run because `modelInputs` is `YoungModelInputs`, and `distinct-run-configurations`
 * compared three `modelInputs` names that were all `undefined`, so its `.some(...)` was false whatever
 * the player did. The evaluator is the sole completion authority (ADR-006), so together they meant the
 * theory board could never unlock for a second case.
 */
describe('conclusion readiness for a case with no Young model inputs', () => {
    const definition = {
        requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
        experiment: { modelVersion: 'morley-miller-interferometer-v1' },
        significanceRule: { criticalControlIds: ['rotationDeg'] }
    } as unknown as CaseDefinition;

    const run = (id: string, rotationDeg: number, modelVersion = 'morley-miller-interferometer-v1'): RunRecord => ({
        id,
        caseId: 'morley-miller',
        controls: { rotationDeg, bathTempC: 20 },
        result: { label: 'Fringe displacement', value: 0.01, unit: 'fringe widths' },
        timestamp: '2026-08-19T10:00:00.000Z',
        experimentModelVersion: modelVersion,
        linkedEvidenceIds: []
    });

    const readinessFor = (runs: readonly RunRecord[]) => evaluateConclusionReadiness(definition, {
        runs,
        inspectedSourceIds: ['source-a', 'source-b'],
        comparisonNotes: [{ runIds: [runs[0]!.id, runs[1]!.id] }]
    }, {
        selectedRunIds: runs.map(({ id }) => id),
        selectedSourceIds: ['source-a', 'source-b'],
        conclusion: 'A bounded conclusion.',
        limitation: 'A stated limitation.'
    });

    it('is ready on two runs the case\'s own model produced at two configurations', () => {
        expect(readinessFor([run('run-1', 0), run('run-2', 90)])).toEqual({ status: 'ready', missing: [] });
    });

    /** The guard `foreign-model-run` re-expresses: a reading some other model produced is still refused. */
    it('refuses a run another model version produced', () => {
        const readiness = readinessFor([run('run-1', 0), run('run-2', 90, 'young-double-slit-v1')]);

        expect(readiness.status).toBe('incomplete');
        expect(readiness.missing.map(({ code }) => code)).toContain('foreign-model-run');
    });

    /** The guard `distinct-run-configurations` re-expresses, now decided by `configurationKey`. */
    it('refuses two runs recorded at one configuration', () => {
        const readiness = readinessFor([run('run-1', 45), run('run-2', 45)]);

        expect(readiness.status).toBe('incomplete');
        expect(readiness.missing.map(({ code }) => code)).toContain('distinct-run-configurations');
    });

    /**
     * `configurationKey` is read from the case's *own* significance rule, so a control the rule does
     * not call critical does not make two runs distinct. Reusing that function rather than writing a
     * second comparison is what keeps this answer identical to the significant-measure gate's.
     */
    it('does not count a non-critical control as a distinguishing difference', () => {
        const first = run('run-1', 45);
        const second = { ...run('run-2', 45), controls: { rotationDeg: 45, bathTempC: 24 } };

        expect(readinessFor([first, second]).missing.map(({ code }) => code)).toContain('distinct-run-configurations');
    });
});

/**
 * The interface strings this story renamed or added, in both shipped languages (AC6).
 *
 * Key *parity* between the bundles is already covered in `I18n.test.ts`; what that cannot see is a key
 * the code stopped emitting. `translateError` falls back to the dev-facing English `message` for a code
 * it has no key for (NFR18), and `translate` humanises a missing key rather than failing — so a renamed
 * readiness code or an unkeyed new error surfaces as English prose on a French screen, silently.
 */
describe('the interface strings this story moved', () => {
    it('authors a line for the re-expressed readiness code, and no longer ships the Young-shaped one', () => {
        expect(en['conclusion.missing.foreign-model-run']).toBeDefined();
        expect(fr['conclusion.missing.foreign-model-run']).toBeDefined();
        expect('conclusion.missing.non-physical-young-run' in en).toBe(false);
        expect('conclusion.missing.non-physical-young-run' in fr).toBe(false);
    });

    it('authors both new experiment-model failures, so neither reaches the player in English only', () => {
        (['error.invalid-experiment-model-input', 'error.unknown-experiment-model'] as const).forEach((key) => {
            expect(en[key].trim().length).toBeGreaterThan(0);
            expect(fr[key].trim().length).toBeGreaterThan(0);
            expect(fr[key]).not.toBe(en[key]);
        });
    });

    it('authors a result label for every implemented model', () => {
        EXPERIMENT_MODEL_IDS.forEach((modelId) => {
            const key = resolveExperimentModel(modelId)!.resultLabelKey;
            expect(en[key].trim().length, `${key} (en)`).toBeGreaterThan(0);
            expect(fr[key].trim().length, `${key} (fr)`).toBeGreaterThan(0);
        });
    });

    /**
     * `print.observations.preModel` said "not treated as a physical Young measurement". For a case
     * whose model records no optical inputs that was printed over *every* observation the player made.
     */
    it('replaced the pre-model print line with one that states the run\'s own settings', () => {
        expect('print.observations.preModel' in en).toBe(false);
        expect(en['print.observations.settings']).toContain('{settings}');
        expect(fr['print.observations.settings']).toContain('{settings}');
    });
});
