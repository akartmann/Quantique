import { describe, expect, it } from 'vitest';

import type { CaseDefinition, LocalizedText } from '../../src/domain/cases/CaseDefinition';
import { selectLedgerRows } from '../../src/domain/sources/caseLedger';
import { evaluateLedgerReleaseApproval, type LedgerReleaseApproval } from '../../src/domain/sources/releaseApproval';
import { loadShippedCase } from '../shippedCases';

/**
 * The release gate and the row projection, against the **real shipped content** wherever the assertion
 * is about content, and against mutations of it wherever the assertion is about the rule.
 *
 * Parsing the real `case.json` rather than hand-building a fixture is deliberate: a fixture asserts
 * that the evaluator agrees with the fixture, which is the shape of test the 3.2 review found passing
 * over a blank screen. These assertions fail if the *content* stops matching what the ledger claims.
 */
/** A mutable deep copy, so a rule mutation cannot leak into the next assertion. */
const mutable = async (caseId: string): Promise<Record<string, unknown>> =>
    structuredClone(await loadShippedCase(caseId)) as unknown as Record<string, unknown>;

const asDefinition = (value: Record<string, unknown>): CaseDefinition => value as unknown as CaseDefinition;

const bilingual = (english: string): LocalizedText => ({ en: english, fr: `${english} [fr]` });

