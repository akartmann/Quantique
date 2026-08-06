/**
 * The two interface languages shipped from the first release (ADR-010, NFR19).
 * Anything beyond `en` and `fr` is deliberately out of scope.
 */
export const LOCALES = ['en', 'fr'] as const;

export type Locale = typeof LOCALES[number];

/**
 * The fallback language, and the canonical one.
 *
 * There is no language control anywhere in the game: `resolveBrowserLocale` reads
 * `navigator.languages` synchronously at boot and `en` is what an unsupported language falls back
 * to. It is also the locale the domain and every persisted record use — authored text crosses into
 * `src/domain/` as `.en`, never as the active language (see the canonical-value traps in
 * `docs/i18n-authoring.md`), so that saved progress revalidates whatever language it is read in.
 *
 * E2E specs stay deterministic because Playwright defaults to an English context; a French spec opts
 * in with `test.use({ locale: 'fr-FR' })`.
 */
export const DEFAULT_LOCALE: Locale = 'en';

export const isLocale = (value: unknown): value is Locale =>
    typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
