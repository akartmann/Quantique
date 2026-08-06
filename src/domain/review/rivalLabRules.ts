import type { CaseDefinition } from '../cases/CaseDefinition';

/**
 * Which authored critique the rival lab answers a submitted conclusion with.
 *
 * Pure and dependency-free by design: no Phaser, no store, no locale, no Zod. Selection is a content
 * lookup, and it is tested without a browser.
 *
 * **It carries stable IDs and never prose.** The line is resolved from the case definition at display
 * time, so an author may rewrite a critique without invalidating a single saved investigation — the
 * failure mode `peerReviewRules` demonstrates, where authored English feedback is persisted into
 * `DecisionHistoryEntry` and recomputed-and-compared on every load, and one copy edit therefore
 * silently rejects every record ever saved.
 */
export type RivalLabCritiqueSelection = Readonly<{
    critiqueId: string;
    proposalId: string;
}>;

/**
 * The first authored critique answering `proposalId`, in authored order.
 *
 * Deterministic: the same definition and proposal always select the same critique. `undefined` means
 * the definition carries no critique for that proposal — which validation rules out for an authored
 * conclusion, so in practice it means the ID names no conclusion proposal at all.
 */
export const selectRivalLabCritique = (
    definition: CaseDefinition,
    proposalId: string
): RivalLabCritiqueSelection | undefined => {
    const critique = definition.rivalLab.critiques.find((candidate) => candidate.proposalId === proposalId);
    return critique ? Object.freeze({ critiqueId: critique.id, proposalId: critique.proposalId }) : undefined;
};
