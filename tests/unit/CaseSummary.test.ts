import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { LOCALES, type Locale } from '../../src/core/i18n/Locale';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import {
    AUTO_SUMMARY_PLACEHOLDERS, composeCaseSummary, summaryValues, templatePlaceholders,
    unfillableTemplateTokens, type CaseSummaryEvidence
} from '../../src/domain/evidence/caseSummary';
import { createRunRecord, runControlContract, type RunRecord } from '../../src/domain/evidence/RunRecord';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The neutral auto-summary (FR23, AC5), tested against the shipped Young content rather than a fixture —
 * the authored template, the authored significance rule and the authored source names all have to agree
 * with each other in the case that ships.
 *
 * The composer is pure, so this is a plain Vitest suite with no Phaser and no DOM (project-context,
 * Testing). The section it renders into is asserted end-to-end, where a DOM exists.
 */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

const run = (id: string, slitSpacingMm: number, screenDistanceM: number): RunRecord => {
    const record = createRunRecord({
        id,
        caseId: definition.id,
        controls: { slitSpacingMm, screenDistanceM },
        modelInputs: { slitSpacingMm, screenDistanceM, wavelengthNm: 550, wavelengthMode: 'minimum' },
        result: { label: 'Fringe spacing', value: 4.4, unit: 'mm' },
        timestamp: `2026-08-06T12:00:0${id.at(-1)}.000Z`,
        experimentModelVersion: definition.experiment.modelVersion
    }, runControlContract(definition));
    if (!record.ok) throw new Error('Fixture run must be valid.');
    return record.value;
};

const evidence = (partial: Partial<CaseSummaryEvidence> = {}): CaseSummaryEvidence =>
    ({ runs: [], inspectedSourceIds: [], decisionHistory: [], ...partial });

