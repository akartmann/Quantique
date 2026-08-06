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

const RULE: SignificanceRule = { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'], minimumResultDelta: 0.05 };

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

    it('is order-independent in its total', () => {
        const runs = [run('a', 0.2, 2), run('b', 0.3, 2), run('c', 0.2, 2)];
        expect(countSignificantMeasures(RULE, [...runs].reverse())).toBe(countSignificantMeasures(RULE, runs));
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

    it('rejects a distinct configuration whose reading is inside minimumResultDelta', () => {
        // Hand-set values rather than modelled ones: this is the delta rule in isolation.
        const coarse: SignificanceRule = { criticalControlIds: ['slitSpacingMm'], minimumResultDelta: 0.5 };
        expect(countSignificantMeasures(coarse, [run('a', 0.2, 2, 3.0), run('b', 0.25, 2, 3.2)])).toBe(1);
        expect(countSignificantMeasures(coarse, [run('a', 0.2, 2, 3.0), run('b', 0.25, 2, 3.9)])).toBe(2);
    });

    it('treats an absent minimumResultDelta as no delta requirement at all', () => {
        const noDelta: SignificanceRule = { criticalControlIds: ['slitSpacingMm'] };
        expect(countSignificantMeasures(noDelta, [run('a', 0.2, 2, 3.0), run('b', 0.25, 2, 3.0)])).toBe(2);
    });

    it('returns the same count on repeated calls over the same runs', () => {
        // Not a determinism ritual: it pins that counting keeps no state between calls, which is what
        // lets a selector call it on every render without the count drifting.
        const runs = [run('a', 0.2, 2), run('b', 0.3, 2), run('c', 0.4, 2)];
        const counts = [1, 2, 3].map(() => countSignificantMeasures(definition.significanceRule, runs));
        expect(counts).toStrictEqual([3, 3, 3]);
    });
});

describe("Young's authored minimumResultDelta", () => {
    /**
     * The authored delta is 0.05 mm and the smallest single-step change anywhere inside the authored
     * control bounds moves the fringe spacing by ≈0.122 mm, so rule 2 never binds for Young: every
     * distinct configuration is also a distinct reading. That is a claim the story makes, so it is a
     * claim a test has to hold — if an author retunes the bounds or the delta so that two adjacent
     * settings stop being distinguishable, this fails and says why.
     */
    it('is smaller than the smallest single-step change in the authored control space', () => {
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

        expect(smallestStep).toBeGreaterThan(definition.significanceRule.minimumResultDelta ?? 0);
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
        expect(definition.requirements.minimumSignificantRuns).toBe(2);
    });
});
