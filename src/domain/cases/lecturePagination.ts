import type { LocalizedTextualRendition } from './CaseDefinition';

export type LecturePage = Readonly<{
    id: string;
    sourceSectionId: string;
    heading: string;
    paragraphs: readonly string[];
    sourcePages: readonly number[];
}>;

export type LectureSpread = Readonly<{
    index: number;
    total: number;
    pages: readonly [LecturePage, LecturePage?];
    canGoPrevious: boolean;
    canGoNext: boolean;
}>;

export type LecturePagination = Readonly<{
    pages: readonly LecturePage[];
    spreadCount: number;
}>;

/**
 * Produces stable leaves without inspecting the DOM or mutating the immutable case rendition.
 * A source section is an authored printed page, so it must remain a single book leaf.
 *
 * Moved out of `src/ui/sources/` by Story 2.8: it is pure arithmetic over authored content with no
 * DOM, Phaser, or Zod anywhere in it, and both the Phaser reference book and the retiring DOM panel
 * read it. Leaving it under a directory Story 2.12 deletes would have made the canvas book depend on
 * a module scheduled for removal.
 */
export const paginateLectureRendition = (rendition: LocalizedTextualRendition): LecturePagination => {
    const pages = rendition.sections.map((section) => ({
        id: section.id,
        sourceSectionId: section.id,
        heading: section.heading,
        paragraphs: section.paragraphs,
        sourcePages: section.sourcePages
    }));

    return { pages, spreadCount: Math.ceil(pages.length / 2) };
};

export const getLectureSpread = (pagination: LecturePagination, index: number): LectureSpread => {
    const boundedIndex = Math.max(0, Math.min(index, Math.max(0, pagination.spreadCount - 1)));
    const firstPage = pagination.pages[boundedIndex * 2];
    if (!firstPage) throw new RangeError('A lecture pagination must contain at least one page.');
    const secondPage = pagination.pages[(boundedIndex * 2) + 1];
    return {
        index: boundedIndex,
        total: pagination.spreadCount,
        pages: secondPage ? [firstPage, secondPage] : [firstPage],
        canGoPrevious: boundedIndex > 0,
        canGoNext: boundedIndex < pagination.spreadCount - 1
    };
};
