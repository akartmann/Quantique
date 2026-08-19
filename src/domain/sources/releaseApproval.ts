import type { CaseDefinition, ReviewerSignOff } from '../cases/CaseDefinition';

/**
 * Why a case's ledger blocks its own release.
 *
 * One kind per failing *row*, never a single "something is wrong": a banner reading `blocked` with no
 * statement of what blocks it is not visible blocking, and a reviewer cannot act on it. Each blocker
 * carries the offending subject's ID so the surface can name the row and the reviewer can find it.
 */
export const LEDGER_BLOCKER_KINDS = [
    'source-rights-incomplete',
    'asset-rights-incomplete',
    'content-author-unrecorded',
    'scholarly-review-pending',
    'educator-context-sheet-pending',
    // The two ADR-008 roles. They emit no blocker while they are authored `de-scoped`, which is how both
    // shipped cases stand — but they are checked rather than assumed. See the note on the two calls
    // below for what the assumption cost.
    'accessibility-review-pending',
    'accessible-controls-reference-pending'
] as const;

/**
 * The type is **derived from the list**, not written beside it.
 *
 * A hand-written union next to a hand-written array is two rosters that drift, and the drift is silent:
 * `tests/unit/I18n.test.ts` sweeps this list to prove every kind has a sentence in both locales, so a
 * kind present in the union and absent from the array would be a blocker with no readable text and no
 * test able to see it. Deriving makes that unrepresentable.
 */
export type LedgerBlockerKind = typeof LEDGER_BLOCKER_KINDS[number];

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
 * **It takes no waiver, override or force parameter.**
 * `docs/validation/young-release-decision-template.md` states the rule the same way in prose — "There
 * is no waiver field, override path, or partial approval" — and a gate whose signature admits an
 * override is a gate that will be overridden. A row that should not block is fixed in the *content*,
 * by clearing its rights or by recording the decision that de-scoped its role, both of which are
 * authored and both of which a reviewer can read.
 *
 * This docstring used to add "and there is nowhere to add one", which was not true and is worth
 * recording as false rather than quietly deleting. Nothing structural prevents a second parameter; the
 * only thing standing behind the rule was `expect(fn.length).toBe(1)`, and `Function.prototype.length`
 * ignores parameters with defaults — so `(definition, waiver = false)` reported 1 and a working override
 * passed the whole suite. What guards it now is a behavioural test: extra arguments are passed and the
 * verdict must not move. Keep it that way, because the claim is only as strong as what checks it.
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

    // **The two ADR-008 roles are checked, not assumed, and this is a fix rather than a flourish.**
    // These two lines were a comment saying the roles "are `de-scoped` by ADR-008 and have no blocker
    // kind at all". Nothing in `CaseLedgerSchema` made that true — `ReviewerSignOffSchema` accepts all
    // three states for all five roles — so a case authoring either one `pending` with everything else
    // cleared returned `{ decision: 'clear', blockers: [] }` while the sign-off table on the same page
    // showed two roles Pending. A gate documented four times over as failing closed failed open on two
    // of its five roles, and no fixture could see it because every authored ledger says `de-scoped`.
    //
    // Routing them through `roleBlocks` rather than pinning the schema to `de-scoped` is deliberate:
    // ADR-008 de-scopes accessibility from the MVP while stating that "the preserved store/domain
    // boundary keeps a future accessible surface feasible without re-architecture", so the de-scoping
    // is expected to be revisited. Pinning it would mean resuming that work begins by relaxing a
    // shared schema shape; this way, authoring `pending` the day it resumes simply blocks, which is
    // what it should do. Both shipped cases author `de-scoped`, so neither emits a blocker today.
    if (roleBlocks(definition.ledger.signOff.accessibilityReviewer)) {
        blockers.push({ kind: 'accessibility-review-pending', subjectId: definition.id });
    }
    if (roleBlocks(definition.ledger.accessibleControlsReference)) {
        blockers.push({ kind: 'accessible-controls-reference-pending', subjectId: definition.id });
    }

    return { decision: blockers.length === 0 ? 'clear' : 'blocked', blockers };
};
