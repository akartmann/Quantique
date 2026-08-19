import { describe, expect, it } from 'vitest';

import { resolveRendition } from '../../src/core/i18n/resolveLocalizedText';
import type { LocalizedTextualRendition, TextualRendition } from '../../src/domain/cases/CaseDefinition';

/**
 * The rendition-of-record fallback (Story 3.3, AC8), carried from the review of 3.2 that made
 * `reconstruction` a legal rendition of record.
 *
 * **Every case here is the degraded-cache path, and that is the point.** Zod requires exactly one
 * rendition per shipped locale, so with valid content `.find(locale)` always hits and no fallback runs.
 * A stale or truncated cached `case.json` is where these branches execute, which is the same path
 * `resolveLocalizedText`'s English fallback exists for — and an unexercised fallback is a fallback
 * nobody has checked.
 */
const section = (id: string) => ({ id, heading: 'Page 1', paragraphs: ['Text.'], sourcePages: [1] });

const rendition = (renditions: readonly [LocalizedTextualRendition, LocalizedTextualRendition]): TextualRendition => ({
    readerLabel: { en: 'Read it', fr: 'Le lire' },
    citation: {
        reuseStatement: { en: 'Public domain.', fr: 'Domaine public.' },
        citationText: 'A citation of record.',
        archiveUrl: 'https://example.org/record'
    },
    renditions
});

const english = (kind: LocalizedTextualRendition['kind']): LocalizedTextualRendition =>
    ({ locale: 'en', kind, sections: [section('page-1')] });
const frenchTranslation: LocalizedTextualRendition = { locale: 'fr', kind: 'translation', sections: [section('page-1')] };

describe('resolveRendition', () => {
    it('reads the active locale when it has a rendition, whatever the rendition of record is', () => {
        const withReconstruction = rendition([english('reconstruction'), frenchTranslation]);

        expect(resolveRendition(withReconstruction, 'fr')).toBe(frenchTranslation);
        expect(resolveRendition(withReconstruction, 'en').kind).toBe('reconstruction');
    });

    it('falls back to a reconstruction of record rather than onto a translation', () => {
        // The defect this fixes. A `kind === 'transcription'` fallback matched nothing here, fell through
        // to `renditions[0]`, and returned whichever rendition array order happened to put first — so a
        // reader whose locale was missing could be shown the French *translation* while
        // `book.translatedRendition` told them they were reading the English original.
        const translationFirst = rendition([frenchTranslation, english('reconstruction')]);

        const resolved = resolveRendition(translationFirst, 'en');
        expect(resolved.kind).toBe('reconstruction');
        expect(resolved.locale).toBe('en');
        expect(resolved.kind).not.toBe('translation');
    });

    it('falls back to a transcription of record on the same rule', () => {
        const translationFirst = rendition([frenchTranslation, english('transcription')]);

        expect(resolveRendition(translationFirst, 'en').kind).toBe('transcription');
    });

    it('returns a rendition rather than nothing when a degraded case has only translations', () => {
        // Both fallbacks miss. The floor matters for the same reason `resolveLocalizedText` never returns
        // `undefined`: the reader gets pages to read rather than a crash inside the book view.
        const onlyTranslations = rendition([
            { locale: 'fr', kind: 'translation', sections: [section('page-1')] },
            { locale: 'fr', kind: 'translation', sections: [section('page-1')] }
        ]);

        expect(resolveRendition(onlyTranslations, 'en')).toBe(onlyTranslations.renditions[0]);
    });
});
