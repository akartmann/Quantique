import type { ScenarioScript } from './ScenarioScript';

export type RecoveryRoute = 'replication' | 'control-change' | 'source-comparison';

export type SourceProvenanceCategory = 'primary-material' | 'reconstruction' | 'later-interpretation' | 'deliberate-fiction';
export type SourceType = 'lecture-record' | 'published-book' | 'reconstruction' | 'interpretive-essay' | 'fictionalized-account';
export type SourceRightsStatus = 'reviewed' | 'incomplete' | 'unavailable';
/** Current authored source locale. Adding translations requires a separately approved case-contract extension. */
export type RenditionLocale = 'en';

export type SourceProvenance = Readonly<{
    category: SourceProvenanceCategory;
    reference: string;
}>;

/** Immutable, locally rendered primary-source text. Locale selection is deliberately a future UI concern. */
export type TextualRenditionSection = Readonly<{
    id: string;
    heading: string;
    paragraphs: readonly string[];
    sourcePages: readonly number[];
}>;

export type LocalizedTextualRendition = Readonly<{
    locale: RenditionLocale;
    sections: readonly TextualRenditionSection[];
}>;

export type TextualRendition = Readonly<{
    readerLabel: string;
    citation: Readonly<{
        reuseStatement: string;
        citationText: string;
        archiveUrl: string;
    }>;
    /** Optional authored one-page overview, shown on the book view via "Show summary". */
    summary?: readonly string[];
    renditions: readonly [LocalizedTextualRendition];
}>;

export type ContextualArtifact = Readonly<{
    id: string;
    displayName: string;
    creatorOrOrigin: string;
    sourceType: SourceType;
    provenance: SourceProvenance;
    rightsStatus: SourceRightsStatus;
    caseRelationship: string;
    textualRendition?: TextualRendition;
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

export type WavelengthMode = 'minimum' | 'advanced';

export type WavelengthComparison = Readonly<{
    fixedMinimumPathNm: 550;
    advancedChoicesNm: readonly [450, 650];
}>;

export type ConsultationPredicateKind = 'missing-run' | 'missing-source' | 'alternative-test' | 'missing-limitation';
export type PeerReviewPredicateKind = 'missing-evidence' | 'unsupported-support' | 'overreach';

export type ProgressiveHelpLayers = Readonly<{
    observation: string;
    plainLanguage: string;
    technicalDetail: string;
}>;

export type ConsultationPredicate =
    | Readonly<{ kind: 'missing-run' }>
    | Readonly<{ kind: 'missing-source'; sourceId: string }>
    | Readonly<{ kind: 'alternative-test'; controlId: PrimaryControl['id'] }>
    | Readonly<{ kind: 'missing-limitation' }>;

export type ConsultationRule = Readonly<{
    id: string;
    predicate: ConsultationPredicate;
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
        wavelengthComparison?: WavelengthComparison;
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
    /** Drives the SceneRouter: the case, not the code, decides which scene mirrors each phase (ADR-009). */
    scenarioScript: ScenarioScript;
    debrief: Readonly<{
        summary: string;
        sourceRefs: readonly string[];
        historicalComparison: Readonly<{ title: string; text: string; sourceIds: readonly [string, string] }>;
        deeperTheory: Readonly<{ title: string; text: string }>;
        replayLabel: string;
    }>;
    assets: Readonly<{
        manifestVersion: string;
        entries: readonly Readonly<{ id: string; type: 'image' | 'audio' | 'document'; path: string }>[];
    }>;
}>;
