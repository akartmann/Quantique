import type { CaseDefinition, ReviewerSignOff } from '../cases/CaseDefinition';

/**
 * Why a case's ledger blocks its own release.
 *
 * One kind per failing *row*, never a single "something is wrong": a banner reading `blocked` with no
 * statement of what blocks it is not visible blocking, and a reviewer cannot act on it. Each blocker
 * carries the offending subject's ID so the surface can name the row and the reviewer can find it.
 */
export type LedgerBlockerKind =
    | 'source-rights-incomplete'
    | 'asset-rights-incomplete'
    | 'content-author-unrecorded'
    | 'scholarly-review-pending'
    | 'educator-context-sheet-pending';

export type LedgerBlocker = Readonly<{
    kind: LedgerBlockerKind;
    /** The artifact ID, asset ID, or — for a case-level role — the case ID. */
    subjectId: string;
}>;

export type LedgerReleaseApproval = Readonly<{
    decision: 'blocked' | 'clear';
    blockers: readonly LedgerBlocker[];
}>;

/**
 * Whether an open reviewer role blocks release.
 *
 * `reviewed` clears because a person signed it. `de-scoped` clears because a recorded decision says
 * the role does not apply — and the schema requires that decision to name itself, so a de-scoping is
 * always traceable to a document (R3). Everything else blocks, which today means `pending`.
 */
const roleBlocks = (signOff: ReviewerSignOff): boolean => signOff.state !== 'reviewed' && signOff.state !== 'de-scoped';

/**
 * Whether a case's material may be released, read from its authored ledger.
 *
 * **Pure, and pure in the way that matters:** no Phaser, DOM, fetch or IndexedDB, and no I/O of any
 * kind. It receives a `CaseDefinition` that Zod has already validated at the content boundary and
 * parses nothing itself.
 *
 * **It fails closed.** The decision is `blocked` unless every check clears, so a check that is added
 * and never wired, or a row an author forgets, blocks rather than passes.
 *
 * **It takes no waiver, override or force parameter, and there is nowhere to add one.**
 * `docs/validation/young-release-decision-template.md` states the rule the same way in prose — "There
 * is no waiver field, override path, or partial approval" — and a gate whose signature admits an
 * override is a gate that will be overridden. A row that should not block is fixed in the *content*,
 * by clearing its rights or by recording the decision that de-scoped its role, both of which are
 * authored and both of which a reviewer can read.
 *
 * The honest answer for both shipped cases today is `blocked`. That is the correct outcome, not a
 * failure to finish: the five Young portraits are recorded as not rights-reviewed, and no reviewer has
 * been assigned to either open role. Nothing is authored `reviewed` to turn the banner green.
 */
export const evaluateLedgerReleaseApproval = (definition: CaseDefinition): LedgerReleaseApproval => {
    const blockers: LedgerBlocker[] = [];

    // Sources. Keyed on `rightsStatus` — *may we ship this* — and not on `ledgerEntry.reviewerState`,
    // which answers the different question of whether a person has signed it. Public-domain material
    // is releasable with nobody's signature on it, which is why a `pending` reviewer state on a
    // `reviewed` source is not a blocker here.
    definition.contextualArtifacts.forEach((artifact) => {
        if (artifact.rightsStatus !== 'reviewed') {
            blockers.push({ kind: 'source-rights-incomplete', subjectId: artifact.id });
        }
    });

    // Assets. The half of this gate that did not exist before Story 3.3, and the half that decides
    // both shipped cases: an evaluator walking sources alone would clear Young, whose two sources have
    // been `reviewed` since Story 1.5, while five uncleared portraits shipped beside them.
    definition.assets.entries.forEach((entry) => {
        if (entry.rights.status !== 'reviewed') {
            blockers.push({ kind: 'asset-rights-incomplete', subjectId: entry.id });
        }
    });

    // The content author is the one role `de-scoped` cannot answer for. Somebody wrote the case; if
    // nobody is recorded, that *is* the blocker, and letting `de-scoped` clear it would be a waiver
    // spelled differently. So this asks for `reviewed` outright rather than going through `roleBlocks`.
    if (definition.ledger.signOff.contentAuthor.state !== 'reviewed') {
        blockers.push({ kind: 'content-author-unrecorded', subjectId: definition.id });
    }
    if (roleBlocks(definition.ledger.signOff.scholarlyReviewer)) {
        blockers.push({ kind: 'scholarly-review-pending', subjectId: definition.id });
    }
    if (roleBlocks(definition.ledger.educatorContextSheet)) {
        blockers.push({ kind: 'educator-context-sheet-pending', subjectId: definition.id });
    }

    // The accessibility reviewer and the accessible-controls reference are `de-scoped` by ADR-008 and
    // have no blocker kind at all. They are still *rendered*, because a de-scoped role is recorded and
    // not dropped — that is the ledger surface's job, not this function's.

    return { decision: blockers.length === 0 ? 'clear' : 'blocked', blockers };
};
