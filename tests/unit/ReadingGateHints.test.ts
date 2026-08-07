import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import type { ReadingGateHint } from '../../src/domain/cases/ColleagueCast';
import { selectReadingGateHint } from '../../src/domain/review/readingGateHints';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/** The authored Young content, so a line quietly dropped or misattributed fails here. */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

/** A definition carrying a hand-authored list, for the rules the shipped content cannot exercise. */
const withHints = (hints: readonly ReadingGateHint[]): CaseDefinition =>
    ({ ...definition, readingGateHints: hints }) as CaseDefinition;

const hint = (id: string, predicate: ReadingGateHint['predicate']): ReadingGateHint => Object.freeze({
    id,
    colleagueId: 'samuel-hart',
    predicate,
    line: Object.freeze({ en: `line for ${id}`, fr: `ligne pour ${id}` })
});

const artifactIds = (): readonly string[] => definition.contextualArtifacts.map(({ id }) => id);

describe('selectReadingGateHint', () => {
    it('returns nothing once every required reading is recorded, so no line is offered to a player who needs none', () => {
        expect(selectReadingGateHint(definition, artifactIds())).toBeUndefined();
    });

    it('names the first missing artifact when nothing has been read', () => {
        const selection = selectReadingGateHint(definition, []);
        const expected = definition.readingGateHints.find(
            ({ predicate }) => predicate.kind === 'missing-artifact' && predicate.artifactId === artifactIds()[0]
        );

        expect(expected, 'the shipped case must author a line for the first artifact').toBeDefined();
        expect(selection?.hintId).toBe(expected!.id);
    });

    it('names the other artifact once the first has been read', () => {
        const [first, second] = artifactIds();
        const selection = selectReadingGateHint(definition, [first!]);
        const expected = definition.readingGateHints.find(
            ({ predicate }) => predicate.kind === 'missing-artifact' && predicate.artifactId === second
        );

        expect(expected, 'the shipped case must author a line for the second artifact').toBeDefined();
        expect(selection?.hintId).toBe(expected!.id);
    });

    it('falls back to the floor when every specific predicate misses', () => {
        // A case whose only specific line names an artifact this case does not carry. Selection is
        // first-match in authored order, so the floor is the only thing left to say — which is exactly
        // the guarantee validation requires it to be authored for.
        const narrow = withHints([
            hint('names-nothing-here', { kind: 'missing-artifact', artifactId: 'an-artifact-this-case-does-not-carry' }),
            hint('floor', { kind: 'any-missing-reading' })
        ]);

        expect(selectReadingGateHint(narrow, [])?.hintId).toBe('floor');
    });

    it('prefers an earlier specific line over the later floor', () => {
        const [first] = artifactIds();
        const ordered = withHints([
            hint('specific', { kind: 'missing-artifact', artifactId: first! }),
            hint('floor', { kind: 'any-missing-reading' })
        ]);

        expect(selectReadingGateHint(ordered, [])?.hintId).toBe('specific');
        // The specific line withdraws itself the moment its artifact is read; the floor still applies
        // because the *other* artifact is outstanding.
        expect(selectReadingGateHint(ordered, [first!])?.hintId).toBe('floor');
    });

    it('takes the first authored line when two share a predicate, so authored order is the escalation order', () => {
        // A two-entry fixture, deliberately: with one line per predicate the assertion could not tell
        // "first" from "last" and would pass against either implementation.
        const duplicated = withHints([
            hint('first', { kind: 'any-missing-reading' }),
            hint('second', { kind: 'any-missing-reading' })
        ]);

        expect(selectReadingGateHint(duplicated, [])?.hintId).toBe('first');
    });

    it('returns undefined when no authored line applies rather than inventing one', () => {
        const narrow = withHints([hint('names-nothing-here', { kind: 'missing-artifact', artifactId: 'absent' })]);

        expect(selectReadingGateHint(narrow, [])).toBeUndefined();
    });

    it('treats an ineligible artifact as missing, exactly as context readiness does', () => {
        // `evaluateContextReadiness` counts an artifact as missing if it is *ineligible or uninspected*,
        // and this selector reuses it rather than re-deriving "missing". Inspecting an unreviewed
        // artifact would therefore still leave a line to say — the readiness rule and the colleague
        // must never disagree about what is outstanding.
        const [first, second] = definition.contextualArtifacts;
        const unreviewed = {
            ...definition,
            contextualArtifacts: [{ ...first, rightsStatus: 'incomplete' }, second],
            readingGateHints: [
                hint('specific', { kind: 'missing-artifact', artifactId: first.id }),
                hint('floor', { kind: 'any-missing-reading' })
            ]
        } as CaseDefinition;

        expect(selectReadingGateHint(unreviewed, [first.id, second.id])?.hintId).toBe('specific');
    });

    it('carries the authored text in both locales rather than a resolved string', () => {
        const selection = selectReadingGateHint(definition, []);
        const authored = definition.readingGateHints.find(({ id }) => id === selection?.hintId);

        expect(selection?.line).toStrictEqual(authored?.line);
        expect(selection?.line.en.length).toBeGreaterThan(0);
        expect(selection?.line.fr.length).toBeGreaterThan(0);
    });

    it('projects the hint id, the speaker, and the line, and nothing that could carry an answer', () => {
        const selection = selectReadingGateHint(definition, []);

        expect(Object.keys(selection ?? {}).sort()).toStrictEqual(['colleagueId', 'hintId', 'line']);
    });
});

