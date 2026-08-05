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
    it('keeps each immutable authored source section as one leaf while preserving references and order', () => {
        const pagination = paginateLectureRendition(rendition);

        expect(pagination.pages.map(({ sourceSectionId, sourcePages }) => ({ sourceSectionId, sourcePages }))).toEqual([
            { sourceSectionId: 'page-1', sourcePages: [12] },
            { sourceSectionId: 'page-2', sourcePages: [13] }
        ]);
        expect(pagination.pages.map(({ id, heading, paragraphs }) => ({ id, heading, paragraphs }))).toEqual(rendition.sections.map(({ id, heading, paragraphs }) => ({ id, heading, paragraphs })));
        expect(pagination.pages.flatMap((page) => page.paragraphs).join(' ').replace(/\s+/g, ' ').trim()).toBe(
            rendition.sections.flatMap((section) => section.paragraphs).join(' ').replace(/\s+/g, ' ').trim()
        );
    });

    it('exposes bounded two-page spreads', () => {
        const pagination = paginateLectureRendition(rendition);

        expect(getLectureSpread(pagination, -4)).toMatchObject({ index: 0, canGoPrevious: false, canGoNext: false, pages: [{ id: 'page-1' }, { id: 'page-2' }] });
        expect(getLectureSpread(pagination, 20)).toMatchObject({ index: 0, canGoPrevious: false, canGoNext: false, pages: [{ id: 'page-1' }, { id: 'page-2' }] });
    });

    it('covers every paragraph of the immutable local Young rendition in authored order', async () => {
        const caseDefinition = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8')) as {
            contextualArtifacts: Array<{ textualRendition?: { renditions: LocalizedTextualRendition[] } }>;
        };
        const localRendition = caseDefinition.contextualArtifacts[0].textualRendition!.renditions[0];
        const pagination = paginateLectureRendition(localRendition);

        expect(pagination.pages).toHaveLength(37);
        expect(pagination.spreadCount).toBe(19);
        expect(pagination.pages.map(({ sourcePages }) => sourcePages)).toEqual(localRendition.sections.map(({ sourcePages }) => sourcePages));
        expect(pagination.pages.map(({ sourceSectionId }) => new Set(localRendition.sections.map(({ id }) => id)).has(sourceSectionId))).not.toContain(false);
        expect(pagination.pages.flatMap((page) => page.paragraphs).join(' ').replace(/\s+/g, ' ').trim()).toBe(
            localRendition.sections.flatMap((section) => section.paragraphs).join(' ').replace(/\s+/g, ' ').trim()
        );
        expect(getLectureSpread(pagination, 999).pages.map(({ sourcePages }) => sourcePages)).toEqual([[48]]);
    });
});
