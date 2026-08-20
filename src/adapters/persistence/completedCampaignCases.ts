import { CAMPAIGN_ORDER, type CampaignCaseId } from '../../domain/cases/campaignOrder';
import type { CaseRecordRepository } from './caseRecordRepository';

/**
 * Which campaign cases the player has finished, for {@link resolveCampaignEntryCaseId} (Story 4.1, AC6).
 *
 * **One `load` per campaign case, deliberately.** `caseRecordRepository` is keyed by case id with
 * `read`/`write` only and no enumeration, and giving it one would widen a boundary contract to serve a
 * two-element list. At two cases this is two IndexedDB reads on the boot path, which is honest and
 * cheap; it is also why this lives in an adapter rather than in `campaignOrder.ts`, since
 * `src/domain/` may not touch IndexedDB.
 *
 * **A record that fails to load is not a completion.** `load` returns a `Result` and can fail on a
 * corrupt or foreign-version record — that is exactly the case where the player's progress on that case
 * cannot be honoured, so treating it as unfinished keeps them at that case rather than routing them
 * past it on the strength of a record nothing could read. The failure is otherwise not this function's
 * to report: it surfaces where the case is actually loaded, with its own localized message.
 *
 * `completion` is the record's own completion snapshot (`CaseRecordSchema`), not a phase check: a player
 * standing in `debrief` has finished, and a `completion` that survived validation is what says so.
 */
export const readCompletedCampaignCaseIds = async (repository: CaseRecordRepository): Promise<readonly CampaignCaseId[]> => {
    const completed = await Promise.all(CAMPAIGN_ORDER.map(async (caseId) => {
        const loaded = await repository.load(caseId);
        return loaded.ok && loaded.value?.completion !== undefined ? caseId : undefined;
    }));
    return completed.filter((caseId): caseId is CampaignCaseId => caseId !== undefined);
};
