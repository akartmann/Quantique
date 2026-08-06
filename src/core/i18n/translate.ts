import type { ResultError } from '../errors/Result';
import type { Locale } from './Locale';
import { DEFAULT_LOCALE } from './Locale';
import { en, type TranslationKey } from './locales/en';
import { fr } from './locales/fr';

export type TranslationParams = Readonly<Record<string, string | number>>;

type LocaleResource = Readonly<Record<string, string | undefined>>;
type LocaleResources = Readonly<Record<Locale, LocaleResource>>;

const RESOURCES: LocaleResources = { en, fr };

/**
 * Dev-only, and never carrying player text: the key and the locale are the whole payload. Gated on
 * the statically replaced `import.meta.env.DEV`, so the branch is tree-shaken out of the production
 * bundle rather than merely skipped at runtime (AC5, NFR18).
 */
const warnMissingKey = (key: string, locale: Locale): void => {
    if (import.meta.env.DEV) {
        console.warn('i18n.missingKey', { key, locale });
    }
};

/**
 * Last resort when a key is absent from both locales: a readable phrase built from the key's final
 * segment. The player must never see a raw dotted key or an empty string (AC5).
 */
const humanise = (key: string): string => {
    const segment = key.split('.').pop() ?? key;
    const words = segment
        .replace(/[-_]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim()
        .toLowerCase();
    return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : key;
};

/** An unsupplied `{placeholder}` is left verbatim rather than rendered as `undefined`. */
const interpolate = (template: string, params?: TranslationParams): string => params
    ? template.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = params[name];
        return value === undefined ? match : String(value);
    })
    : template;

/**
 * Resolves a player-facing string for the active locale, falling back to English and then to a
 * humanised key. `resources` exists only so tests can inject an incomplete locale; production
 * callers always use the bundled ones.
 */
export const translate = (
    locale: Locale,
    key: TranslationKey,
    params?: TranslationParams,
    resources: Partial<LocaleResources> = {}
): string => {
    const active = (resources[locale] ?? RESOURCES[locale])[key];
    if (active !== undefined && active.length > 0) return interpolate(active, params);

    warnMissingKey(key, locale);
    const fallback = (resources[DEFAULT_LOCALE] ?? RESOURCES[DEFAULT_LOCALE])[key];
    return fallback !== undefined && fallback.length > 0 ? interpolate(fallback, params) : humanise(key);
};

export type Translator = (key: TranslationKey, params?: TranslationParams) => string;

/** Binds a locale once so renderers can call `t(key)` without threading the locale through. */
export const createTranslator = (locale: Locale): Translator =>
    (key, params) => translate(locale, key, params);

/**
 * Localizes a typed failure by its stable `code`. `ResultError.message` stays the dev-facing default
 * and the final fallback, so the domain never learns about locale (see the canonical-value traps).
 */
export const translateError = (locale: Locale, error: ResultError, params?: TranslationParams): string => {
    const key = `error.${error.code}` as TranslationKey;
    if (!(key in en)) {
        warnMissingKey(key, locale);
        return error.message;
    }
    return translate(locale, key, params);
};

export type { TranslationKey };