describe('evaluateLedgerReleaseApproval', () => {
    it('blocks Young, and names exactly the seven rows that block it', async () => {
        const approval = evaluateLedgerReleaseApproval(await loadShippedCase('young-interference'));

        // The honest answer today, and the *correct* one: the five portraits are recorded in
        // `docs/validation/young-character-assets.md` as "not rights-reviewed and not publicly
        // cleared", and no reviewer has been assigned to either open role. Nothing is authored
        // `reviewed` to turn this green — AC4 makes that a defect by name.
        expect(approval.decision).toBe('blocked');
        expect(approval.blockers.map(({ kind, subjectId }) => `${kind}:${subjectId}`).sort()).toEqual([
            'asset-rights-incomplete:arthur-bell-portrait',
            'asset-rights-incomplete:elias-wren-portrait',
            'asset-rights-incomplete:marianne-cole-portrait',
            'asset-rights-incomplete:samuel-hart-portrait',
            'asset-rights-incomplete:thea-young-portrait',
            'educator-context-sheet-pending:young-interference',
            'scholarly-review-pending:young-interference'
        ]);
    });

    it('blocks the prototype on its two open roles, and on nothing else', async () => {
        const approval = evaluateLedgerReleaseApproval(await loadShippedCase('morley-miller'));

        expect(approval.decision).toBe('blocked');
        expect(approval.blockers.map(({ kind, subjectId }) => `${kind}:${subjectId}`).sort()).toEqual([
            'educator-context-sheet-pending:morley-miller',
            'scholarly-review-pending:morley-miller'
        ]);
    });

    it('emits `source-rights-incomplete` naming the source, when a source is not cleared', async () => {
        const definition = await mutable('young-interference');
        const artifact = (definition.contextualArtifacts as Array<Record<string, unknown>>)[0];
        artifact.rightsStatus = 'incomplete';

        const approval = evaluateLedgerReleaseApproval(asDefinition(definition));
        expect(approval.blockers).toContainEqual({ kind: 'source-rights-incomplete', subjectId: 'young-lecture-1801' });
        expect(approval.decision).toBe('blocked');
    });

    it('emits `content-author-unrecorded` when nobody is recorded as having authored the case', async () => {
        const definition = await mutable('young-interference');
        (definition.ledger as { signOff: Record<string, unknown> }).signOff.contentAuthor = { state: 'pending' };

        expect(evaluateLedgerReleaseApproval(asDefinition(definition)).blockers)
            .toContainEqual({ kind: 'content-author-unrecorded', subjectId: 'young-interference' });
    });

    it('does not let a de-scoped content author clear the gate a pending one blocks', async () => {
        // The content author is the one role that cannot be de-scoped away: somebody wrote the case,
        // and if nobody is recorded that *is* the blocker. Without this, `de-scoped` would be a waiver
        // spelled differently — which AC3's no-waiver rule forbids however it is spelled.
        const definition = await mutable('young-interference');
        (definition.ledger as { signOff: Record<string, unknown> }).signOff.contentAuthor = { state: 'de-scoped', reference: 'ADR-008' };

        expect(evaluateLedgerReleaseApproval(asDefinition(definition)).blockers)
            .toContainEqual({ kind: 'content-author-unrecorded', subjectId: 'young-interference' });
    });

    it('emits no blocker for a de-scoped reviewer role', async () => {
        // AC3 clause 3, made observable. The two roles ADR-008 actually de-scopes have no blocker kind
        // at all, so this proves the rule on a role that *does* — a de-scoped scholarly reviewer must
        // clear where a pending one blocks.
        const definition = await mutable('morley-miller');
        (definition.ledger as { signOff: Record<string, unknown> }).signOff.scholarlyReviewer = { state: 'de-scoped', reference: 'ADR-008' };

        const approval = evaluateLedgerReleaseApproval(asDefinition(definition));
        expect(approval.blockers.map(({ kind }) => kind)).not.toContain('scholarly-review-pending');
        // Still blocked on the educator sheet: a de-scoped role clears its own row and nothing else.
        expect(approval.decision).toBe('blocked');
    });

    it('reads asset rights, not only source rights — the whole gate flips on one portrait', async () => {
        // Mutation proof #1, kept as a standing test rather than only recorded in the story: an
        // evaluator that walked sources alone would pass every test one would naturally write, because
        // Young's two sources are `reviewed` and always have been.
        const definition = await mutable('young-interference');
        const entries = (definition.assets as { entries: Array<Record<string, unknown>> }).entries;
        entries.filter(({ id }) => id !== 'quantique-logo').forEach((entry) => {
            entry.rights = { ...(entry.rights as Record<string, unknown>), status: 'reviewed', replacementPlan: undefined };
        });
        const signOff = (definition.ledger as { signOff: Record<string, unknown> }).signOff;
        signOff.scholarlyReviewer = { state: 'reviewed', name: 'A. Reviewer', date: '2026-08-19' };
        (definition.ledger as Record<string, unknown>).educatorContextSheet = { state: 'reviewed', name: 'An Educator', date: '2026-08-19' };

        const approval = evaluateLedgerReleaseApproval(asDefinition(definition));
        expect(approval.decision).toBe('clear');
        expect(approval.blockers).toEqual([]);
    });

    it('fails closed: every check must clear for the decision to be `clear`', async () => {
        const definition = await mutable('morley-miller');
        const signOff = (definition.ledger as { signOff: Record<string, unknown> }).signOff;
        signOff.scholarlyReviewer = { state: 'reviewed', name: 'A. Reviewer', date: '2026-08-19' };
        (definition.ledger as Record<string, unknown>).educatorContextSheet = { state: 'reviewed', name: 'An Educator', date: '2026-08-19' };

        // With both open roles closed the prototype clears — which is what makes every `blocked`
        // assertion above a statement about the content rather than about an evaluator that never clears.
        expect(evaluateLedgerReleaseApproval(asDefinition(definition))).toEqual({ decision: 'clear', blockers: [] });

        // And one unreviewed asset is enough to put it back.
        (definition.assets as { entries: Array<Record<string, unknown>> }).entries[0].rights = {
            holderOrOrigin: 'Quantique project',
            status: 'unavailable',
            claimOrUse: bilingual('Project mark.'),
            reviewerState: 'pending',
            provenanceReference: 'docs/source-rights/quantique-shared-assets.md',
            replacementPlan: bilingual('Replace with a cleared mark.')
        };
        expect(evaluateLedgerReleaseApproval(asDefinition(definition)).decision).toBe('blocked');
    });

    /**
     * The fail-open the code review found, and the fixture that would have caught it.
     *
     * `evaluateLedgerReleaseApproval` checked three of its five roles and carried a comment where the other
     * two checks belonged, asserting that ADR-008 made them `de-scoped`. Nothing in `CaseLedgerSchema` made
     * that true, so a case authoring either `pending` with everything else cleared returned
     * `{ decision: 'clear', blockers: [] }` — while the sign-off table on the same page read Pending. No
     * existing fixture could see it, because every authored ledger says `de-scoped`, and both tests that
     * reached `clear` only ever moved the two roles that already had blocker kinds.
     *
     * ADR-008 being revisited is the natural trigger, which is exactly when a silent `clear` would be worst.
     */
    it.each([
        ['accessibilityReviewer', 'accessibility-review-pending'],
        ['accessibleControlsReference', 'accessible-controls-reference-pending']
    ])('blocks on a pending %s rather than assuming ADR-008 de-scoped it', async (role, kind) => {
        const definition = await mutable('morley-miller');
        const ledger = definition.ledger as Record<string, unknown>;
        const signOff = ledger.signOff as Record<string, unknown>;
        signOff.scholarlyReviewer = { state: 'reviewed', name: 'A. Reviewer', date: '2026-08-19' };
        ledger.educatorContextSheet = { state: 'reviewed', name: 'An Educator', date: '2026-08-19' };

        // Sanity: with the two known roles closed the prototype clears, so the assertion below is about
        // this role and not about some other row left blocking.
        expect(evaluateLedgerReleaseApproval(asDefinition(structuredClone(definition))).decision).toBe('clear');

        (role === 'accessibilityReviewer' ? signOff : ledger)[role] = { state: 'pending' };

        const approval = evaluateLedgerReleaseApproval(asDefinition(definition));
        expect(approval.decision).toBe('blocked');
        expect(approval.blockers).toContainEqual({ kind, subjectId: 'morley-miller' });
    });

    it('ignores every extra argument, so there is no waiver, override or force parameter to pass', async () => {
        // The no-waiver rule `docs/validation/young-release-decision-template.md` states in prose,
        // asserted on behaviour rather than on the signature.
        //
        // **`.length` alone could not carry this claim, and the review proved it.** `Function.prototype
        // .length` counts only the parameters before the first default or rest, so
        // `(definition, waiver: boolean = false)` also reports 1 — a mutation adding exactly that, plus an
        // early `clear` return, left the whole suite green. It was the single assertion behind the
        // loudest guarantee in the module, repeated in four places, and the change it forbids satisfied
        // it. The arity check is kept because it documents the intended signature, but what protects the
        // rule is that a caller passing anything extra gets the same verdict.
        expect(evaluateLedgerReleaseApproval.length).toBe(1);

        // The real shipped case, which is genuinely blocked — forcing a verdict that was already `clear`
        // would prove nothing.
        const blockedCase = await loadShippedCase('young-interference');
        const honest = evaluateLedgerReleaseApproval(blockedCase);
        expect(honest.decision).toBe('blocked');

        const forced = (evaluateLedgerReleaseApproval as unknown as (
            definition: CaseDefinition,
            ...overrides: readonly unknown[]
        ) => LedgerReleaseApproval);
        [true, 'force', { waiver: true }, { override: 'release' }, 1].forEach((override) => {
            const result = forced(blockedCase, override);
            expect(result.decision, `override ${JSON.stringify(override)} changed the decision`).toBe('blocked');
            expect(result.blockers, `override ${JSON.stringify(override)} changed the blockers`)
                .toStrictEqual(honest.blockers);
        });
    });
});

