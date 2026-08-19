import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_LOCALE, isLocale, LOCALES } from '../../src/core/i18n/Locale';
import { resolveBrowserLocale } from '../../src/core/i18n/resolveBrowserLocale';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { createTranslator, translate, translateError } from '../../src/core/i18n/translate';
import { formatMeasurement, formatNumber } from '../../src/core/i18n/formatNumber';
import { resolveLocalizedText, resolveLocalizedTextList } from '../../src/core/i18n/resolveLocalizedText';
import { ReviewerStateSchema, SourceProvenanceCategorySchema, SourceRightsStatusSchema, SourceRoleSchema, SourceTypeSchema } from '../../src/schemas/CaseDefinitionSchema';
import { LEDGER_BLOCKER_KINDS } from '../../src/domain/sources/releaseApproval';
import { RECOGNITION_IDS } from '../../src/domain/recognition/recognitionRules';

/** U+202F. Asserted as a code point: a plain space would pass locally and drift across ICU builds. */
const NARROW_NO_BREAK_SPACE = '\u202F';

describe('locale resources', () => {
    it('exposes exactly the supported locales', () => {
        expect(LOCALES).toEqual(['en', 'fr']);
        expect(DEFAULT_LOCALE).toBe('en');
        expect(isLocale('fr')).toBe(true);
        expect(isLocale('de')).toBe(false);
        expect(isLocale(undefined)).toBe(false);
    });

    // AC7: `tsc` only proves fr ⊇ en. This asserts the reverse direction too.
    it('defines every key in both locales', () => {
        const englishKeys = Object.keys(en).sort();
        const frenchKeys = Object.keys(fr).sort();
        expect(frenchKeys).toEqual(englishKeys);
    });

    it('never ships an empty or whitespace-only value', () => {
        const blank = [...Object.entries(en), ...Object.entries(fr)]
            .filter(([, value]) => value.trim().length === 0)
            .map(([key]) => key);
        expect(blank).toEqual([]);
    });

    /**
     * The reading room's whole interface surface, named key by key (Story 2.8, AC8).
     *
     * The two tests above are symmetry checks: they prove `en` and `fr` agree and that nothing shipped
     * blank. Neither can notice a key that was **never authored** — a surface deleted from both
     * bundles passes both of them, and "chrome gets localized and content does not" is the defect this
     * project repeats most often.
     *
     * This is also where AC8's "asserted present in English **and** French" is actually met for the
     * room. Canvas text cannot be read from the DOM, so a Playwright spec cannot assert it; the
     * division of labour is bundle completeness here, authored-content locales in
     * `ReadingGateHints.test.ts` and `CaseDefinition.test.ts`, and French *widths* in
     * `french-typography.spec.ts`. `canvas-transitions.spec.ts` documents the same split in its header.
     */
    it('authors every string the reading room draws, in both locales', () => {
        const READING_ROOM_KEYS = [
            'library.heading',
            'library.guide',
            'library.artifact.read',
            'library.detail.creator',
            'library.detail.classification',
            'library.detail.rights',
            'library.artifact.unavailable',
            'library.artifact.noRendition',
            // The bench's reference shelf, which the same story added.
            'lab.reference.heading'
        ] as const;

        READING_ROOM_KEYS.forEach((key) => {
            expect(en[key], `${key} (en)`).toBeDefined();
            expect(en[key].trim().length, `${key} (en) is blank`).toBeGreaterThan(0);
            expect(fr[key], `${key} (fr)`).toBeDefined();
            expect(fr[key].trim().length, `${key} (fr) is blank`).toBeGreaterThan(0);
            // A French value byte-identical to its English one is almost always an untranslated
            // placeholder. `library.detail.classification` is the deliberate exception: it is pure
            // punctuation around two already-localized values.
            if (key !== 'library.detail.classification') {
                expect(fr[key], `${key} was never translated`).not.toBe(en[key]);
            }
        });
    });

    /**
     * Character staging's own interface surface (Story 2.9).
     *
     * One key, and it still gets a named assertion, for the reason the reading room's list above
     * exists: the symmetry checks prove `en` and `fr` agree and that nothing shipped blank, and neither
     * can notice a key that was **never authored** — a surface missing from both bundles passes both of
     * them. "Chrome gets localized and content does not" is this project's most-repeated defect, and
     * every new content surface is supposed to join this file with the story that introduces it rather
     * than with the review that finds the gap.
     *
     * The figures' *names* are canonical proper nouns from `case.json` and are deliberately not here;
     * their *roles* resolve through the `colleague.role.*` family, which the cast tests already cover.
     */
    it('authors the staging marker in both locales', () => {
        expect(en['stage.speaking'].trim().length).toBeGreaterThan(0);
        expect(fr['stage.speaking'].trim().length).toBeGreaterThan(0);
        expect(fr['stage.speaking']).not.toBe(en['stage.speaking']);
    });

    /**
     * The enum families the detail panel resolves rather than re-authoring.
     *
     * AC3 requires the source type, provenance category, and rights status to be readable **as text**
     * — never as colour alone. The panel renders them through these shared `source.*` keys, so a
     * missing one would leave a player reading a raw enum value or an empty line where the rights
     * status should be.
     */
    it('authors a readable label for every source type, provenance category, and rights status', () => {
        // Derived from the schema, never transcribed: a hand-copied roster stops being updated, and a
        // fourth provenance category would leave this test green while a player read a blank rights
        // line or a raw enum value in the detail panel — the exact failure it exists to prevent.
        //
        // Story 3.3 adds the two ledger families on the same terms. `ReviewerStateSchema` and
        // `SourceRoleSchema` are exported for exactly this: the ledger resolves every reviewer state and
        // source role through a key, so a fourth reviewer state would leave a reviewer reading a raw
        // `de-scoped` in a rights table. The rights statuses are deliberately **not** duplicated into a
        // `ledger.rights.*` family — the ledger resolves the `source.rights.*` keys already listed here,
        // which is why one vocabulary answers "may we ship this" on every surface that asks.
        const required = [
            ...SourceTypeSchema.options.map((value) => `source.type.${value}` as const),
            ...SourceProvenanceCategorySchema.options.map((value) => `source.provenanceName.${value}` as const),
            ...SourceRightsStatusSchema.options.map((value) => `source.rights.${value}` as const),
            ...ReviewerStateSchema.options.map((value) => `ledger.reviewer.${value}` as const),
            ...SourceRoleSchema.options.map((value) => `ledger.role.${value}` as const)
        ];

        // The derivation must be live, and **this is the assertion that checks it** — the previous one
        // could not. It compared `required.length` against the sum of the same five `.options.length`
        // values it was built from, which is that sum by construction: had `ReviewerStateSchema.options`
        // resolved to `[]`, the left side would drop 3, the right side would drop 3, and it would stay
        // green while the ledger rendered a raw `de-scoped` at a reviewer. Its comment claimed it caught
        // exactly that, which made it an instance of the comment-vs-guarantee defect it invoked.
        //
        // Each enum is checked for emptiness on its own, so no other enum's members can cover for it, and
        // the loop below is what proves the keys exist.
        [
            ['SourceTypeSchema', SourceTypeSchema],
            ['SourceProvenanceCategorySchema', SourceProvenanceCategorySchema],
            ['SourceRightsStatusSchema', SourceRightsStatusSchema],
            ['ReviewerStateSchema', ReviewerStateSchema],
            ['SourceRoleSchema', SourceRoleSchema]
        ].forEach(([name, schema]) => {
            expect((schema as { options: readonly string[] }).options.length, `${name as string} resolved to no members`)
                .toBeGreaterThan(0);
        });

        required.forEach((key) => {
            expect(en[key], `${key} (en)`).toBeDefined();
            expect(fr[key], `${key} (fr)`).toBeDefined();
        });
    });

    /**
     * Every blocker kind the release gate can emit has a sentence in both locales.
     *
     * Derived from `LEDGER_BLOCKER_KINDS` rather than transcribed, on the same terms as the roster above
     * and for a sharper reason: the code review added two kinds to the union
     * (`accessibility-review-pending`, `accessible-controls-reference-pending`) because the gate had been
     * *assuming* two of its five roles were de-scoped rather than checking them. Neither string renders on
     * either shipped case today, since both author `de-scoped` — so a missing key here would be found by
     * the first reviewer to open a ledger after ADR-008 is revisited, which is exactly the wrong moment.
     */
    it('authors a readable sentence for every release blocker kind', () => {
        expect(LEDGER_BLOCKER_KINDS.length).toBeGreaterThan(0);

        LEDGER_BLOCKER_KINDS.forEach((kind) => {
            const key = `ledger.blocker.${kind}` as 'ledger.blocker.source-rights-incomplete';
            expect(en[key], `${key} (en)`).toBeDefined();
            expect(fr[key], `${key} (fr)`).toBeDefined();
            // The subject placeholder is what makes a blocker name its row rather than a category.
            expect(en[key], `${key} (en) names its subject`).toContain('{subject}');
            expect(fr[key], `${key} (fr) names its subject`).toContain('{subject}');
        });
    });

    /**
     * The debrief and the case file (Story 2.11) — the last two content surfaces on `EXPERIENCE.md`'s
     * own EN+FR list.
     *
     * Named rather than left to the symmetry checks above, for the reason the reading room's list
     * exists: those prove `en` and `fr` agree and that nothing shipped blank, and neither can notice a
     * key that was **never authored** — a surface missing from both bundles passes both of them.
     *
     * The eight `recognition.*` keys are in this list on purpose. They have shipped in both bundles
     * since Story 1.9 and **nothing resolved them** until the debrief did; `deriveRecognition` emits
     * canonical English into the persisted record and the display resolves by stable id, so a bundle
     * gap here would have shown a French player four English labels with no test able to see it.
     */
    it('authors every string the debrief and the case file draw, in both locales', () => {
        const CANVAS_DEBRIEF_KEYS = [
            'debrief.heading',
            'debrief.sources.heading',
            'debrief.sources.line',
            'debrief.deeperTheory.show',
            'debrief.deeperTheory.hide',
            'debrief.recognition.heading',
            'debrief.recognition.intro',
            'debrief.recognition.achieved',
            'debrief.recognition.notRecorded',
            'debrief.critiques.heading',
            'debrief.critiques.headingCounted',
            'debrief.critiques.empty',
            'debrief.critiques.earlier',
            'debrief.critiques.later',
            'debrief.record.unavailable',
            'caseFile.open',
            'caseFile.heading',
            'caseFile.guide',
            'caseFile.close',
            'caseFile.observations.heading',
            'caseFile.observations.empty',
            'caseFile.observation',
            'caseFile.observation.detail',
            'caseFile.sources.heading',
            'caseFile.sources.empty',
            'caseFile.source.detail',
            'caseFile.pin',
            'caseFile.unpin',
            'caseFile.page.earlier',
            'caseFile.page.later',
            'caseFile.page.counter',
            'caseFile.readiness.heading',
            'caseFile.readiness.complete',
            'caseFile.review.heading',
            'caseFile.review.request',
            'caseFile.review.save',
            'caseFile.review.none',
            'caseFile.review.notRequested',
            'caseFile.review.issue',
            'caseFile.review.saved',
            // Resolved for the first time by the debrief. Shipped and dead since Story 1.9.
            ...RECOGNITION_IDS.flatMap((id) => [
                `recognition.${id}.label` as const,
                `recognition.${id}.description` as const
            ]),
            // AC6's split: the ordering failure stopped sharing a message with the malformed stamp.
            'error.completion-timestamp-not-later',
            'error.invalid-completion-timestamp'
        ] as const;

        CANVAS_DEBRIEF_KEYS.forEach((key) => {
            expect(en[key], `${key} (en)`).toBeDefined();
            expect(en[key].trim().length, `${key} (en) is blank`).toBeGreaterThan(0);
            expect(fr[key], `${key} (fr)`).toBeDefined();
            expect(fr[key].trim().length, `${key} (fr) is blank`).toBeGreaterThan(0);
            // A French value byte-identical to its English one is almost always an untranslated
            // placeholder. Four are deliberate exceptions, and each is stated rather than waved
            // through: three are pure punctuation around values that are already localized where they
            // are produced, and `caseFile.observation` is a cognate — "Observation {order}" is correct
            // French, and `notebook.observation` has carried the same identical pair since Story 2.10.
            const IDENTICAL_BY_DESIGN = [
                'debrief.sources.line',
                'caseFile.observation.detail',
                'caseFile.source.detail',
                'caseFile.review.issue',
                'caseFile.observation'
            ];
            if (!IDENTICAL_BY_DESIGN.includes(key)) {
                expect(fr[key], `${key} was never translated`).not.toBe(en[key]);
            }
        });
    });

    /**
     * AC7's readiness list, localized by requirement `code` rather than from the domain's dev-facing
     * `missing[].message`.
     *
     * Derived from the bundle's own prefix, which proves parity and non-emptiness but **cannot** prove
     * the roster is complete — a code the domain emits and neither bundle authors would leave this
     * green while the case file showed a humanised key. That half is covered where it can be:
     * `tests/integration/ConclusionSupport.test.ts` drives the store into each readiness state and
     * asserts the projection never falls back, in both locales. `MissingConclusionRequirementCode` is
     * a type union with no runtime counterpart, and `src/domain/**` is out of this story's scope, so
     * exporting one is a later story's change rather than a workaround here.
     */
    it('authors every conclusion-readiness line it ships, in both locales', () => {
        const readinessKeys = Object.keys(en)
            .filter((key) => key.startsWith('conclusion.missing.')) as (keyof typeof en)[];

        // The derivation must be live: a prefix that matched nothing would make the loop vacuous.
        expect(readinessKeys.length).toBeGreaterThan(0);
        readinessKeys.forEach((key) => {
            expect(en[key].trim().length, `${key} (en)`).toBeGreaterThan(0);
            expect(fr[key].trim().length, `${key} (fr)`).toBeGreaterThan(0);
            expect(fr[key], `${key} was never translated`).not.toBe(en[key]);
        });
    });

    /**
     * AC2's four provenance categories, all four of which the debrief must be able to name.
     *
     * The shipped Young case authors two artifacts and both are `primary-material`, so **shipped
     * content exercises one of the four**. The vocabulary is therefore covered by deriving from the
     * schema's own `.options` rather than from the case — transcribing three Zod enum families instead
     * of deriving from them was a 2.8 review patch, and this is the same trade one story later.
     *
     * The debrief renders `source.provenanceName.*` (the capitalised noun) beside every citation, not
     * `source.provenance.*` (the lower-case phrase the print view interpolates mid-sentence). Both
     * families are checked above; this one asserts the debrief's own is complete and distinct.
     */
    it('names all four provenance categories the debrief can cite, in both locales', () => {
        const categories = SourceProvenanceCategorySchema.options;
        expect(categories.length).toBe(4);

        const labels = categories.map((category) => `source.provenanceName.${category}` as const);
        labels.forEach((key) => {
            expect(en[key].trim().length, `${key} (en)`).toBeGreaterThan(0);
            expect(fr[key].trim().length, `${key} (fr)`).toBeGreaterThan(0);
            expect(fr[key], `${key} was never translated`).not.toBe(en[key]);
        });
        // Four distinct labels, not one repeated: a copy-paste that gave two categories the same noun
        // would leave a reader unable to tell a reconstruction from a deliberate fiction, which is the
        // distinction AC2 exists to preserve.
        expect(new Set(labels.map((key) => fr[key])).size).toBe(categories.length);
        expect(new Set(labels.map((key) => en[key])).size).toBe(categories.length);
    });

    it('keeps the same interpolation parameters in both locales', () => {
        const params = (value: string): string[] => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
        const mismatched = Object.keys(en).filter((key) => {
            const typedKey = key as keyof typeof en;
            return JSON.stringify(params(en[typedKey])) !== JSON.stringify(params(fr[typedKey]));
        });
        expect(mismatched).toEqual([]);
    });
});

