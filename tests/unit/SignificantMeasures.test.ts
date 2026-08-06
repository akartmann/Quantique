import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import type { CaseDefinition, SignificanceRule } from '../../src/domain/cases/CaseDefinition';
import type { RunRecord } from '../../src/domain/evidence/RunRecord';
import { countSignificantMeasures, isSignificantMeasureGateMet } from '../../src/domain/evidence/significantMeasures';
import { calculateYoungFringeSpacing } from '../../src/domain/apparatus/calculateYoungFringeSpacing';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The authored Young content, not a hand-built definition: the rule is shipped case data, so a
 * `significanceRule` quietly dropped or retuned has to fail here.
 *
 * No Phaser, no store, no locale, no browser — counting is pure, and AC1 says so explicitly.
 */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

/** The deterministic model's reading, unwrapped. Every fixture configuration here is in-bounds. */
const spacing = (slitSpacingMm: number, screenDistanceM: number): number => {
    const result = calculateYoungFringeSpacing({ slitSpacingMm, screenDistanceM, wavelengthNm: 550 });
    if (!result.ok) throw new Error('The fixture configuration must be inside the authored bounds.');
    return result.value.value;
};

/**
 * A run carrying only what counting reads. `modelInputs` is deliberately absent on most of these:
 * `createRunRecord` makes it optional, several existing fixtures omit it, and counting must work from
 * `controls` alone rather than quietly requiring the physical-run shape.
 */
const run = (id: string, slitSpacingMm: number, screenDistanceM: number, value?: number): RunRecord => Object.freeze({
    id,
    caseId: 'young-interference',
    controls: Object.freeze({ slitSpacingMm, screenDistanceM }),
    result: Object.freeze({
        label: 'Fringe spacing',
        // Defaults to the real deterministic model, so a "different configuration" fixture also
        // carries a genuinely different reading rather than an invented one.
        value: value ?? spacing(slitSpacingMm, screenDistanceM),
        unit: 'mm'
    }),
    timestamp: '2026-08-06T10:00:00.000Z',
    experimentModelVersion: '1.0.0',
    linkedEvidenceIds: Object.freeze([])
});

/** A physical run, which is the only shape that carries a wavelength. */
const runAtWavelength = (
    id: string,
    slitSpacingMm: number,
    screenDistanceM: number,
    wavelengthNm: 450 | 550 | 650
): RunRecord => Object.freeze({
    ...run(id, slitSpacingMm, screenDistanceM),
    modelInputs: Object.freeze({
        slitSpacingMm,
        screenDistanceM,
        wavelengthNm,
        wavelengthMode: wavelengthNm === 550 ? 'minimum' as const : 'advanced' as const
    })
});

const RULE: SignificanceRule = { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] };

