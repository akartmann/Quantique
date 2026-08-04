export type RecoveryRoute = 'replication' | 'control-change' | 'source-comparison';

export type SourceProvenanceCategory = 'primary-material' | 'reconstruction' | 'later-interpretation' | 'deliberate-fiction';
export type SourceType = 'lecture-record' | 'published-book' | 'reconstruction' | 'interpretive-essay' | 'fictionalized-account';
export type SourceRightsStatus = 'reviewed' | 'incomplete' | 'unavailable';

export type SourceProvenance = Readonly<{
    category: SourceProvenanceCategory;
    reference: string;
}>;

export type ContextualArtifact = Readonly<{
    id: string;
    displayName: string;
    creatorOrOrigin: string;
    sourceType: SourceType;
    provenance: SourceProvenance;
    rightsStatus: SourceRightsStatus;
    caseRelationship: string;
}>;

export const isSourceEligibleForInspection = (source: ContextualArtifact): boolean => source.rightsStatus === 'reviewed';

export type PrimaryControl = Readonly<{
    id: 'slitSpacingMm' | 'screenDistanceM';
    label: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    defaultValue: number;
}>;

export type ConsultationPredicateKind = 'missing-run' | 'missing-source' | 'alternative-test' | 'missing-limitation';
export type PeerReviewPredicateKind = 'missing-evidence' | 'unsupported-support' | 'overreach';

export type ProgressiveHelpLayers = Readonly<{
    observation: string;
    plainLanguage: string;
    technicalDetail: string;
}>;

export type ConsultationRule = Readonly<{
    id: string;
    predicate: Readonly<{ kind: ConsultationPredicateKind; sourceId?: string; controlId?: PrimaryControl['id'] }>;
    layers: ProgressiveHelpLayers;
    nextStep: string;
}>;

export type PeerReviewRule = Readonly<{
    id: string;
    predicate: Readonly<{ kind: PeerReviewPredicateKind; overreachPhrases?: readonly string[] }>;
    feedback: string;
    revisionPath: string;
}>;

export type CaseDefinition = Readonly<{
    id: 'young-interference';
    version: string;
    openingDispute: string;
    contextualArtifacts: readonly [ContextualArtifact, ContextualArtifact];
    prediction: Readonly<{ required: true }>;
    apparatus: Readonly<{ primaryControls: readonly [PrimaryControl, PrimaryControl] }>;
    experiment: Readonly<{
        modelVersion: string;
        wavelengthNm: 550;
        assumptions: readonly string[];
        confound: Readonly<{ id: string; description: string; discoverableBy: RecoveryRoute }>;
        resetPath: Readonly<{ recoveryRoute: RecoveryRoute; description: string }>;
    }>;
    requirements: Readonly<{ minimumRuns: 2; minimumSources: 2 }>;
    consultationRules: readonly ConsultationRule[];
    peerReviewRules: readonly PeerReviewRule[];
    flow: Readonly<{
        openingDispute: true;
        curatedRecord: true;
        labSetup: true;
        minimumExperimentCycles: 2;
        maximumExperimentCycles: 4;
        theoryBoardReview: true;
        historicalDebrief: true;
        optionalReplay: true;
    }>;
    debrief: Readonly<{ summary: string; sourceRefs: readonly string[] }>;
    assets: Readonly<{
        manifestVersion: string;
        entries: readonly Readonly<{ id: string; type: 'image' | 'audio' | 'document'; path: string }>[];
    }>;
}>;
