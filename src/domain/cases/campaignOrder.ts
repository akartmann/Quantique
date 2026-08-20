import { MORLEY_MILLER_CASE_ID, YOUNG_CASE_ID } from '../../schemas/CaseDefinitionSchema';

/**
 * The order the campaign's cases unlock in, and the one place that order is stated (Story 4.1, AC6).
 *
 * **Morley–Miller precedes Young**, which is FR2's order and *not* the order the cases were built in:
 * Young was the first production slice and the validated one, and three separate comments said this
 * story owned the decision (`resolveCaseId.ts`, `CaseDefinitionSchema.ts`'s `KNOWN_CASE_IDS`, and
 * `MorleyMillerPrototype.test.ts`). Completing or validating Young does not reorder anything here —
 * the order is authored, not derived from progress, which is what makes that clause of AC6 checkable.
 *
 * Pure, per `project-context.md` §Organization: no Zod, no Phaser, no I/O. The two ids are *imported*
 * rather than restated, so a renamed case is a `tsc` error here rather than a campaign that silently
 * skips a case — the same reason `KNOWN_CASE_IDS` is built from the constants.
 *
 * **Not a picker and not a registry.** There is no menu, no selection UI, and no per-case module: two
 * cases in a declared order, an unlock predicate over the completed set, and a resolver for where a
 * player enters. `KNOWN_CASE_IDS` remains the *allowlist* — the set of ids that name a directory under
 * `public/cases/` — which is a different question from what order they are played in. The two lists
 * happen to hold the same ids today and are asserted against each other in the tests, so a third case
 * added to one and not the other fails rather than quietly falling out of the campaign.
 */
export const CAMPAIGN_ORDER = [MORLEY_MILLER_CASE_ID, YOUNG_CASE_ID] as const;

export type CampaignCaseId = typeof CAMPAIGN_ORDER[number];

/** Whether `caseId` is part of the ordered campaign at all. A reviewer route is not. */
export const isCampaignCase = (caseId: string): caseId is CampaignCaseId =>
    (CAMPAIGN_ORDER as readonly string[]).includes(caseId);

/**
 * Whether the player may enter `caseId` yet, given the case ids they have completed.
 *
 * A case is unlocked when every case *before* it in {@link CAMPAIGN_ORDER} has been completed, so the
 * first case is always unlocked and the rule is monotonic in `completedCaseIds`: adding a completion
 * can only ever unlock more, never fewer. A case outside the campaign is not gated by it — the
 * `?case=` reviewer route and the `?mode=validation` route both answer to their own rules, and this
 * function returning `true` for them keeps that seam where it already is rather than moving campaign
 * gating into a review link.
 *
 * Completions are passed in rather than read here: `src/domain/` may not touch IndexedDB, and
 * `caseRecordRepository` is keyed by case id with no enumeration, so assembling the set is the boot
 * path's job.
 */
export const isCampaignCaseUnlocked = (caseId: string, completedCaseIds: readonly string[]): boolean => {
    const index = (CAMPAIGN_ORDER as readonly string[]).indexOf(caseId);
    if (index < 0) return true;
    const completed = new Set(completedCaseIds);
    return CAMPAIGN_ORDER.slice(0, index).every((earlier) => completed.has(earlier));
};

/**
 * Where a player with these completions enters the campaign: the first case in order they have not
 * finished, or — once every case is done — the last one, so a returning player lands on the case they
 * most recently completed rather than on a boot failure. There is no "campaign finished" screen to
 * route to, and inventing one here would be a phase the scenario script does not author.
 */
export const resolveCampaignEntryCaseId = (completedCaseIds: readonly string[]): CampaignCaseId => {
    const completed = new Set(completedCaseIds);
    return CAMPAIGN_ORDER.find((caseId) => !completed.has(caseId)) ?? CAMPAIGN_ORDER[CAMPAIGN_ORDER.length - 1];
};
