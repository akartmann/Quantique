import type { LocalizedText, LocalizedTextList, LocalizedTextualRendition, TextualRendition } from '../../domain/cases/CaseDefinition';
import { DEFAULT_LOCALE, type Locale } from './Locale';

/**
 * Resolves authored case text for the active locale, with the same English-fallback contract as
 * `translate`. Zod already rejects a case missing a locale at the content boundary, so the fallback
 * here guards a degraded cached `case.json`, not authoring.
 */

const warnMissingLocale = (locale: Locale, sample: string): void => {
    if (import.meta.env.DEV) {
        // Authored case text, never player-entered text.
        console.warn('i18n.missingKey', { key: `case:${sample.slice(0, 40)}`, locale });
    }
};

export const resolveLocalizedText = (text: LocalizedText, locale: Locale): string => {
    const value = text[locale];
    if (value !== undefined && value.trim().length > 0) return value;
    const fallback = text[DEFAULT_LOCALE];
    warnMissingLocale(locale, fallback ?? '');
    // The same floor as `translate`: never `undefined` and never an empty string. A degraded case
    // can be missing both locales, and a Phaser `setText(undefined)` would print "undefined" to the
    // player rather than degrade.
    return fallback !== undefined && fallback.trim().length > 0 ? fallback : '—';
};

export const resolveLocalizedTextList = (list: LocalizedTextList, locale: Locale): readonly string[] => {
    const values = list[locale];
    if (values !== undefined && values.length > 0) return values;
    const fallback = list[DEFAULT_LOCALE];
    warnMissingLocale(locale, fallback?.[0] ?? '');
    // Callers `.join(...)` this, so an absent list has to come back as an empty array, not undefined.
    return fallback ?? [];
};

/**
 * Picks the archival rendition to read in, falling back to the **rendition of record** when the active
 * language has none. The fallback is what the reader's `book.originalLanguage` note reports.
 *
 * The fallback tests `kind !== 'translation'` rather than `kind === 'transcription'` (Story 3.3, AC8).
 * The review of 3.2 made `reconstruction` a legal rendition of record — the prototype's 1905 artifact is
 * prose written for this investigation, and calling it a transcription was a provenance claim nobody had
 * reviewed. A `transcription`-only test skips a reconstruction and lands on `renditions[0]` by array
 * order, which can be the *translation*: the reader would then be shown a French translation under a
 * notice naming English as the original. Asking for "not a translation" selects the rendition of record
 * whichever of the two kinds it is, which is what the notice actually claims.
 *
 * **Unreachable with valid content, and kept anyway.** Zod requires exactly one rendition per shipped
 * locale, so `.find(locale)` always hits and neither fallback runs. What this guards is the degraded
 * cached path — the same one `resolveLocalizedText`'s English fallback above exists for — where a stale
 * or truncated `case.json` reaches the reader with a locale missing.
 */
export const resolveRendition = (rendition: TextualRendition, locale: Locale): LocalizedTextualRendition =>
    rendition.renditions.find((candidate) => candidate.locale === locale)
    ?? rendition.renditions.find(({ kind }) => kind !== 'translation')
    ?? rendition.renditions[0];
