import type { LocalizedTextualRendition } from '../../domain/cases/CaseDefinition';

/** Kept deliberately small enough for the generated book and semantic reading spread. */
export const LECTURE_PAGE_WORD_LIMIT = 140;

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

const words = (text: string): readonly string[] => text.trim().split(/\s+/).filter(Boolean);

/**
 * Produces stable leaves without inspecting the DOM or mutating the immutable case rendition.
 * Joining each page's paragraph words recreates the authored text in its original order.
 */
export const paginateLectureRendition = (
    rendition: LocalizedTextualRendition,
    wordLimit = LECTURE_PAGE_WORD_LIMIT
): LecturePagination => {
    if (!Number.isInteger(wordLimit) || wordLimit < 1) throw new RangeError('Lecture word limit must be a positive integer.');

    const pages: LecturePage[] = [];
    rendition.sections.forEach((section) => {
        let leafNumber = 1;
        let leafWords: string[] = [];
        let paragraphs: string[] = [];
        const appendLeaf = (): void => {
            if (leafWords.length === 0) return;
            pages.push({
                id: `${section.id}-leaf-${leafNumber}`,
                sourceSectionId: section.id,
                heading: leafNumber === 1 ? section.heading : `${section.heading} (continued)`,
                paragraphs,
                sourcePages: section.sourcePages
            });
            leafNumber += 1;
            leafWords = [];
            paragraphs = [];
        };

        section.paragraphs.forEach((paragraph) => {
            const paragraphWords = words(paragraph);
            for (let start = 0; start < paragraphWords.length;) {
                const room = wordLimit - leafWords.length;
                const part = paragraphWords.slice(start, start + room);
                paragraphs.push(part.join(' '));
                leafWords.push(...part);
                start += part.length;
                if (leafWords.length === wordLimit) appendLeaf();
            }
        });
        appendLeaf();
    });

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
