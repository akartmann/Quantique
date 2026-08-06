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
 * Picks the archival rendition to read in, falling back to the transcription of record when the
 * active language has none. The fallback is what the reader's `book.originalLanguage` note reports.
 */
export const resolveRendition = (rendition: TextualRendition, locale: Locale): LocalizedTextualRendition =>
    rendition.renditions.find((candidate) => candidate.locale === locale)
    ?? rendition.renditions.find(({ kind }) => kind === 'transcription')
    ?? rendition.renditions[0];
