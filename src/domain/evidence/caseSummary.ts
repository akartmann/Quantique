import { formatNumber } from '../../core/i18n/formatNumber';
import type { Locale } from '../../core/i18n/Locale';
import { resolveLocalizedText } from '../../core/i18n/resolveLocalizedText';
import type { CaseDefinition } from '../cases/CaseDefinition';
import type { RunRecord } from './RunRecord';
import { countSignificantMeasures } from './significantMeasures';

/**
 * The neutral auto-summary (FR23): a plain statement of what the player *did*, composed from their own
 * recorded evidence and filled into an authored bilingual template.
 *
 * **It never evaluates.** No "correct", no "well done", no defensibility, no ranking of proposals
 * (ADR-006, UX-DR5). That is not a style preference — defensibility is the evaluator's and the rival
 * lab's business, and a summary that leaked it would tell the player which conclusion to pick before
 * they had reasoned about the evidence. Every value below is a count or a name; none of them is a
 * judgement, and the placeholder vocabulary is closed precisely so a later case cannot author one in.
 *
 * The *template* is authored per case rather than assembled from translation keys, for the reason
 * `ScenarioScript.ts:28-40` records about dialogue beats: `translate` takes `TranslationKey =
 * keyof typeof en`, so routing authored prose through it needs a cast — and the cast defeats the only
 * mechanism that guarantees `fr.ts` carries the key. Case content carries `LocalizedText`; chrome
 * carries keys. The section *heading* around this summary is chrome and does use `translate`.
 */

/**
 * Every value an authored template may name. Closed and exported, because `CaseDefinitionSchema`
 * validates an authored template's placeholders against **this** list at load.
 *
 * That validation is the point of the list existing. `interpolate` leaves an unsupplied `{placeholder}`
 * verbatim by design (its own docstring says so, `translate.ts:39`), so a template naming
 * `{runsRecorded}` instead of `{runCount}` would not fail, or warn, or render `undefined` — it would
 * print the literal text `{runsRecorded}` into the player's printable record. Failing at load, with the
 * offending token named, puts the mistake where the author can see it.
 *
 * Adding a member is a contract change: bump `CaseDefinition.version` and fill it in {@link summaryValues}.
 */
export const AUTO_SUMMARY_PLACEHOLDERS = [
    /** How many observations are in the notebook. */
    'runCount',
    /** How many *distinct* critical configurations those observations cover, per the case's significance rule. */
    'configurationCount',
    /** How many contextual sources have been inspected. */
    'sourceCount',
    /** Those sources by authored display name, in the case's authored order, listed for the active locale. */
    'sourceNames',
    /** How many revisions of the conclusion are on record. */
    'revisionCount'
] as const;

export type AutoSummaryPlaceholder = typeof AUTO_SUMMARY_PLACEHOLDERS[number];

/**
 * The player's own evidence, and nothing else.
 *
 * `decisionHistory` is typed structurally rather than imported: `DecisionHistoryEntry` lives in
 * `src/core/store/AppState.ts`, and `src/domain/` must not depend on the store. Only the number of
 * revisions is read, and `version` is named to make that a deliberate minimum rather than `unknown[]`.
 */
export type CaseSummaryEvidence = Readonly<{
    runs: readonly RunRecord[];
    inspectedSourceIds: readonly string[];
    decisionHistory: readonly Readonly<{ version: number }>[];
}>;

/** The floor `resolveLocalizedText` uses for "nothing to show here", reused so the record reads alike. */
const NOTHING_RECORDED = '—';

/**
 * How a list of names reads in each language: English joins the last pair with "and", French with "et".
 *
 * A locale-keyed constant rather than `Intl.ListFormat`, which would be the obvious choice but needs
 * `lib: ES2021` and this project is pinned at ES2020 — bumping the compiler target to punctuate a list
 * is not a trade this story should make. A locale-keyed formatting constant is the established pattern
 * anyway: `formatNumber.ts`'s `UNIT_SEPARATOR` holds French's narrow no-break space the same way.
 *
 * These are grammar, not copy — which is why they are here and not translation keys. Nothing about them
 * is a message to the player; the words the player reads are all authored in `case.json`.
 */
const LIST_SEPARATOR = ', ';
const FINAL_CONJUNCTION: Readonly<Record<Locale, string>> = { en: ' and ', fr: ' et ' };

const formatList = (locale: Locale, values: readonly string[]): string => {
    if (!values.length) return NOTHING_RECORDED;
    if (values.length === 1) return values[0]!;
    return `${values.slice(0, -1).join(LIST_SEPARATOR)}${FINAL_CONJUNCTION[locale]}${values[values.length - 1]!}`;
};

/**
 * The filled values, exposed so a test can assert what the summary *says* without matching prose.
 *
 * Counts are formatted through `formatNumber` at zero decimals rather than interpolated raw: the
 * recorded evidence stays canonical and only its rendering follows the language, which is the rule the
 * whole codebase holds for scientific values.
 */
export const summaryValues = (
    definition: CaseDefinition,
    evidence: CaseSummaryEvidence,
    locale: Locale
): Readonly<Record<AutoSummaryPlaceholder, string>> => {
    const inspected = new Set(evidence.inspectedSourceIds);
    // Authored order, not inspection order: the record is a statement about the case's sources, and
    // ordering by when the player happened to click would make two identical investigations differ.
    const names = definition.contextualArtifacts
        .filter(({ id }) => inspected.has(id))
        .map(({ displayName }) => resolveLocalizedText(displayName, locale));

    return Object.freeze({
        runCount: formatNumber(locale, evidence.runs.length, 0),
        configurationCount: formatNumber(locale, countSignificantMeasures(definition.significanceRule, evidence.runs), 0),
        // The inspected ids intersected with the authored artifacts, not `inspectedSourceIds.length`: a
        // record can name a source the case no longer authors, and counting it would report a source the
        // list beside it does not show.
        sourceCount: formatNumber(locale, names.length, 0),
        sourceNames: formatList(locale, names),
        revisionCount: formatNumber(locale, evidence.decisionHistory.length, 0)
    });
};

/**
 * Fills the authored template for the active locale.
 *
 * Its own interpolation rather than `translate`'s, because the template is authored content and not a
 * `TranslationKey` — and because the two want opposite behaviour on an unknown token. `interpolate`
 * leaves one verbatim, which is right for chrome that a build cannot check; here the schema has already
 * rejected an unknown token at load, so anything left in the template at this point is impossible, and
 * the summary never renders a literal `{token}` or the word `undefined`.
 */
export const composeCaseSummary = (
    definition: CaseDefinition,
    evidence: CaseSummaryEvidence,
    locale: Locale
): string => {
    const values = summaryValues(definition, evidence, locale);
    return resolveLocalizedText(definition.autoSummary, locale)
        .replace(/\{(\w+)\}/g, (match, name: string) => values[name as AutoSummaryPlaceholder] ?? match);
};

/** The placeholders an authored template names, in the order they appear. Used by validation. */
export const templatePlaceholders = (template: string): readonly string[] =>
    [...template.matchAll(/\{(\w+)\}/g)].map(([, name]) => name);
