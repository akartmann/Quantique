import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import type { ColleagueHint } from '../../src/domain/cases/ColleagueCast';
import type { RunRecord } from '../../src/domain/evidence/RunRecord';
import { selectColleagueHint } from '../../src/domain/review/colleagueHints';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/** The authored Young content, so a hint quietly dropped or misattributed fails here. */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

const run = (id: string, slitSpacingMm: number, screenDistanceM: number): RunRecord => Object.freeze({
    id,
    caseId: 'young-interference',
    controls: Object.freeze({ slitSpacingMm, screenDistanceM }),
    result: Object.freeze({ label: 'Fringe spacing', value: (550e-3 * screenDistanceM) / slitSpacingMm, unit: 'mm' }),
    timestamp: '2026-08-06T10:00:00.000Z',
    experimentModelVersion: '1.0.0',
    linkedEvidenceIds: Object.freeze([])
});

/** A definition carrying a hand-authored hint list, for the rules the shipped content cannot exercise. */
const withHints = (hints: readonly ColleagueHint[]): CaseDefinition =>
    ({ ...definition, colleagueHints: hints }) as CaseDefinition;

const hint = (id: string, predicate: ColleagueHint['predicate']): ColleagueHint => Object.freeze({
    id,
    colleagueId: 'elias-wren',
    predicate,
    line: Object.freeze({ en: `line for ${id}`, fr: `ligne pour ${id}` })
});

describe('selectColleagueHint', () => {
    it('returns nothing once the gate is met, so no hint is offered to a player who needs none', () => {
        expect(selectColleagueHint(definition, [run('a', 0.2, 2), run('b', 0.3, 2)])).toBeUndefined();
    });

    it('selects a hint when nothing is recorded', () => {
        const selection = selectColleagueHint(definition, []);

        expect(selection).toBeDefined();
        expect(definition.colleagueHints.some(({ id }) => id === selection?.hintId)).toBe(true);
    });

    it('always has something to say for every unmet-gate evidence shape the player can reach', () => {
        const shapes: readonly (readonly RunRecord[])[] = [
            [],
            [run('a', 0.2, 2)],
            [run('a', 0.2, 2), run('b', 0.2, 2)],
            [run('a', 0.2, 2), run('b', 0.2, 2), run('c', 0.2, 2)]
        ];

        shapes.forEach((runs) => expect(selectColleagueHint(definition, runs)).toBeDefined());
    });

    it('carries the authored text in both locales rather than a resolved string', () => {
        const selection = selectColleagueHint(definition, []);
        const authored = definition.colleagueHints.find(({ id }) => id === selection?.hintId);

        expect(selection?.line).toStrictEqual(authored?.line);
        expect(selection?.line.en.length).toBeGreaterThan(0);
        expect(selection?.line.fr.length).toBeGreaterThan(0);
    });

    it('attributes the hint to an authored colleague, never to the rival lab', () => {
        const selection = selectColleagueHint(definition, [run('a', 0.2, 2)]);

        expect(definition.colleagues.some(({ id }) => id === selection?.colleagueId)).toBe(true);
        expect(selection?.colleagueId).not.toBe(definition.rivalLab.name);
    });

    it('never carries a defensibility field or a conclusion claim', () => {
        const selection = selectColleagueHint(definition, [run('a', 0.2, 2)]);

        expect(Object.keys(selection ?? {}).sort()).toStrictEqual(['colleagueId', 'hintId', 'line']);
        definition.conclusionProposals.forEach(({ claim }) => {
            expect(selection?.line.en).not.toContain(claim.en);
            expect(selection?.line.fr).not.toContain(claim.fr);
        });
    });

    describe('predicate semantics', () => {
        it('matches no-recorded-runs only with an empty notebook', () => {
            const single = withHints([hint('empty', { kind: 'no-recorded-runs' })]);

            expect(selectColleagueHint(single, [])?.hintId).toBe('empty');
            expect(selectColleagueHint(single, [run('a', 0.2, 2)])).toBeUndefined();
        });

        it('matches repeated-configuration only when two runs share a critical configuration', () => {
            const single = withHints([hint('repeat', { kind: 'repeated-configuration' })]);

            expect(selectColleagueHint(single, [run('a', 0.2, 2), run('b', 0.2, 2)])?.hintId).toBe('repeat');
            // One run cannot repeat anything, and a varied pair meets the gate outright.
            expect(selectColleagueHint(single, [run('a', 0.2, 2)])).toBeUndefined();
        });

        it('matches unvaried-control only while every run shares that control value', () => {
            const single = withHints([hint('spacing', { kind: 'unvaried-control', controlId: 'slitSpacingMm' })]);

            // Two runs, same spacing, different throw: the gate is met, so no hint at all.
            expect(selectColleagueHint(single, [run('a', 0.2, 2), run('b', 0.2, 3)])).toBeUndefined();
            // One run: spacing is trivially unvaried and the gate is unmet.
            expect(selectColleagueHint(single, [run('a', 0.2, 2)])?.hintId).toBe('spacing');
        });

        it('matches below-significant-measures for every unmet-gate shape, as the catch-all floor', () => {
            const single = withHints([hint('floor', { kind: 'below-significant-measures' })]);

            expect(selectColleagueHint(single, [])?.hintId).toBe('floor');
            expect(selectColleagueHint(single, [run('a', 0.2, 2)])?.hintId).toBe('floor');
            expect(selectColleagueHint(single, [run('a', 0.2, 2), run('b', 0.2, 2)])?.hintId).toBe('floor');
        });
    });

    it('takes the first authored hint when two share a predicate, so authored order is the escalation order', () => {
        // A two-hint fixture, deliberately: with one hint per predicate the assertion could not tell
        // "first" from "last" and would pass against either implementation (the vacuous-test defect
        // the 2.5 review found in RivalLabRules.test.ts).
        const duplicated = withHints([
            hint('first', { kind: 'below-significant-measures' }),
            hint('second', { kind: 'below-significant-measures' })
        ]);

        expect(selectColleagueHint(duplicated, [run('a', 0.2, 2)])?.hintId).toBe('first');
    });

    it('prefers an earlier specific hint over a later catch-all', () => {
        const ordered = withHints([
            hint('specific', { kind: 'no-recorded-runs' }),
            hint('floor', { kind: 'below-significant-measures' })
        ]);

        expect(selectColleagueHint(ordered, [])?.hintId).toBe('specific');
        expect(selectColleagueHint(ordered, [run('a', 0.2, 2)])?.hintId).toBe('floor');
    });

    it('returns undefined when no authored hint applies rather than inventing one', () => {
        const narrow = withHints([hint('empty-only', { kind: 'no-recorded-runs' })]);

        expect(selectColleagueHint(narrow, [run('a', 0.2, 2)])).toBeUndefined();
    });
});

