import type { Locale } from '../../core/i18n/Locale';
import type { Colleague, ColleagueHint, ConclusionProposal, PredictionProposal } from './ColleagueCast';
import type { ScenarioScript } from './ScenarioScript';

/**
 * An authored player-facing string carrying every shipped interface language (ADR-010).
 *
 * The domain always reads the canonical `en` member; only the presentation resolves the *active*
 * locale, through `resolveLocalizedText`. That split is load-bearing rather than stylistic — see the
 * canonical-value traps in `docs/i18n-authoring.md`.
 */
export type LocalizedText = Readonly<{ en: string; fr: string }>;

/** The list variant. Zod additionally requires equal lengths across locales. */
export type LocalizedTextList = Readonly<{ en: readonly string[]; fr: readonly string[] }>;

export type RecoveryRoute = 'replication' | 'control-change' | 'source-comparison';

export type SourceProvenanceCategory = 'primary-material' | 'reconstruction' | 'later-interpretation' | 'deliberate-fiction';
export type SourceType = 'lecture-record' | 'published-book' | 'reconstruction' | 'interpretive-essay' | 'fictionalized-account';
export type SourceRightsStatus = 'reviewed' | 'incomplete' | 'unavailable';
/**
 * The languages the archival book can be read in — one rendition per shipped locale.
 *
 * A translation of a historical primary source is a new scholarly artifact, not the source: it is
 * therefore tagged `kind: 'translation'`, carries its own reuse statement, and the reader is told
 * what it is. The bibliographic citation and archive URL always point at the transcribed original.
 */
export type RenditionLocale = Locale;

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
    /**
     * `transcription` reproduces the printed source as published. `translation` is a modern rendering
     * of that transcription — useful to read, but not the source of record, and never presented as it.
     */
    kind: 'transcription' | 'translation';
    sections: readonly TextualRenditionSection[];
}>;

export type TextualRendition = Readonly<{
    readerLabel: LocalizedText;
    citation: Readonly<{
        reuseStatement: LocalizedText;
        /** Canonical: the bibliographic citation of record and its archive link never change language. */
        citationText: string;
        archiveUrl: string;
    }>;
    /** Optional authored one-page overview, shown on the book view via "Show summary". */
    summary?: LocalizedTextList;
    /** Exactly one per shipped locale, page-for-page aligned so paging is identical in either language. */
    renditions: readonly [LocalizedTextualRendition, LocalizedTextualRendition];
}>;

export type ContextualArtifact = Readonly<{
    /** Canonical: `id` and every `provenance.reference` are stable keys, never display text. */
    id: string;
    displayName: LocalizedText;
    /** Canonical: an author or archive name is a proper noun, not translated copy. */
    creatorOrOrigin: string;
    sourceType: SourceType;
    provenance: SourceProvenance;
    rightsStatus: SourceRightsStatus;
    caseRelationship: LocalizedText;
    textualRendition?: TextualRendition;
}>;

export const isSourceEligibleForInspection = (source: ContextualArtifact): boolean => source.rightsStatus === 'reviewed';

export type PrimaryControl = Readonly<{
    id: 'slitSpacingMm' | 'screenDistanceM';
    label: LocalizedText;
    /** Canonical: SI unit symbols are identical in French. */
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
    observation: LocalizedText;
    plainLanguage: LocalizedText;
    technicalDetail: LocalizedText;
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
    nextStep: LocalizedText;
}>;

export type PeerReviewRule = Readonly<{
    id: string;
    /**
     * `overreachPhrases` are *detection* phrases matched against the learner's own conclusion, not
     * display text. Both locales' phrases are always matched as a union, regardless of the active
     * language, so recomputed review issues stay identical and saved records stay portable.
     */
    predicate: Readonly<{ kind: PeerReviewPredicateKind; overreachPhrases?: LocalizedTextList }>;
    feedback: LocalizedText;
    revisionPath: LocalizedText;
}>;

/**
 * One authored rival-lab line, addressed to one conclusion proposal.
 *
 * `line` is display prose — `LocalizedText`, never a detection phrase list — and it is resolved from
 * the definition at display time. What a record persists is the `id`, so an author may rewrite a
 * critique without invalidating a single saved investigation. See `peerReviewRules.ts` for the
 * persisted-prose trap this deliberately avoids.
 */