describe('countSignificantMeasures', () => {
    it('counts nothing when nothing is recorded', () => {
        expect(countSignificantMeasures(RULE, [])).toBe(0);
    });

    it('counts a single recorded run as one', () => {
        expect(countSignificantMeasures(RULE, [run('a', 0.2, 2)])).toBe(1);
    });

    it('counts two runs at an identical configuration as one — a replication is not a variation', () => {
        expect(countSignificantMeasures(RULE, [run('a', 0.2, 2), run('b', 0.2, 2)])).toBe(1);
    });

    it('counts two runs differing on slit spacing as two', () => {
        expect(countSignificantMeasures(RULE, [run('a', 0.2, 2), run('b', 0.3, 2)])).toBe(2);
    });

    it('counts two runs differing on screen distance as two', () => {
        expect(countSignificantMeasures(RULE, [run('a', 0.2, 2), run('b', 0.2, 3)])).toBe(2);
    });

    it('counts three runs with one duplicate configuration as two', () => {
        expect(countSignificantMeasures(RULE, [run('a', 0.2, 2), run('b', 0.3, 2), run('c', 0.2, 2)])).toBe(2);
    });

    it('is order-independent in its total, over every permutation', () => {
        // Asserts an independently-known number, not the implementation's own answer to a second
        // question. The earlier version compared `count(reversed)` to `count(runs)` — it would have
        // passed against an implementation returning a constant, and it did pass against the
        // order-dependent greedy pass this rule replaced (review, 2026-08-06).
        const runs = [run('a', 0.2, 2), run('b', 0.3, 2), run('c', 0.2, 2), run('d', 0.2, 3)];
        const permute = <T>(items: readonly T[]): T[][] => items.length <= 1
            ? [[...items]]
            : items.flatMap((item, index) => permute([...items.slice(0, index), ...items.slice(index + 1)])
                .map((rest) => [item, ...rest]));

        const counts = permute(runs).map((ordering) => countSignificantMeasures(RULE, ordering));

        expect(counts).toHaveLength(24);
        // Three distinct configurations: (0.2, 2) twice, (0.3, 2), (0.2, 3).
        expect(new Set(counts)).toStrictEqual(new Set([3]));
    });

    it('counts a run that carries no modelInputs, reading the configuration from controls', () => {
        const bare = run('a', 0.2, 2);
        expect(bare.modelInputs).toBeUndefined();
        expect(countSignificantMeasures(RULE, [bare, run('b', 0.35, 2)])).toBe(2);
    });

    it('ignores a control the rule does not name as critical', () => {
        const spacingOnly: SignificanceRule = { criticalControlIds: ['slitSpacingMm'] };
        // Same spacing, different throw: significant under the authored rule, one under this one.
        expect(countSignificantMeasures(spacingOnly, [run('a', 0.2, 2), run('b', 0.2, 3)])).toBe(1);
        expect(countSignificantMeasures(RULE, [run('a', 0.2, 2), run('b', 0.2, 3)])).toBe(2);
    });

    it('counts on configuration alone, never on how close the two readings land', () => {
        // Two distinct configurations that happen to produce the same number are two distinguishing
        // measurements, not one. The model is deterministic, so a coincidence of readings is a fact
        // about the physics worth recording rather than a duplicate worth discarding — and any rule
        // that discarded it by comparing against the runs already counted would make the total depend
        // on recording order. That rule existed (`minimumResultDelta`) and was removed in review.
        const spacingOnly: SignificanceRule = { criticalControlIds: ['slitSpacingMm'] };
        expect(countSignificantMeasures(spacingOnly, [run('a', 0.2, 2, 3.0), run('b', 0.25, 2, 3.0)])).toBe(2);
    });

    it('counts a wavelength change at one arrangement as a distinguishing measurement', () => {
        // The reachable scenario the review found: two runs at (0.25, 2) unlock the advanced
        // wavelength, then a third at the same slit separation and throw on a different colour. It
        // moves the fringe spacing 4.4 → 3.6 mm, so calling it a repetition would be false.
        const withWavelength: SignificanceRule = { ...RULE, criticalModelInputIds: ['wavelengthNm'] };
        const runs = [runAtWavelength('a', 0.25, 2, 550), runAtWavelength('b', 0.25, 2, 450)];

        expect(countSignificantMeasures(withWavelength, runs)).toBe(2);
        // And without the rule naming it, the same two runs are one configuration — which is what
        // makes the authored `criticalModelInputIds` the thing doing the work here.
        expect(countSignificantMeasures(RULE, runs)).toBe(1);
    });

    it('gives a run with no modelInputs its own slot rather than colliding with a recorded wavelength', () => {
        const withWavelength: SignificanceRule = { ...RULE, criticalModelInputIds: ['wavelengthNm'] };
        const bare = run('a', 0.25, 2);
        expect(bare.modelInputs).toBeUndefined();

        // A fixture run's wavelength is unknown, not equal to 550. Counting them as one would let an
        // unknown silently satisfy the gate against a recorded value it may not match.
        expect(countSignificantMeasures(withWavelength, [bare, runAtWavelength('b', 0.25, 2, 550)])).toBe(2);
        expect(countSignificantMeasures(withWavelength, [bare, run('c', 0.25, 2)])).toBe(1);
    });

    it('returns the same count on repeated calls over the same runs', () => {
        // Not a determinism ritual: it pins that counting keeps no state between calls, which is what
        // lets a selector call it on every render without the count drifting.
        const runs = [run('a', 0.2, 2), run('b', 0.3, 2), run('c', 0.4, 2)];
        const counts = [1, 2, 3].map(() => countSignificantMeasures(definition.significanceRule, runs));
        expect(counts).toStrictEqual([3, 3, 3]);
    });
});

