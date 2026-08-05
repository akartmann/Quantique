import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import type { LocalizedTextualRendition } from '../../src/domain/cases/CaseDefinition';
import { getLectureSpread, paginateLectureRendition } from '../../src/ui/sources/lecturePagination';

const rendition: LocalizedTextualRendition = {
    locale: 'en',
    sections: [
        { id: 'page-1', heading: 'Page one', paragraphs: ['One two three four five six.', 'Seven eight.'], sourcePages: [12] },
        { id: 'page-2', heading: 'Page two', paragraphs: ['Nine ten eleven.'], sourcePages: [13] }
    ]
};

describe('lecture pagination', () => {
    it('splits immutable source text at word boundaries while preserving source references and order', () => {
        const pagination = paginateLectureRendition(rendition, 3);

        expect(pagination.pages.map(({ sourceSectionId, sourcePages }) => ({ sourceSectionId, sourcePages }))).toEqual([
            { sourceSectionId: 'page-1', sourcePages: [12] },
            { sourceSectionId: 'page-1', sourcePages: [12] },
            { sourceSectionId: 'page-1', sourcePages: [12] },
            { sourceSectionId: 'page-2', sourcePages: [13] }
        ]);
        expect(pagination.pages.flatMap((page) => page.paragraphs).join(' ').replace(/\s+/g, ' ').trim()).toBe(
            rendition.sections.flatMap((section) => section.paragraphs).join(' ').replace(/\s+/g, ' ').trim()
        );
        expect(pagination.pages.every((page) => page.paragraphs.join(' ').trim().split(/\s+/).length <= 3)).toBe(true);
    });

    it('exposes bounded two-page spreads', () => {
        const pagination = paginateLectureRendition(rendition, 3);

        expect(getLectureSpread(pagination, -4)).toMatchObject({ index: 0, canGoPrevious: false, canGoNext: true, pages: [{ id: 'page-1-leaf-1' }, { id: 'page-1-leaf-2' }] });
        expect(getLectureSpread(pagination, 20)).toMatchObject({ index: 1, canGoPrevious: true, canGoNext: false, pages: [{ id: 'page-1-leaf-3' }, { id: 'page-2-leaf-1' }] });
    });

    it('covers every paragraph of the immutable local Young rendition in authored order', async () => {
        const caseDefinition = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8')) as {
            contextualArtifacts: Array<{ textualRendition?: { renditions: LocalizedTextualRendition[] } }>;
        };
        const localRendition = caseDefinition.contextualArtifacts[0].textualRendition!.renditions[0];
        const pagination = paginateLectureRendition(localRendition);

        expect(pagination.spreadCount).toBe(50);
        expect(pagination.pages.map(({ sourceSectionId }) => new Set(localRendition.sections.map(({ id }) => id)).has(sourceSectionId))).not.toContain(false);
        expect(pagination.pages.flatMap((page) => page.paragraphs).join(' ').replace(/\s+/g, ' ').trim()).toBe(
            localRendition.sections.flatMap((section) => section.paragraphs).join(' ').replace(/\s+/g, ' ').trim()
        );
        expect(getLectureSpread(pagination, 999).pages.map(({ sourcePages }) => sourcePages)).toEqual([[48]]);
    });
});
