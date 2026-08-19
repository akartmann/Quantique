import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import type { ConclusionProposal, ConclusionSupportPredicate } from '../../src/domain/cases/ColleagueCast';
import { createRunRecord, type RunRecord } from '../../src/domain/evidence/RunRecord';
import type { AuthoritativeEvidence } from '../../src/domain/theory/conclusionReadiness';
import { evaluateSupportPredicate, selectDefensibleConclusionIds } from '../../src/domain/theory/conclusionProposals';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/** The control set these fixture runs snapshot; `createRunRecord` validates against it (Story 3.1). */
const contract = { controlIds: ['slitSpacingMm', 'screenDistanceM'] };

const createRun = (id: string, slitSpacingMm = 0.25, screenDistanceM = 2): RunRecord => {
    const result = createRunRecord({
        id,
        caseId: 'young-interference',
        controls: { slitSpacingMm, screenDistanceM },
        result: { label: 'Fringe spacing', value: 4.4, unit: 'mm' },
        timestamp: '2026-08-06T12:00:00.000Z',
        experimentModelVersion: 'young-double-slit-v1'
    }, contract);
    if (!result.ok) throw new Error('Fixture run must be valid.');
    return result.value;
};

const evidence = (partial: Partial<AuthoritativeEvidence> = {}): AuthoritativeEvidence => ({
    runs: [],
    inspectedSourceIds: [],
    ...partial
});

/** The minimum Young path: two runs at different slit spacings, both reviewed sources inspected. */
const minimumYoungEvidence = (): AuthoritativeEvidence => evidence({
    runs: [createRun('run-1', 0.2), createRun('run-2', 0.3)],
    inspectedSourceIds: ['young-lecture-1801', 'newton-opticks']
});

const loadAuthoredYoungCase = async (): Promise<CaseDefinition> => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    return parsed.data as CaseDefinition;
};

describe('evaluateSupportPredicate', () => {
    it('never defends a `never` predicate, whatever the evidence', () => {
        expect(evaluateSupportPredicate({ kind: 'never' }, minimumYoungEvidence())).toBe(false);
        expect(evaluateSupportPredicate({ kind: 'never' }, evidence())).toBe(false);
    });

    it.each([
        ['at the threshold', 2, true],
        ['above the threshold', 1, true],
        ['below the threshold', 3, false]
    ])('evaluates minimum-runs %s', (_description, count, expected) => {
        const predicate: ConclusionSupportPredicate = { kind: 'minimum-runs', count };

        expect(evaluateSupportPredicate(predicate, evidence({ runs: [createRun('run-1'), createRun('run-2')] }))).toBe(expected);
    });

    it('holds varied-control only when the control took at least two distinct recorded values', () => {
        const predicate: ConclusionSupportPredicate = { kind: 'varied-control', controlId: 'slitSpacingMm' };

        expect(evaluateSupportPredicate(predicate, evidence({ runs: [createRun('run-1', 0.2), createRun('run-2', 0.3)] }))).toBe(true);
        // Same slit spacing twice, with only the *other* control varied: a replication, not a variation.
        expect(evaluateSupportPredicate(predicate, evidence({ runs: [createRun('run-1', 0.25, 2), createRun('run-2', 0.25, 3)] }))).toBe(false);
        expect(evaluateSupportPredicate(predicate, evidence({ runs: [createRun('run-1', 0.2)] }))).toBe(false);
    });

    it('holds inspected-source only for a source actually inspected', () => {
        const predicate: ConclusionSupportPredicate = { kind: 'inspected-source', sourceId: 'newton-opticks' };

        expect(evaluateSupportPredicate(predicate, evidence({ inspectedSourceIds: ['newton-opticks'] }))).toBe(true);
        expect(evaluateSupportPredicate(predicate, evidence({ inspectedSourceIds: ['young-lecture-1801'] }))).toBe(false);
    });

    it('holds all-of only when every child holds', () => {
        const satisfied: ConclusionSupportPredicate = {
            kind: 'all-of',
            predicates: [{ kind: 'minimum-runs', count: 2 }, { kind: 'inspected-source', sourceId: 'newton-opticks' }]
        };
        const unsatisfied: ConclusionSupportPredicate = {
            kind: 'all-of',
            predicates: [{ kind: 'minimum-runs', count: 2 }, { kind: 'inspected-source', sourceId: 'huygens-treatise' }]
        };

        expect(evaluateSupportPredicate(satisfied, minimumYoungEvidence())).toBe(true);
        expect(evaluateSupportPredicate(unsatisfied, minimumYoungEvidence())).toBe(false);
    });

    it('evaluates a nested all-of through both branches', () => {
        const nested = (sourceId: string): ConclusionSupportPredicate => ({
            kind: 'all-of',
            predicates: [
                { kind: 'minimum-runs', count: 2 },
                { kind: 'all-of', predicates: [{ kind: 'varied-control', controlId: 'slitSpacingMm' }, { kind: 'inspected-source', sourceId }] }
            ]
        });

        expect(evaluateSupportPredicate(nested('newton-opticks'), minimumYoungEvidence())).toBe(true);
        expect(evaluateSupportPredicate(nested('huygens-treatise'), minimumYoungEvidence())).toBe(false);
    });

    // An empty `all-of` is vacuously true, which is exactly why the schema rejects one. The
    // evaluator is a pure function over already-validated content, so it reports what the operator
    // means rather than second-guessing it — this pins that split so a later "safety" change is a
    // deliberate one.
    it('reports an empty all-of as vacuously true, leaving the rejection to the schema', () => {
        expect(evaluateSupportPredicate({ kind: 'all-of', predicates: [] }, evidence())).toBe(true);
    });
});