describe('selectLedgerRows', () => {
    it('reads provenance, rights, citation and claim-or-use from the fields that already hold them', async () => {
        const definition = await loadShippedCase('young-interference');
        const { sources } = selectLedgerRows(definition);
        const lecture = sources.find(({ id }) => id === 'young-lecture-1801');
        const artifact = definition.contextualArtifacts.find(({ id }) => id === 'young-lecture-1801')!;

        expect(lecture).toBeDefined();
        // Every one of these is read rather than re-authored: a second authored copy is the duplication
        // AC1 forbids, and this asserts the projection genuinely reads the original field.
        expect(lecture!.provenanceCategory).toBe(artifact.provenance.category);
        expect(lecture!.provenanceReference).toBe(artifact.provenance.reference);
        expect(lecture!.rightsStatus).toBe(artifact.rightsStatus);
        expect(lecture!.claimOrUse).toEqual(artifact.caseRelationship);
        expect(lecture!.citationText).toBe(artifact.textualRendition!.citation.citationText);
        expect(lecture!.archiveUrl).toBe(artifact.textualRendition!.citation.archiveUrl);
        expect(lecture!.sourceRole).toBe(artifact.ledgerEntry.sourceRole);
    });

    it('projects every authored source and every manifest asset, and drops none', async () => {
        for (const caseId of ['young-interference', 'morley-miller']) {
            const definition = await loadShippedCase(caseId);
            const rows = selectLedgerRows(definition);

            expect(rows.sources.map(({ id }) => id)).toEqual(definition.contextualArtifacts.map(({ id }) => id));
            expect(rows.assets.map(({ id }) => id)).toEqual(definition.assets.entries.map(({ id }) => id));
        }
    });

    it('carries the replacement plan of every row that has one, and none where rights are reviewed', async () => {
        const definition = await loadShippedCase('young-interference');
        const { assets } = selectLedgerRows(definition);

        const portraits = assets.filter(({ id }) => id.endsWith('-portrait'));
        expect(portraits).toHaveLength(5);
        portraits.forEach((row) => {
            expect(row.status).toBe('incomplete');
            expect(row.replacementPlan?.en.length).toBeGreaterThan(0);
            expect(row.replacementPlan?.fr.length).toBeGreaterThan(0);
            expect(row.provenanceReference).toBe('docs/validation/young-character-assets.md');
        });

        const logo = assets.find(({ id }) => id === 'quantique-logo')!;
        expect(logo.status).toBe('reviewed');
        expect(logo.replacementPlan).toBeUndefined();
    });

    it('leaves a source with no local rendition without a citation rather than inventing one', async () => {
        const definition = structuredClone(await loadShippedCase('young-interference')) as unknown as Record<string, unknown>;
        delete (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition;

        const row = selectLedgerRows(asDefinition(definition)).sources[0];
        expect(row.citationText).toBeUndefined();
        expect(row.archiveUrl).toBeUndefined();
        // The rest of the row still reads: a missing citation is a gap in one column, not a blank row.
        expect(row.rightsStatus).toBe('reviewed');
    });
});
