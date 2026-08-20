import { CAMPAIGN_ORDER, type CampaignCaseId } from '../../domain/cases/campaignOrder';
import { recordNamesRetiredArtifact } from '../../schemas/CaseRecordSchema';
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
 * corrupt record — that is exactly the case where the player's progress on that case cannot be
 * honoured, so treating it as unfinished keeps them at that case rather than routing them past it on
 * the strength of a record nothing could read. The failure is otherwise not this function's to report:
 * it surfaces where the case is actually loaded, with its own localized message.
 *
 * **What `load` does *not* check, and why this function has to.** `CaseRecordRepository.load` runs
 * `migrateAndValidateCaseRecord` only. It holds no `CaseDefinition`, so it never applies the
 * definition-version allowlist — that lives in `validateCaseRecordForDefinition`, which runs at
 * `createAppStateFromCaseRecord`, *after* the routing decision this function feeds. An earlier version
 * of this docstring claimed `load` fails on a "foreign-version record"; it does not, and the code
 * review of 4.1 found the consequence: a Morley–Miller record completed at case version 1.3.0 loaded
 * cleanly, counted as a completion, and routed the player to Young — past the very investigation the
 * app would refuse the moment they opened it, with no picker to get back to it. A comment asserting a
 * guarantee the code did not make.
 *
 * Rather than fetch both case definitions on the boot path to close that gap, this checks the one thing
 * that makes a prior-version record unhonourable without a definition in hand: whether it names content
 * that no longer exists. `recordNamesRetiredArtifact` is the same predicate the 1.4.0 compatibility
 * clause uses, so the routing decision and the acceptance decision cannot drift apart. A record refused
 * for any *other* reason still counts here, which is the safe direction — it keeps the player at the
 * case rather than skipping it.
 *
 * `completion` is the record's own completion snapshot (`CaseRecordSchema`), not a phase check: a player
 * standing in `debrief` has finished, and a `completion` that survived validation is what says so.
 */
export const readCompletedCampaignCaseIds = async (repository: CaseRecordRepository): Promise<readonly CampaignCaseId[]> => {
    const completed = await Promise.all(CAMPAIGN_ORDER.map(async (caseId) => {
        const loaded = await repository.load(caseId);
        if (!loaded.ok || loaded.value?.completion === undefined) return undefined;
        return recordNamesRetiredArtifact(loaded.value) ? undefined : caseId;
    }));
    return completed.filter((caseId): caseId is CampaignCaseId => caseId !== undefined);
};
