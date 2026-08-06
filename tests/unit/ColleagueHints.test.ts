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

    it('attributes every authored hint to a member of the cast, never to the rival lab', () => {
        // The earlier version compared `selection.colleagueId` against `rivalLab.name` — a kebab-case
        // ID against "Mr. Arthur Bell". `rivalLab` has no `id` field at all, so the two are drawn from
        // disjoint value spaces and the assertion could not fail even if a hint were deliberately put
        // in the challenger's voice (review, 2026-08-06). Comparing the resolved *name* is the check
        // that means something, and it runs over every authored hint rather than one selection.
        expect(definition.colleagueHints.length).toBeGreaterThan(0);

        definition.colleagueHints.forEach(({ id, colleagueId }) => {
            const speaker = definition.colleagues.find((colleague) => colleague.id === colleagueId);

            expect(speaker, `${id} is attributed to nobody in the cast`).toBeDefined();
            expect(speaker?.name, `${id} speaks in the rival lab's voice`).not.toBe(definition.rivalLab.name);
        });
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
            // A rule naming one critical control and a bar of three, deliberately. Under the shipped
            // rule this predicate's *false* branch is unreachable: both controls are critical, so any
            // variation opens the gate and `selectColleagueHint` short-circuits before the predicate
            // runs. `distinctValues` could have returned a constant 1 and every assertion here would
            // still have passed (review, 2026-08-06). Separating the bar from the variation is what
            // lets the predicate itself decide the outcome.
            const spacingOnly = {
                ...definition,
                requirements: { ...definition.requirements, minimumSignificantRuns: 3 },
                significanceRule: { criticalControlIds: ['slitSpacingMm'] },
                colleagueHints: [hint('spacing', { kind: 'unvaried-control', controlId: 'slitSpacingMm' })]
            } as CaseDefinition;

            // Gate unmet, spacing unvaried: true branch.
            expect(selectColleagueHint(spacingOnly, [run('a', 0.2, 2), run('b', 0.2, 3)])?.hintId).toBe('spacing');
            // Gate still unmet — two distinct spacings against a bar of three — but the spacing now
            // varies, so only the predicate can be producing this `undefined`.
            expect(selectColleagueHint(spacingOnly, [run('a', 0.2, 2), run('b', 0.3, 2)])).toBeUndefined();
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
    /**
     * Every evidence shape a Young player can actually stand in while the gate is unmet.
     *
     * The gate is unmet exactly when the recorded runs occupy fewer than two distinct critical
     * configurations — and the rule's critical dimensions cover both apparatus controls and the
     * wavelength. So an unmet gate means *every* run shares one arrangement, and the only degrees of
     * freedom left are how many runs there are.
     */
    const reachableUnmetShapes: readonly (readonly RunRecord[])[] = [
        [],
        [run('a', 0.2, 2)],
        [run('a', 0.2, 2), run('b', 0.2, 2)],
        [run('a', 0.2, 2), run('b', 0.2, 2), run('c', 0.2, 2)]
    ];

    it('has no unreachable escalation rung — every authored hint but the floor can fire', () => {
        // The defect this exists to catch (review, 2026-08-06): the case shipped five hints, two of
        // which no player could ever see. `unvaried-control: screenDistanceM` was shadowed in every
        // state by `unvaried-control: slitSpacingMm`, because an unmet gate leaves *both* controls
        // unvaried and selection is first-match. Two authored, translated, reviewed lines were dead.
        //
        // Reachability is not something a reader can see by looking at the array — it is a joint
        // property of the predicates, the authored order, and the significance rule. So it gets a test.
        const fired = new Set(reachableUnmetShapes
            .map((runs) => selectColleagueHint(definition, runs)?.hintId)
            .filter((hintId): hintId is string => hintId !== undefined));

        const floorIds = definition.colleagueHints
            .filter(({ predicate }) => predicate.kind === 'below-significant-measures')
            .map(({ id }) => id);
        const escalationIds = definition.colleagueHints
            .filter(({ predicate }) => predicate.kind !== 'below-significant-measures')
            .map(({ id }) => id);

        expect([...fired].sort()).toStrictEqual([...escalationIds].sort());
        // And the floor is the one deliberate exception: it cannot fire for Young precisely because
        // the rungs above it partition every reachable unmet state. It is authored, and required by
        // validation, so that a *future* case cannot author its way into a silent refusal.
        expect(floorIds).toHaveLength(1);
        expect(fired.has(floorIds[0]!)).toBe(false);
    });

    it('answers every reachable unmet shape with an attributed line in both locales', () => {
        reachableUnmetShapes.forEach((runs) => {
            const selection = selectColleagueHint(definition, runs);

            expect(selection, `${runs.length} run(s) left the gate with nothing to say`).toBeDefined();
            expect(selection!.line.en.length).toBeGreaterThan(0);
            expect(selection!.line.fr.length).toBeGreaterThan(0);
            expect(definition.colleagues.some(({ id }) => id === selection!.colleagueId)).toBe(true);
        });
    });

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
