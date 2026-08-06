import { DEFAULT_LOCALE, isLocale, type Locale } from './Locale';

/**
 * Resolves the interface language from the browser's own language preferences.
 *
 * There is no in-game language control: the player's browser already carries this preference, and a
 * French classroom gets French without anyone hunting for a setting. That also means there is
 * nothing to persist — `navigator.languages` is available on every boot, including an offline
 * reload — so no locale ever reaches IndexedDB.
 *
 * Matching is on the primary subtag only: `fr`, `fr-FR`, `fr-CA` and `fr-BE` all resolve to `fr`.
 * The list is walked in the browser's own priority order, so a player who prefers Breton but accepts
 * French ahead of English still gets French. Anything unsupported falls back to {@link DEFAULT_LOCALE}.
 */
export const resolveBrowserLocale = (languageTags: readonly string[] = readNavigatorLanguages()): Locale => {
    for (const tag of languageTags) {
        const primarySubtag = tag.trim().toLowerCase().split('-')[0];
        if (isLocale(primarySubtag)) return primarySubtag;
    }
    return DEFAULT_LOCALE;
};

/** Guarded so the resolver stays callable from Node-hosted tests, where there is no `navigator`. */
function readNavigatorLanguages(): readonly string[] {
    if (typeof navigator === 'undefined') return [];
    return navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean);
}