describe("Young's authored control space", () => {
    /**
     * Every adjacent pair of authored settings produces a visibly different reading — the smallest
     * single-step change anywhere inside the bounds moves the fringe spacing by ≈0.122 mm.
     *
     * This is what makes the colleague hints honest advice rather than a guess: "widen the openings
     * and measure again" only means something if the number the player writes down actually moves. If
     * an author retunes the bounds or the step so two adjacent settings stop being distinguishable,
     * this fails and says why.
     *
     * It previously existed to prove the authored `minimumResultDelta` never bound. That field was
     * removed in review (2026-08-06); the sweep is kept because the property it measures outlived it.
     */
    it('separates every adjacent pair of settings by a visible margin', () => {
        const [slit, screen] = definition.apparatus.primaryControls;
        const spacings: number[] = [];
        for (let d = slit.min; d <= slit.max + 1e-9; d += slit.step) spacings.push(Number(d.toFixed(4)));
        const distances: number[] = [];
        for (let l = screen.min; l <= screen.max + 1e-9; l += screen.step) distances.push(Number(l.toFixed(4)));

        let smallestStep = Number.POSITIVE_INFINITY;
        for (const screenDistanceM of distances) {
            for (let i = 1; i < spacings.length; i += 1) {
                smallestStep = Math.min(smallestStep, Math.abs(
                    spacing(spacings[i]!, screenDistanceM) - spacing(spacings[i - 1]!, screenDistanceM)
                ));
            }
        }
        for (const slitSpacingMm of spacings) {
            for (let i = 1; i < distances.length; i += 1) {
                smallestStep = Math.min(smallestStep, Math.abs(
                    spacing(slitSpacingMm, distances[i]!) - spacing(slitSpacingMm, distances[i - 1]!)
                ));
            }
        }

        expect(smallestStep).toBeCloseTo(0.122, 3);
    });
});

describe('isSignificantMeasureGateMet', () => {
    it('is unmet with nothing recorded', () => {
        expect(isSignificantMeasureGateMet(definition, [])).toBe(false);
    });

    it('is unmet with one recorded run', () => {
        expect(isSignificantMeasureGateMet(definition, [run('a', 0.2, 2)])).toBe(false);
    });

    it('is unmet with two runs at the same configuration', () => {
        expect(isSignificantMeasureGateMet(definition, [run('a', 0.2, 2), run('b', 0.2, 2)])).toBe(false);
    });

    it('is met with two runs at different configurations', () => {
        expect(isSignificantMeasureGateMet(definition, [run('a', 0.2, 2), run('b', 0.2, 3)])).toBe(true);
    });

    it('reads the required count from the authored requirements rather than a literal', () => {
        // The earlier version of this test asserted `definition.requirements.minimumSignificantRuns`
        // and never called the function it was filed under, so a hard-coded `count >= 2` — the exact
        // defect the title claims to prevent — passed it (review, 2026-08-06). Moving the authored bar
        // and watching the verdict follow is the only assertion that can tell the two apart.
        const twoConfigurations = [run('a', 0.2, 2), run('b', 0.2, 3)];
        const raised = { ...definition, requirements: { ...definition.requirements, minimumSignificantRuns: 3 } } as CaseDefinition;
        const lowered = { ...definition, requirements: { ...definition.requirements, minimumSignificantRuns: 1 } } as CaseDefinition;

        expect(isSignificantMeasureGateMet(definition, twoConfigurations)).toBe(true);
        expect(isSignificantMeasureGateMet(raised, twoConfigurations)).toBe(false);
        expect(isSignificantMeasureGateMet(lowered, [run('a', 0.2, 2)])).toBe(true);
    });
});