describe('translate', () => {
    it('resolves the active locale', () => {
        expect(translate('fr', 'boot.title')).toBe(fr['boot.title']);
        expect(translate('en', 'boot.title')).toBe(en['boot.title']);
    });

    it('falls back to English when the active locale misses a key', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const incomplete = { ...fr, 'boot.title': undefined } as unknown as typeof fr;
        expect(translate('fr', 'boot.title', undefined, { fr: incomplete })).toBe(en['boot.title']);
        warn.mockRestore();
    });

    it('never returns a raw key or an empty string for an unknown key', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const resolved = translate('fr', 'totally.unknown.slitSpacingMm' as keyof typeof en);
        expect(resolved.trim().length).toBeGreaterThan(0);
        expect(resolved).not.toContain('totally.unknown');
        expect(resolved).toBe('Slit spacing mm');
        warn.mockRestore();
    });

    it('warns with i18n.missingKey on any fallback', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        translate('fr', 'another.unknown.key' as keyof typeof en);
        expect(warn).toHaveBeenCalledWith('i18n.missingKey', { key: 'another.unknown.key', locale: 'fr' });
        warn.mockRestore();
    });

    it('never puts player-entered text in the missing-key warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        translate('fr', 'unknown.key' as keyof typeof en, { conclusion: 'a learner sentence' });
        expect(JSON.stringify(warn.mock.calls)).not.toContain('a learner sentence');
        warn.mockRestore();
    });

    it('interpolates named parameters', () => {
        expect(translate('en', 'lab.control.readout', { label: 'Slit spacing', value: '0.25 mm' }))
            .toBe('Slit spacing: 0.25 mm');
        expect(translate('fr', 'lab.control.readout', { label: 'Écartement des fentes', value: '0,25 m' }))
            .toBe('Écartement des fentes : 0,25 m');
    });

    it('leaves an unsupplied placeholder untouched rather than printing undefined', () => {
        expect(translate('en', 'lab.control.readout', { label: 'Slit spacing' })).toContain('{value}');
    });

    it('binds a locale through createTranslator', () => {
        const t = createTranslator('fr');
        expect(t('boot.title')).toBe(fr['boot.title']);
    });
});