describe('selectDefensibleConclusionIds', () => {
    const definitionWith = (conclusionProposals: readonly ConclusionProposal[]): CaseDefinition =>
        ({ conclusionProposals } as CaseDefinition);

    it('returns only the proposals whose predicate holds, in authored order, frozen', () => {
        const definition = definitionWith([
            { id: 'c-1', colleagueId: 'a', claim: { en: 'a', fr: 'a' }, limitation: { en: 'a', fr: 'a' }, supportPredicate: { kind: 'minimum-runs', count: 2 } },
            { id: 'c-2', colleagueId: 'a', claim: { en: 'b', fr: 'b' }, limitation: { en: 'b', fr: 'b' }, supportPredicate: { kind: 'never' } },
            { id: 'c-3', colleagueId: 'a', claim: { en: 'c', fr: 'c' }, limitation: { en: 'c', fr: 'c' }, supportPredicate: { kind: 'varied-control', controlId: 'slitSpacingMm' } }
        ]);

        const defensible = selectDefensibleConclusionIds(definition, minimumYoungEvidence());

        expect(defensible).toEqual(['c-1', 'c-3']);
        expect(Object.isFrozen(defensible)).toBe(true);
    });

    it('leaves the authored Young set with a defensible conclusion on the minimum path', async () => {
        const definition = await loadAuthoredYoungCase();

        const defensible = selectDefensibleConclusionIds(definition, minimumYoungEvidence());

        expect(defensible).toContain('conclusion-spacing-varies');
        // The second conclusion needs the screen distance varied too, and the two overreaching ones
        // are `never` — so the minimum path defends exactly one.
        expect(defensible).toHaveLength(1);
    });

    it('defends nothing in the authored Young set at zero evidence', async () => {
        const definition = await loadAuthoredYoungCase();

        expect(selectDefensibleConclusionIds(definition, evidence())).toEqual([]);
    });

    it('defends the second authored conclusion once both controls have been varied', async () => {
        const definition = await loadAuthoredYoungCase();

        const defensible = selectDefensibleConclusionIds(definition, evidence({
            runs: [createRun('run-1', 0.2, 2), createRun('run-2', 0.3, 3)],
            inspectedSourceIds: ['young-lecture-1801', 'newton-opticks']
        }));

        expect(defensible).toEqual(['conclusion-spacing-varies', 'conclusion-both-settings']);
    });
});