describe('the authored Young hints', () => {
    it('name a measurement or a variable rather than a conclusion', () => {
        // Not a style check: a hint that supplies the answer breaks AC2 and the project rule that
        // hints "point at missing evidence, a source, an observable, or a test — never the answer".
        const answerWords = /(?:^|[^\p{L}])(?:conclusion|therefore|proves?|prouve|donc|conclure|choisissez|choose)(?=$|[^\p{L}])/iu;

        definition.colleagueHints.forEach(({ id, line }) => {
            expect(answerWords.test(line.en), `${id} (en)`).toBe(false);
            expect(answerWords.test(line.fr), `${id} (fr)`).toBe(false);
        });
    });

    it('carry no punitive vocabulary in either locale', () => {
        // The `u` flag with explicit boundaries, not `\b`: `\b` is ASCII-defined, so `/\béchec\b/`
        // never matches inside "un échec" and half the French guard would be dead (2.5 review).
        const punitive = new RegExp(
            '(?:^|[^\\p{L}\\p{N}_])(?:score|timer|attempt|failed|failure|penalty|locked|points'
            + '|échec|échoué|pénalité|verrouillé|verrouillée|essai|tentative)(?=$|[^\\p{L}\\p{N}_])',
            'iu'
        );
        // Proof the guard is live rather than an unmatchable pattern.
        expect(punitive.test('un échec complet')).toBe(true);

        definition.colleagueHints.forEach(({ id, line }) => {
            expect(punitive.test(line.en), `${id} (en)`).toBe(false);
            expect(punitive.test(line.fr), `${id} (fr)`).toBe(false);
        });
    });
});