describe('the neutral auto-summary', () => {
    it('reports an untouched investigation without inventing anything', () => {
        // Zero runs is the state the record is most likely to be printed in by a facilitator setting up,
        // and the one where a summary is most tempted to editorialise. It states zeroes.
        const values = summaryValues(definition, evidence(), 'en');

        expect(values).toEqual({
            runCount: '0',
            configurationCount: '0',
            apparatusSettingCount: '0',
            sourceCount: '0',
            // The same "nothing here" floor `resolveLocalizedText` uses, so the record reads alike
            // throughout rather than printing an empty string or the word `undefined`.
            sourceNames: '—',
            revisionCount: '0'
        });
    });

    it('reports one observation as one configuration', () => {
        const values = summaryValues(definition, evidence({ runs: [run('run-1', 0.25, 2)] }), 'en');

        expect(values.runCount).toBe('1');
        expect(values.configurationCount).toBe('1');
    });

    it('separates the count of observations from the count of distinct configurations', () => {
        // The ≥2-significant case, and the one number a player cannot infer from the notebook length:
        // three runs at two arrangements is three observations and two configurations. Counted through
        // the case's own significance rule, not re-derived here.
        const runs = [run('run-1', 0.25, 2), run('run-2', 0.25, 2), run('run-3', 0.35, 2)];
        const values = summaryValues(definition, evidence({ runs }), 'en');

        expect(values.runCount).toBe('3');
        expect(values.configurationCount).toBe('2');
    });

    it('names the inspected sources in authored order, whatever order they were read in', () => {
        const [first, second] = definition.contextualArtifacts;
        const forward = summaryValues(definition, evidence({ inspectedSourceIds: [first!.id, second!.id] }), 'en');
        const reversed = summaryValues(definition, evidence({ inspectedSourceIds: [second!.id, first!.id] }), 'en');

        // Authored order on purpose: two players who read the same references in different orders have
        // the same evidence, and a record that said otherwise would be reporting their clicks.
        expect(forward.sourceNames).toBe(reversed.sourceNames);
        expect(forward.sourceNames).toContain(first!.displayName.en);
        expect(forward.sourceNames).toContain(second!.displayName.en);
        expect(forward.sourceCount).toBe('2');
    });

    it('counts only sources the case still authors, so the count matches the list beside it', () => {
        const values = summaryValues(definition, evidence({ inspectedSourceIds: ['a-source-this-case-no-longer-carries'] }), 'en');

        expect(values.sourceCount).toBe('0');
        expect(values.sourceNames).toBe('—');
    });

    it('counts recorded revisions of the conclusion', () => {
        const values = summaryValues(definition, evidence({ decisionHistory: [{ version: 1 }, { version: 2 }] }), 'en');

        expect(values.revisionCount).toBe('2');
    });

    it.each(LOCALES)('fills the authored template in %s, leaving no unresolved token', (locale: Locale) => {
        const runs = [run('run-1', 0.25, 2), run('run-2', 0.35, 2)];
        const summary = composeCaseSummary(definition, evidence({
            runs,
            inspectedSourceIds: definition.contextualArtifacts.map(({ id }) => id),
            decisionHistory: [{ version: 1 }]
        }), locale);

        // The failure this guards is precise: `interpolate` leaves an unsupplied `{token}` verbatim, so an
        // unfilled placeholder does not throw — it prints itself into the player's record.
        expect(summary).not.toMatch(/[{}]/);
        expect(summary).not.toContain('undefined');
        expect(summary.trim()).toBe(summary);
        expect(summary.length).toBeGreaterThan(0);
    });

    it('reads the two locales as different prose over the same evidence', () => {
        const shared = evidence({ runs: [run('run-1', 0.25, 2)], inspectedSourceIds: [definition.contextualArtifacts[0]!.id] });

        // Not merely "both are non-empty": a French player reading English is this project's most-repeated
        // defect (AC9), and an `autoSummary` whose `fr` was copied from `en` would pass every other
        // assertion in this file.
        expect(composeCaseSummary(definition, shared, 'fr')).not.toBe(composeCaseSummary(definition, shared, 'en'));
        expect(composeCaseSummary(definition, shared, 'fr')).toContain(definition.contextualArtifacts[0]!.displayName.fr);
    });

    it('joins several source names with each language’s own conjunction', () => {
        const ids = definition.contextualArtifacts.map(({ id }) => id);
        expect(definition.contextualArtifacts.length).toBeGreaterThan(1);

        expect(summaryValues(definition, evidence({ inspectedSourceIds: ids }), 'en').sourceNames).toContain(' and ');
        expect(summaryValues(definition, evidence({ inspectedSourceIds: ids }), 'fr').sourceNames).toContain(' et ');
    });

    it('never evaluates: no verdict, no defensibility, no ranking', () => {
        // ADR-006 and UX-DR5. The summary states what the player did; deciding whether it was *enough* is
        // the evaluator's and the rival lab's business, and leaking it here would tell the player which
        // conclusion to choose before they had reasoned about the evidence.
        const runs = [run('run-1', 0.25, 2), run('run-2', 0.35, 2)];
        const filled = LOCALES.map((locale) => composeCaseSummary(definition, evidence({
            runs,
            inspectedSourceIds: definition.contextualArtifacts.map(({ id }) => id),
            decisionHistory: [{ version: 1 }]
        }), locale).toLowerCase());

        const verdicts = /\b(correct|incorrect|wrong|right|well done|defensible|indefensible|sufficient|insufficient|best|better|should|excellent|bravo|correcte|incorrecte|juste|défendable|indéfendable|suffisant|insuffisante|meilleure|devriez)\b/;
        filled.forEach((summary) => expect(summary).not.toMatch(verdicts));
        // And no proposal's own claim text, which is the subtler leak: quoting one proposal into the
        // summary would rank it by attention even without an evaluative word anywhere.
        definition.conclusionProposals.forEach((proposal) => {
            filled.forEach((summary) => expect(summary).not.toContain(proposal.claim.en.toLowerCase()));
        });
    });

    it('names every value the shipped template asks for, and asks for nothing else', () => {
        // Both directions. Left to right catches an authored typo the schema would also catch; right to
        // left catches a placeholder the vocabulary offers and no case uses — dead contract surface.
        const authored = new Set(LOCALES.flatMap((locale) => templatePlaceholders(definition.autoSummary[locale])));

        authored.forEach((placeholder) => expect(AUTO_SUMMARY_PLACEHOLDERS).toContain(placeholder));
        expect([...AUTO_SUMMARY_PLACEHOLDERS].filter((placeholder) => !authored.has(placeholder))).toEqual([]);
    });
});

