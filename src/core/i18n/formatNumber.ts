import type { Locale } from './Locale';

/**
 * Locale-aware presentation of scientific values (AC6). The *recorded* run values stay canonical
 * numbers in the record — only their rendering changes with the language.
 *
 * `Intl` is a JavaScript built-in, so this module keeps `core/` free of platform dependencies and
 * exercises the same code path in Node (full ICU) and in the browser.
 */

/** U+202F. French keeps the value and its unit on one line and never breaks between them. */
const NARROW_NO_BREAK_SPACE = '\u202F';

const UNIT_SEPARATOR: Readonly<Record<Locale, string>> = {
    en: ' ',
    fr: NARROW_NO_BREAK_SPACE
};

// Constructing an Intl.NumberFormat is the expensive part; the set of (locale, precision) pairs a
// case can produce is tiny and bounded by the authored control steps.
const formatters = new Map<string, Intl.NumberFormat>();

const formatterFor = (locale: Locale, decimals: number): Intl.NumberFormat => {
    const cacheKey = `${locale}|${decimals}`;
    const cached = formatters.get(cacheKey);
    if (cached) return cached;
    const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
    formatters.set(cacheKey, formatter);
    return formatter;
};

/** Formats a bare number at the authored precision, trailing zeros included. */
export const formatNumber = (locale: Locale, value: number, decimals: number): string =>
    formatterFor(locale, decimals).format(value);

/** Formats a measured value with its SI unit — `0.25 mm` in English, `0,25 mm` in French. */
export const formatMeasurement = (locale: Locale, value: number, decimals: number, unit: string): string =>
    `${formatNumber(locale, value, decimals)}${UNIT_SEPARATOR[locale]}${unit}`;

/** The precision a number already carries. Used to size a control's readout from its authored step. */
export const decimalPlaces = (value: number): number => value.toString().split('.')[1]?.length ?? 0;

/**
 * Formats a value the domain already rounded, at exactly the precision it carries. Recorded run
 * results keep their canonical number; only the separators change with the language.
 */
export const formatRecordedValue = (locale: Locale, value: number, unit: string): string =>
    formatMeasurement(locale, value, decimalPlaces(value), unit);
