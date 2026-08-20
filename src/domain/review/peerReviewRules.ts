import type { PeerReviewRule } from '../cases/CaseDefinition';
import type { TheoryBoardDraft } from '../theory/conclusionReadiness';
import { evaluateConclusionReadiness, type AuthoritativeEvidence } from '../theory/conclusionReadiness';
import type { CaseDefinition } from '../cases/CaseDefinition';

export type PeerReviewIssue = Readonly<{
    code: PeerReviewRule['predicate']['kind'];
    ruleId: string;
    feedback: string;
    revisionPath: string;
}>;

export type PeerReviewProjection = Readonly<{
    status: 'reviewed';
    issues: readonly PeerReviewIssue[];
}> | Readonly<{
    status: 'unavailable';
    message: string;
}>;

/**
 * Canonical English, the same contract as `Result.error.message`: the domain owns the dev-facing
 * default and the presentation localizes it. `message` is persisted inside `DecisionHistoryEntry`,
 * so it must not vary with the active language.
 *
 * **Keep in sync with the `review.unavailable` key** in `src/core/i18n/locales/{en,fr}.ts` — the
 * surfaces resolve that key, and this string is what they fall back to. The status is not code-
 * bearing (`PeerReviewProjection`'s shape is persisted and cannot gain a `code` field without a
 * `schemaVersion` bump), so the link is by convention rather than by type.
 */
export const CANONICAL_UNAVAILABLE_MESSAGE = 'Peer feedback is temporarily unavailable. Your evidence and draft have been kept unchanged.';

const unavailable = (): PeerReviewProjection => Object.freeze({
    status: 'unavailable',
    message: CANONICAL_UNAVAILABLE_MESSAGE
});

/**
 * `.en` on purpose. These issues are written into `DecisionHistoryEntry.feedback`, persisted, and then
 * recomputed and string-compared on load (`validateCaseRecordForDefinition`). Emitting the active
 * locale would reject every record saved in the other language. The review surface localizes by
 * `ruleId` against the case definition.
 */
const freezeIssue = (rule: PeerReviewRule): PeerReviewIssue => Object.freeze({
    code: rule.predicate.kind,
    ruleId: rule.id,
    feedback: rule.feedback.en,
    revisionPath: rule.revisionPath.en
});

/**
 * Every authored detection phrase, in every locale, as one flat list.
 *
 * **The French half of every union is unreachable, and has been since free-text was retired** (Story
 * 4.3). `reduceTheoryConclusionProposalChosen` writes `proposal.claim.en` in *every* locale, because the
 * draft is persisted and string-compared on load — so `draft.conclusion` is always English and no French
 * phrase can match it. Morley–Miller's French claim contains `une fois pour toutes` and it is never read.
 *
 * The union stays flat anyway, and the reason is the one the `overreach` branch below gives: detection
 * must be deterministic across locales so the recomputation on record load matches what was persisted.
 * Reading only `.en` would produce the same answers today and would encode "English is the draft
 * language" a second time, in a place a future free-text path would have to find. Recorded here rather
 * than left for a reader to infer from the deterministic-union comment, which is exactly the inference
 * that made the dead FR list look load-bearing for two stories.
 *
 * So the French phrases are **deliberately** not reachable rather than accidentally so. Their owner is
 * recorded in `deferred-work.md`; nothing in `src/` depends on them, and
 * `MorleyMillerConclusion.test.ts` asserts that no `.en` claim on either shipped case matches one, so
 * this note fails rather than rots if a future claim starts tripping the French list.
 */
const overreachPhrases = (rule: PeerReviewRule): readonly string[] => {
    const authored = rule.predicate.overreachPhrases;
    return authored ? [...authored.en, ...authored.fr] : [];
};

const isApplicable = (
    rule: PeerReviewRule,
    definition: CaseDefinition,
    evidence: AuthoritativeEvidence,
    draft: TheoryBoardDraft
): boolean => {
    const readiness = evaluateConclusionReadiness(definition, evidence, draft);
    switch (rule.predicate.kind) {
        case 'missing-evidence':
            return readiness.missing.some(({ code }) => ['minimum-runs', 'foreign-model-run', 'distinct-run-configurations', 'saved-comparison', 'minimum-sources', 'limitation'].includes(code));
        case 'unsupported-support':
            return readiness.missing.some(({ code }) => code === 'unknown-run-selection' || code === 'unknown-source-selection' || code === 'duplicate-run-selection' || code === 'duplicate-source-selection');
        case 'overreach':
            // The union of both locales' phrases, never the active one: detection must stay
            // deterministic so the recomputation on record load matches what was persisted.
            //
            // Widening the union is therefore not a free change — `validateCaseRecordForDefinition`
            // re-runs this evaluator and rejects a record whose recomputed issues differ from the
            // stored ones. Adding the French list in 1.6.0 is safe only because every build that
            // could have saved a record was English-only with English authored proposals, so no
            // persisted conclusion can contain these words. Any future addition needs the same
            // argument, or a version-gated detection set.
            //
            // **Story 4.3 made this refusal reachable on Morley–Miller without touching the set**, so the
            // argument it owed is a different and stronger one: it reworded
            // `conclude-ether-disproved.claim.en` to contain the *already-authored* phrase `once and for
            // all`, which leaves this function byte-identical before and after. The recomputation walk
            // reads the text the record holds, so it returns for every persisted draft exactly what it
            // returned before, and there is no addition to argue about at all. The full statement,
            // including what a returning player loses, is at the 1.7.0 clause in `CaseRecordSchema.ts`.
            //
            // The rule above still binds the *next* change: widen this set and you owe the "no pre-edit
            // authored claim of either case contains the new phrase" check, over both `case.json` files,
            // run rather than assumed.
            return overreachPhrases(rule).some((phrase) => {
                const escaped = phrase.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
                return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'u').test(draft.conclusion.toLowerCase());
            });
    }
};

const hasEvaluableRules = (definition: CaseDefinition): boolean => definition.peerReviewRules.length > 0
    && definition.peerReviewRules.every((rule) => {
        // `.en` again: the canonical locale is what this evaluator emits and persists.
        if (!rule.id.trim() || !rule.feedback.en.trim() || !rule.revisionPath.en.trim()) return false;
        return rule.predicate.kind !== 'overreach' || overreachPhrases(rule).length > 0;
    });

/** Evaluates only authored predicates and returns no learner-entered text. */
export const evaluatePeerReview = (
    definition: CaseDefinition,
    evidence: AuthoritativeEvidence,
    draft: TheoryBoardDraft
): PeerReviewProjection => {
    if (!hasEvaluableRules(definition)) return unavailable();
    return Object.freeze({
        status: 'reviewed',
        issues: Object.freeze(definition.peerReviewRules
            .filter((rule) => isApplicable(rule, definition, evidence, draft))
            .map(freezeIssue))
    });
};