/**
 * The holes the Story 3.1 review found in the placeholder contract (2026-08-19).
 *
 * Each case below rendered a literal brace into the player's printable record before the fix, and each
 * was invisible to the old check because validation and substitution shared the composer's `\w+`: the
 * token was enumerated by neither, so there was nothing to reject and nothing to replace.
 */
describe('the placeholder contract, against what an author can actually write', () => {
    it.each([
        ['a kebab-case token, which is this project\'s own id convention', 'Observations: {run-count}.'],
        ['a dotted token', 'Observations: {run.count}.'],
        ['a padded token', 'Observations: { runCount }.'],
        ['an unclosed token', 'Observations: {runCount.'],
        // The inner token is well-formed, so the old validation passed it and substitution filled it —
        // rendering `{2}`, with the outer braces surviving as text.
        ['a doubled token', 'Observations: {{runCount}}.'],
        ['a well-formed unknown token', 'Observations: {runsRecorded}.']
    ])('rejects %s', (_case, template) => {
        expect(unfillableTemplateTokens(template)).not.toEqual([]);
    });

    it('accepts every placeholder the composer can fill, and the shipped template', () => {
        const everyToken = AUTO_SUMMARY_PLACEHOLDERS.map((name) => `{${name}}`).join(' ');

        expect(unfillableTemplateTokens(everyToken)).toEqual([]);
        LOCALES.forEach((locale) => {
            expect(unfillableTemplateTokens(definition.autoSummary[locale])).toEqual([]);
        });
    });

    it('never resolves a placeholder through the prototype chain', () => {
        // `values['constructor']` is a function rather than nullish, so a `?? match` fallback let
        // `{constructor}` render `function Object() { [native code] }` into the record. `Object.freeze`
        // does not sever the prototype, so the own-property check is the guard.
        const composed = composeCaseSummary(
            { ...definition, autoSummary: { en: 'Observations: {constructor}.', fr: 'Observations : {constructor}.' } },
            evidence(),
            'en'
        );

        expect(composed).toBe('Observations: {constructor}.');
        expect(composed).not.toContain('native code');
    });

    it('reports an unfillable token for both locales independently', () => {
        // The French rendering is not a copy of the English one and can carry its own typo.
        expect(unfillableTemplateTokens('Observations : {nombre-de-relevés}.')).not.toEqual([]);
    });
});

/**
 * Review decision 2c (2026-08-19): the record states configurations and apparatus settings separately,
 * because Young's significance rule names the wavelength as well as the two knobs — so a configuration
 * can change without the apparatus moving, and calling one the other told the player something they
 * could contradict by looking at the bench.
 */
describe('apparatus settings against critical configurations', () => {
    it('counts a new wavelength as a new configuration and the same apparatus setting', () => {
        const sameKnobs = [
            run('run-1', 0.25, 2),
            { ...run('run-2', 0.25, 2), modelInputs: { slitSpacingMm: 0.25, screenDistanceM: 2, wavelengthNm: 450 as const, wavelengthMode: 'advanced' as const } }
        ];
        const values = summaryValues(definition, evidence({ runs: sameKnobs }), 'en');

        expect(values.configurationCount).toBe('2');
        expect(values.apparatusSettingCount).toBe('1');
    });

    it('counts a moved knob as both', () => {
        const values = summaryValues(definition, evidence({ runs: [run('run-1', 0.25, 2), run('run-2', 0.35, 2)] }), 'en');

        expect(values.configurationCount).toBe('2');
        expect(values.apparatusSettingCount).toBe('2');
    });
});