describe('resolveLocalizedText fallback floor', () => {
    // The same contract as `translate`: never `undefined` and never an empty string. A Phaser
    // `setText(undefined)` prints "undefined" to the player, and `.join()` on an absent list throws.
    it('returns a placeholder rather than undefined when a degraded case is missing both locales', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const degraded = { fr: '   ' } as unknown as { en: string; fr: string };

        const resolved = resolveLocalizedText(degraded, 'fr');

        expect(resolved).toBeTypeOf('string');
        expect(resolved.length).toBeGreaterThan(0);
        warn.mockRestore();
    });

    it('returns an empty array rather than undefined for a degraded list', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const degraded = { fr: [] } as unknown as { en: readonly string[]; fr: readonly string[] };

        expect(resolveLocalizedTextList(degraded, 'fr')).toEqual([]);
        expect(() => resolveLocalizedTextList(degraded, 'fr').join(' ')).not.toThrow();
        warn.mockRestore();
    });
});

describe('translateError', () => {
    it('localizes a Result error by its stable code', () => {
        expect(translateError('fr', { code: 'persistence-unavailable', message: 'dev-facing default' }))
            .toBe(fr['error.persistence-unavailable']);
    });

    it('falls back to the dev-facing message for an unmapped code', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(translateError('fr', { code: 'not-a-mapped-code', message: 'dev-facing default' }))
            .toBe('dev-facing default');
        warn.mockRestore();
    });

    it('interpolates error parameters', () => {
        const resolved = translateError('en', { code: 'missing-contextual-sources', message: 'x' }, { label: 'The Opticks reference' });
        expect(resolved).toContain('The Opticks reference');
    });
});

