import { KNOWN_CASE_IDS, YOUNG_CASE_ID } from '../../schemas/CaseDefinitionSchema';

/**
 * Which case to load, from an allowlisted `?case=` query parameter (Story 3.2, AC4).
 *
 * The review route for the Morley–Miller prototype, following the `?mode=validation` precedent: a
 * reviewer-facing entry point that is not a game feature. **Not campaign selection** — there is no
 * picker, no menu and no unlock order, because FR2 puts Morley–Miller *before* Young in the campaign
 * and Story 4.1 owns that decision.
 *
 * **Allowlisted rather than passed through.** `loadCaseDefinition` composes a `contentPath` from this
 * value, so an unlisted string would be a fetch built from reviewer-supplied text. An unknown value
 * falls back to the default rather than failing: a mistyped review link should open the game, not a
 * boot error.
 *
 * Its own module rather than a closure in `main.ts` so it can be tested without a document — `main.ts`
 * attaches a `DOMContentLoaded` listener at module scope, which makes importing it from a Node test a
 * crash rather than a check.
 */
export const resolveCaseId = (search: URLSearchParams): string => {
    const requested = search.get('case');
    return requested !== null && (KNOWN_CASE_IDS as readonly string[]).includes(requested) ? requested : YOUNG_CASE_ID;
};
