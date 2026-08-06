/**
 * The two interface languages shipped from the first release (ADR-010, NFR19).
 * Anything beyond `en` and `fr` is deliberately out of scope.
 */
export const LOCALES = ['en', 'fr'] as const;

export type Locale = typeof LOCALES[number];

/**
 * First-run language. Deliberately not read from `navigator.language`: it would put a browser API on
 * the boot path and make every E2E spec locale-dependent. The boot selector is the first-run affordance.
 */
export const DEFAULT_LOCALE: Locale = 'en';

export const isLocale = (value: unknown): value is Locale =>
    typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
