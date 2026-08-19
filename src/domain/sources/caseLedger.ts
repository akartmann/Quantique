import type {
    CaseDefinition,
    LocalizedText,
    ReviewerState,
    SourceProvenanceCategory,
    SourceRightsStatus,
    SourceRole,
    SourceType
} from '../cases/CaseDefinition';

/**
 * One source's row on the ledger.
 *
 * Every column but `sourceRole`, `reviewerState` and `replacementPlan` is **read** from a field the
 * definition already holds — the provenance from `provenance`, the rights from `rightsStatus`, the
 * citation from the rendition's own `citation`, and the claim-or-use from `caseRelationship`, which
 * already *is* the claim-or-use statement. A second authored copy of any of them would be a defect
 * rather than a convenience: two answers to the same question drift, and the ledger's whole purpose is
 * to audit the case's data rather than to hold a parallel version of it.
 */
export type LedgerSourceRow = Readonly<{
    id: string;
    displayName: LocalizedText;
    /** Canonical: an author or archive name is a proper noun. */
    creatorOrOrigin: string;
    sourceRole: SourceRole;
    sourceType: SourceType;
    provenanceCategory: SourceProvenanceCategory;
    /** Canonical: a stable provenance key, never display text. */
    provenanceReference: string;
    rightsStatus: SourceRightsStatus;
    reviewerState: ReviewerState;
    /** Read from `caseRelationship`. */
    claimOrUse: LocalizedText;
    /** Canonical, and absent for a source with no local rendition — a gap in one column, not a blank row. */
    citationText?: string;
    archiveUrl?: string;
    replacementPlan?: LocalizedText;
}>;

/** One manifest asset's row. Unlike a source, an asset has no `caseRelationship`, so `claimOrUse` is authored. */
export type LedgerAssetRow = Readonly<{
    id: string;
    type: 'image' | 'audio' | 'document';
    /** Canonical: a static path, not display text. */
    path: string;
    holderOrOrigin: string;
    status: SourceRightsStatus;
    claimOrUse: LocalizedText;
    reviewerState: ReviewerState;
    provenanceReference: string;
    replacementPlan?: LocalizedText;
}>;

export type LedgerRows = Readonly<{
    sources: readonly LedgerSourceRow[];
    assets: readonly LedgerAssetRow[];
}>;

/**
 * Projects a case's sources and assets into the rows the ledger surface renders.
 *
 * Pure and order-preserving: the rows come out in authored order, so a reviewer reading the ledger
 * beside `case.json` reads the same sequence in both. The surface adds no ordering of its own.
 *
 * **The boundary this projection draws is authored content**, which is `contextualArtifacts[]` and
 * `assets.entries[]` — everything Zod validates at load. Files sitting in `public/` that no manifest
 * declares (the Phaser template's `bg.png`, `favicon.png`) are outside it: they are build hygiene, and
 * a ledger that silently omitted them would be less honest than one that states where its edge is.
 * `docs/source-rights/README.md` states it in writing for the reviewer who asks.
 */
export const selectLedgerRows = (definition: CaseDefinition): LedgerRows => ({
    sources: definition.contextualArtifacts.map((artifact) => ({
        id: artifact.id,
        displayName: artifact.displayName,
        creatorOrOrigin: artifact.creatorOrOrigin,
        sourceRole: artifact.ledgerEntry.sourceRole,
        sourceType: artifact.sourceType,
        provenanceCategory: artifact.provenance.category,
        provenanceReference: artifact.provenance.reference,
        rightsStatus: artifact.rightsStatus,
        reviewerState: artifact.ledgerEntry.reviewerState,
        claimOrUse: artifact.caseRelationship,
        citationText: artifact.textualRendition?.citation.citationText,
        archiveUrl: artifact.textualRendition?.citation.archiveUrl,
        replacementPlan: artifact.ledgerEntry.replacementPlan
    })),
    assets: definition.assets.entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        path: entry.path,
        holderOrOrigin: entry.rights.holderOrOrigin,
        status: entry.rights.status,
        claimOrUse: entry.rights.claimOrUse,
        reviewerState: entry.rights.reviewerState,
        provenanceReference: entry.rights.provenanceReference,
        replacementPlan: entry.rights.replacementPlan
    }))
});
