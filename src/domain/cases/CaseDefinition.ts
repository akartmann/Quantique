import type { Locale } from '../../core/i18n/Locale';
import type { Colleague, ColleagueHint, ConclusionProposal, PredictionProposal, ReadingGateHint } from './ColleagueCast';
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
 * The rule is **purely configurational**: a run's configuration is its tuple of critical values, and
 * the count is the number of distinct tuples. Nothing here looks at the *reading*. An earlier draft
 * carried a `minimumResultDelta` that discounted runs whose results landed close together; it was
 * removed in review (2026-08-06) because comparing each run against the incrementally-built counted
 * set made the total depend on the order the player happened to record in — the same evidence could
 * open or refuse the gate. A distinct-configuration count has no such seam, and the reading is a
 * *consequence* of the configuration anyway: the model is deterministic, so two distinct
 * configurations that produce the same number are a fact about the physics worth recording, not a
 * duplicate worth discarding. If Story 3.1 needs a reading-distance rule, it needs an
 * order-independent one, and it should design it deliberately rather than inherit this.
 */
export type SignificanceRule = Readonly<{
    /** Non-empty; every entry is an authored primary control. Their values form part of a run's configuration. */
    criticalControlIds: readonly PrimaryControl['id'][];
    /**
     * Optional model inputs that also distinguish a configuration, for a case whose critical path is
     * not fully described by the apparatus controls.
     *
     * Young needs this: changing the wavelength at a fixed slit separation and throw is a genuinely
     * distinguishing measurement (550 → 450 nm moves the fringe spacing 4.4 → 3.6 mm), but the
     * wavelength is **not** a `PrimaryControl` — `RunControls` is `Record<PrimaryControl['id'], number>`
     * and `validateControls` snapshots only the two apparatus controls. Widening `RunControls` to
     * carry it would change a persisted, schema-validated shape and demand a `schemaVersion`
     * migration, which would fail every saved record on load and let autosave overwrite it — a silent
     * progress wipe against NFR12. So the wavelength is read from the optional `modelInputs` instead,
     * and a run without `modelInputs` (a fixture run) occupies its own slot rather than colliding
     * with a recorded one.
     */
    criticalModelInputIds?: readonly 'wavelengthNm'[];
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
    /**
     * The in-fiction nudges shown when the required reading is incomplete and the player tries to
     * leave the reading room (Story 2.8). Validation requires one that is satisfiable with nothing
     * read, so this gate can never refuse with nothing to say either.
     */
    readingGateHints: readonly ReadingGateHint[];
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
