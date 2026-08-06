import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_LOCALE, isLocale, LOCALES } from '../../src/core/i18n/Locale';
import { resolveBrowserLocale } from '../../src/core/i18n/resolveBrowserLocale';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { createTranslator, translate, translateError } from '../../src/core/i18n/translate';
import { formatMeasurement, formatNumber } from '../../src/core/i18n/formatNumber';
import { resolveLocalizedText, resolveLocalizedTextList } from '../../src/core/i18n/resolveLocalizedText';

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