describe('the authored Young reading-gate lines', () => {
    /** Every reading state a Young player can stand in while the context gate is unmet. */
    const reachableUnmetStates = (): readonly (readonly string[])[] => {
        const [first, second] = artifactIds();
        return [[], [first!], [second!]];
    };

    it('answers every reachable unmet state with an attributed line in both locales', () => {
        reachableUnmetStates().forEach((inspected) => {
            const selection = selectReadingGateHint(definition, inspected);

            expect(selection, `${inspected.length} reading(s) left the gate with nothing to say`).toBeDefined();
            expect(selection!.line.en.trim().length).toBeGreaterThan(0);
            expect(selection!.line.fr.trim().length).toBeGreaterThan(0);
            expect(definition.colleagues.some(({ id }) => id === selection!.colleagueId)).toBe(true);
        });
    });

    it('authors one specific line per contextual artifact, plus the floor, in that order', () => {
        const specifics = definition.readingGateHints.filter(({ predicate }) => predicate.kind === 'missing-artifact');
        const floors = definition.readingGateHints.filter(({ predicate }) => predicate.kind === 'any-missing-reading');

        expect(specifics.map(({ predicate }) => predicate.kind === 'missing-artifact' && predicate.artifactId).sort())
            .toStrictEqual([...artifactIds()].sort());
        expect(floors).toHaveLength(1);
        expect(definition.readingGateHints.at(-1)).toBe(floors[0]);
    });

    it('has no unreachable rung — every specific line can fire', () => {
        const fired = new Set(reachableUnmetStates()
            .map((inspected) => selectReadingGateHint(definition, inspected)?.hintId)
            .filter((hintId): hintId is string => hintId !== undefined));
        const specificIds = definition.readingGateHints
            .filter(({ predicate }) => predicate.kind === 'missing-artifact')
            .map(({ id }) => id);

        specificIds.forEach((id) => expect(fired.has(id), `${id} can never fire`).toBe(true));
    });

    it('attributes every line to a member of the cast, never to the rival lab', () => {
        expect(definition.readingGateHints.length).toBeGreaterThan(0);

        definition.readingGateHints.forEach(({ id, colleagueId }) => {
            const speaker = definition.colleagues.find((colleague) => colleague.id === colleagueId);

            expect(speaker, `${id} is attributed to nobody in the cast`).toBeDefined();
            expect(speaker?.name, `${id} speaks in the rival lab's voice`).not.toBe(definition.rivalLab.name);
        });
    });

    it('names the artifact it is about, in prose, in both locales', () => {
        // The thing that makes a specific line worth authoring at all: AC4 says the colleague "names
        // the missing artifact in-fiction". The schema checks the *predicate* points at a real
        // artifact; nothing checks the prose does — a line reading "read the other one" would pass
        // validation, satisfy the predicate, and tell the player nothing.
        //
        // A shared word of five characters or more between the line and that artifact's display name
        // in the same locale. Not a substring match on the whole name: display names are title-cased
        // noun phrases ("Opticks reference") that no colleague would say verbatim.
        const significantWords = (text: string): readonly string[] =>
            text.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 5).map((token) => token.toLocaleLowerCase());

        const specifics = definition.readingGateHints
            .filter(({ predicate }) => predicate.kind === 'missing-artifact');
        expect(specifics.length).toBeGreaterThan(0);

        specifics.forEach(({ id, predicate, line }) => {
            const artifact = definition.contextualArtifacts.find(({ id: artifactId }) =>
                predicate.kind === 'missing-artifact' && artifactId === predicate.artifactId);
            expect(artifact, `${id} names no authored artifact`).toBeDefined();

            (['en', 'fr'] as const).forEach((locale) => {
                const named = new Set(significantWords(artifact!.displayName[locale]));
                const spoken = significantWords(line[locale]);

                expect(spoken.some((token) => named.has(token)), `${id} (${locale}) never names its artifact`).toBe(true);
            });
        });
    });

    it('carries no punitive vocabulary in either locale', () => {
        const punitive = new RegExp(
            '(?:^|[^\\p{L}\\p{N}_])(?:score|timer|failed|failure|penalty|locked|forbidden|points'
            + '|échec|échoué|pénalité|verrouillé|verrouillée|interdit)(?=$|[^\\p{L}\\p{N}_])',
            'iu'
        );
        expect(punitive.test('un échec complet')).toBe(true);

        definition.readingGateHints.forEach(({ id, line }) => {
            expect(punitive.test(line.en), `${id} (en)`).toBe(false);
            expect(punitive.test(line.fr), `${id} (fr)`).toBe(false);
        });
    });
});