describe('formatMeasurement', () => {
    it('formats English with a dot decimal and a plain space', () => {
        expect(formatMeasurement('en', 0.25, 2, 'mm')).toBe('0.25 mm');
    });

    it('formats French with a comma decimal and a narrow no-break space before the unit', () => {
        expect(formatMeasurement('fr', 0.25, 2, 'mm')).toBe(`0,25${NARROW_NO_BREAK_SPACE}mm`);
    });

    it('keeps authored precision including trailing zeros', () => {
        expect(formatMeasurement('en', 2, 2, 'm')).toBe('2.00 m');
        expect(formatMeasurement('fr', 2, 2, 'm')).toBe(`2,00${NARROW_NO_BREAK_SPACE}m`);
        expect(formatMeasurement('en', 1.5, 0, 'm')).toBe('2 m');
    });

    it('formats a bare number without a unit', () => {
        expect(formatNumber('en', 1.5, 1)).toBe('1.5');
        expect(formatNumber('fr', 1.5, 1)).toBe('1,5');
    });

    it('is stable across repeated calls (cached formatters)', () => {
        expect(formatMeasurement('fr', 0.3, 2, 'mm')).toBe(formatMeasurement('fr', 0.3, 2, 'mm'));
    });
});

describe('resolveLocalizedText', () => {
    it('resolves the active locale', () => {
        expect(resolveLocalizedText({ en: 'Slit spacing', fr: 'Écartement des fentes' }, 'fr')).toBe('Écartement des fentes');
    });

    it('falls back to English when the localized value is blank', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(resolveLocalizedText({ en: 'Slit spacing', fr: '   ' }, 'fr')).toBe('Slit spacing');
        warn.mockRestore();
    });

    it('resolves list variants', () => {
        expect(resolveLocalizedTextList({ en: ['a', 'b'], fr: ['x', 'y'] }, 'fr')).toEqual(['x', 'y']);
    });

    it('falls back to the English list when the localized list is empty', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(resolveLocalizedTextList({ en: ['a', 'b'], fr: [] }, 'fr')).toEqual(['a', 'b']);
        warn.mockRestore();
    });
});

describe('resolveBrowserLocale', () => {
    it.each([
        ['an exact supported tag', ['fr'], 'fr'],
        ['a regional variant', ['fr-CA'], 'fr'],
        ['a differently cased tag', ['FR-be'], 'fr'],
        ['an English variant', ['en-GB'], 'en'],
        ['the first supported entry in priority order', ['br', 'fr-FR', 'en-US'], 'fr'],
        ['English ahead of French', ['en-US', 'fr-FR'], 'en']
    ] as const)('resolves %s', (_description, tags, expected) => {
        expect(resolveBrowserLocale(tags)).toBe(expected);
    });

    it.each([
        ['no declared languages', []],
        ['only unsupported languages', ['de-DE', 'es', 'it']],
        ['a malformed tag', ['', '   ', '-']]
    ] as const)('falls back to the default locale for %s', (_description, tags) => {
        expect(resolveBrowserLocale(tags)).toBe(DEFAULT_LOCALE);
    });

    it('never matches a language whose tag merely starts with a supported one', () => {
        // `frr` is Northern Frisian, not a French variant: only the primary subtag may match.
        expect(resolveBrowserLocale(['frr', 'enm'])).toBe(DEFAULT_LOCALE);
    });
});
