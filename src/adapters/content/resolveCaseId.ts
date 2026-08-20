import { resolveCampaignEntryCaseId } from '../../domain/cases/campaignOrder';
import { KNOWN_CASE_IDS, YOUNG_CASE_ID } from '../../schemas/CaseDefinitionSchema';

/**
 * Which case to load: an allowlisted `?case=` override, the moderated route's own case, or the
 * campaign entry.
 *
 * **The campaign decision this file used to defer is made (Story 4.1, AC6): the boot default is the
 * campaign entry, and `CAMPAIGN_ORDER` puts Morley–Miller before Young.** So a fresh profile boots
 * Morley–Miller, and `/` no longer means "Young" — it means "wherever this player is in the campaign".
 * The order itself lives in exactly one place, `src/domain/cases/campaignOrder.ts`, and this is the
 * boot path that reads it.
 *
 * Three routes, in precedence order, each answering a different question:
 *
 * 1. **`?case=` — the reviewer route** (Story 3.2, AC4). Allowlisted rather than passed through:
 *    `loadCaseDefinition` composes a `contentPath` from this value, so an unlisted string would be a
 *    fetch built from reviewer-supplied text. An unknown value falls through rather than failing — a
 *    mistyped review link should open the game, not a boot error. It still outranks the campaign,
 *    because a reviewer opening a case is not a player progressing through one.
 * 2. **`?mode=validation` — the moderated route**, which stays on **Young** and is not campaign-gated.
 *    This is not a Young-shaped assumption left standing; it is what the route is *for*.
 *    `docs/validation/young-validation-plan.md` names `?mode=validation` as the entry route for
 *    validating *the Young laboratory* specifically, so a facilitator's link must keep opening Young
 *    after the campaign default flips. A facilitator who wants the other case can still say
 *    `?mode=validation&case=morley-miller`, since the reviewer route is checked first.
 * 3. **The campaign entry** — the first case in `CAMPAIGN_ORDER` the player has not completed.
 *
 * `completedCaseIds` is passed in rather than read here: this module must stay testable without a
 * document or a database, and the completed set is two IndexedDB reads the boot path already owns (see
 * `readCompletedCampaignCaseIds`). It defaults to empty, which resolves to the first campaign case —
 * the correct answer for a fresh profile and for the validation route alike.
 *
 * Its own module rather than a closure in `main.ts` so it can be tested without a document — `main.ts`
 * attaches a `DOMContentLoaded` listener at module scope, which makes importing it from a Node test a
 * crash rather than a check.
 */
export const resolveCaseId = (search: URLSearchParams, completedCaseIds: readonly string[] = []): string => {
    const requested = search.get('case');
    if (requested !== null && (KNOWN_CASE_IDS as readonly string[]).includes(requested)) return requested;
    if (search.get('mode') === 'validation') return YOUNG_CASE_ID;
    return resolveCampaignEntryCaseId(completedCaseIds);
};