export type RivalLabCritique = Readonly<{
    id: string;
    proposalId: string;
    line: LocalizedText;
}>;

/**
 * The rival lab's identity and its authored critiques.
 *
 * Grouped under one object rather than a flat `rivalLabCritiques[]` because the rival's name and
 * accent have to live somewhere and he is deliberately **not** a member of `colleagues[]` — he is the
 * challenger, not the cast, and nothing may attribute a proposal or a dialogue beat to him.
 *
 * `name` is canonical: a proper noun, following `Colleague.name` and `creatorOrOrigin`.
 */
export type RivalLab = Readonly<{
    name: string;
    accentColor: string;
    critiques: readonly RivalLabCritique[];
}>;

/**
 * When a recorded run counts as a *significant* measurement — one that distinguishes something,
 * rather than repeating it (Story 2.6).
 *
 * Authored per case, because "the critical path" is a claim about this apparatus: for Young it is
 * the slit separation and the throw to the screen, and a later case will name its own.
 *
 * `minimumResultDelta` is optional and, for Young, provably never binding — the smallest single-step
 * change anywhere inside the authored control bounds moves the fringe spacing by ≈0.122 mm, well
 * clear of the authored 0.05 mm. It is carried because the rule is the reusable half of the contract
 * Story 3.1 hardens, and `tests/unit/SignificantMeasures.test.ts` pins that it does not bite here.
 */
export type SignificanceRule = Readonly<{
    /** Non-empty; every entry is an authored primary control. Their values form a run's configuration. */
    criticalControlIds: readonly PrimaryControl['id'][];
    /** A run whose result is within this of an already-counted run's is a replication, not a variation. */
    minimumResultDelta?: number;
}>;

export type CaseDefinition = Readonly<{
    id: 'young-interference';
    version: string;
    openingDispute: LocalizedText;
    contextualArtifacts: readonly [ContextualArtifact, ContextualArtifact];
    prediction: Readonly<{ required: true }>;
    apparatus: Readonly<{ primaryControls: readonly [PrimaryControl, PrimaryControl] }>;
    experiment: Readonly<{
        /** Canonical: the model version is a compatibility key stored in every run record. */
        modelVersion: string;
        wavelengthNm: 550;
        wavelengthComparison?: WavelengthComparison;
        assumptions: LocalizedTextList;
        confound: Readonly<{ id: string; description: LocalizedText; discoverableBy: RecoveryRoute }>;
        resetPath: Readonly<{ recoveryRoute: RecoveryRoute; description: LocalizedText }>;
    }>;
    requirements: Readonly<{ minimumRuns: 2; minimumSources: 2; minimumSignificantRuns: 2 }>;
    /** When a run counts as a distinguishing measurement. Read only by `significantMeasures.ts`. */
    significanceRule: SignificanceRule;
    /**
     * The in-fiction nudges shown when the significant-measure gate refuses the advance to synthesis.
     * Validation requires at least one that is satisfiable with no runs recorded, so the gate can
     * never refuse with nothing to say.
     */
    colleagueHints: readonly ColleagueHint[];
    /** The authored cast that voices every proposal. See `ColleagueCast.ts`. */
    colleagues: readonly Colleague[];
    /** Exactly four: the pivot makes the prediction a 1-of-4 attributed choice. */
    predictionProposals: readonly PredictionProposal[];
    /** Exactly four, likewise. Defensibility is the evaluator's business, never a scene's. */
    conclusionProposals: readonly ConclusionProposal[];
    /** The rival lab and its critiques. Validation guarantees every conclusion proposal draws one. */
    rivalLab: RivalLab;
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
        summary: LocalizedText;
        /** Canonical: stable provenance references, not display text. */
        sourceRefs: readonly string[];
        historicalComparison: Readonly<{ title: LocalizedText; text: LocalizedText; sourceIds: readonly [string, string] }>;
        deeperTheory: Readonly<{ title: LocalizedText; text: LocalizedText }>;
        replayLabel: LocalizedText;
    }>;
    assets: Readonly<{
        manifestVersion: string;
        entries: readonly Readonly<{ id: string; type: 'image' | 'audio' | 'document'; path: string }>[];
    }>;
}>;
