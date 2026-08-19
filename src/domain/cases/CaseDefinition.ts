import type { Locale } from '../../core/i18n/Locale';
import type { Colleague, ColleagueFigure, ColleagueHint, ConclusionProposal, PredictionProposal, ReadingGateHint } from './ColleagueCast';
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
     * `transcription` reproduces the printed source as published. `reconstruction` stands in for a
     * source rather than reproducing one — prose written for the investigation, which must say so
     * rather than borrowing a transcription's authority (review 2026-08-19). Exactly one of those two
     * is the rendition *of record*. `translation` is a modern rendering of it — useful to read, but not
     * the source of record, and never presented as it.
     */
    kind: 'transcription' | 'translation' | 'reconstruction';
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

/**
 * Which of FR26's two source classes this artifact is. Read only by the ledger.
 *
 * Not derived from `provenance.category`: a `primary-material` category describes what the *document*
 * is, while this describes the role it plays in **this case's** argument. The two agree on Young's two
 * artifacts and are free to disagree elsewhere.
 */
export type SourceRole = 'primary' | 'secondary';

/**
 * Whether a person has signed a row off — and a distinct third state for a role that was decided
 * against rather than left undone.
 *
 * **This is a second enum beside `SourceRightsStatus`, not a widening of it, because they answer
 * different questions.** `rightsStatus` answers *may we ship this*: a public-domain 1801 lecture is
 * `reviewed` with no human involved. `reviewerState` answers *has a person signed this off*. The
 * prototype's open item (`deferred-work.md`, the 1905 reconstruction) is exactly the gap between them —
 * `rightsStatus: 'reviewed'` on material whose reuse is trivially clear, where whether that is correct
 * is the assigned scholarly reviewer's call. One enum could not express that.
 *
 * `de-scoped` is the state ADR-008's accessibility roles occupy. It is recorded with the decision that
 * de-scoped it and rendered as such — never dropped, and never spelled `reviewed`.
 */
export type ReviewerState = 'reviewed' | 'pending' | 'de-scoped';

/**
 * The reviewer states a **row** may occupy: a source's `ledgerEntry` or an asset's `rights`.
 *
 * `de-scoped` is deliberately absent, and the reason is that the row schemas have nowhere to put the
 * decision that de-scoped them. `de-scoped` is only honest when it names its own decision — that is
 * R3, and R3 lives on `ReviewerSignOffSchema`, which is the case-level roles and has a `reference`
 * field to require. A row carrying a bare `de-scoped` with no reference is exactly the state R3's
 * message calls "indistinguishable from a role that was silently dropped", and the code review found
 * it reachable: the value parsed and rendered as the bare word, because both call sites pass
 * `undefined` for the reference. Narrowing makes the state unrepresentable rather than unvalidated,
 * which is the honest expression of what the row schemas can actually support.
 *
 * A row whose review genuinely does not apply is authored `pending` against a case-level role that
 * carries the de-scoping decision, or the decision is recorded and the row cleared.
 */
export type RowReviewerState = Extract<ReviewerState, 'reviewed' | 'pending'>;

/**
 * One reviewer role's standing. The three conditional fields are conditional on `state` and each
 * condition is enforced at load, with the offending path named:
 *
 * - `reviewed` requires `name` and a `YYYY-MM-DD` `date` — an unattributed sign-off is not one.
 * - `pending` forbids both — a name beside a pending state reads as a signature nobody gave.
 * - `de-scoped` requires `reference` — the decision that de-scoped the role.
 */
export type ReviewerSignOff = Readonly<{
    state: ReviewerState;
    /** Canonical: a reviewer's name is a proper noun, never translated copy. */
    name?: string;
    /** Canonical: `YYYY-MM-DD`, a date and not display text. */
    date?: string;
    /** Canonical: the ADR or document of record, e.g. `ADR-008`. */
    reference?: string;
}>;

/**
 * What the ledger adds to a source, and **only** what it adds.
 *
 * There is no `claimOrUse` here and no copy of the provenance, rights status or citation:
 * `caseRelationship` already *is* the claim-or-use statement, and the ledger reads
 * `provenance`, `rightsStatus` and the rendition's `citationText` from the fields that already hold
 * them. A second authored copy of any of those is a defect, not a convenience.
 */
export type LedgerEntry = Readonly<{
    sourceRole: SourceRole;
    reviewerState: RowReviewerState;
    /** Required unless `rightsStatus === 'reviewed'` (FR27). Enforced at load. */
    replacementPlan?: LocalizedText;
}>;

/**
 * The rights record for one manifest asset — the half of AC5 that did not exist before this story.
 *
 * Sources have carried provenance and rights since Story 1.5; `assets.entries[]` carried `id`, `type`
 * and `path` and nothing else, so no surface could say who holds an asset or whether its reuse was
 * cleared. Unlike a source, an asset has no `caseRelationship`, so `claimOrUse` is authored here.
 */
export type AssetRights = Readonly<{
    /** Canonical: a rights holder or originating process is a proper noun. */
    holderOrOrigin: string;
    /** The same three-state vocabulary as a source's. Reused deliberately, not forked. */
    status: SourceRightsStatus;
    claimOrUse: LocalizedText;
    reviewerState: RowReviewerState;
    /** Canonical: the repository path of the document recording this asset's origin. */
    provenanceReference: string;
    /** Required unless `status === 'reviewed'` (FR27). Enforced at load. */
    replacementPlan?: LocalizedText;
}>;

/**
 * The case-level half of the ledger: the roles FR26 names, each in one of the three reviewer states.
 *
 * Every role is required. A case cannot ship with a role nobody thought about, because `pending` is
 * the honest state for an unassigned role and the release gate blocks on it — which is the point.
 *
 * **All five roles, not three.** This sentence was true of `contentAuthor`, `scholarlyReviewer` and
 * `educatorContextSheet` and false of the other two until the code review: the evaluator carried a
 * comment where their checks should have been, on the assumption that ADR-008 guaranteed them
 * `de-scoped`, and nothing in the schema did. Both authored `pending` returned `clear` with an empty
 * blocker list. Every role now routes through the gate, so ADR-008 being revisited is a content edit
 * rather than a silent fail-open.
 */
export type CaseLedger = Readonly<{
    signOff: Readonly<{
        contentAuthor: ReviewerSignOff;
        scholarlyReviewer: ReviewerSignOff;
        /** `de-scoped` by ADR-008, recorded rather than dropped (Story 3.2 AC8's rule). */
        accessibilityReviewer: ReviewerSignOff;
    }>;
    educatorContextSheet: ReviewerSignOff;
    /** `de-scoped` by ADR-008, likewise. */
    accessibleControlsReference: ReviewerSignOff;
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
    /** The ledger's audit columns for this source (Story 3.3). Required: an unaudited row cannot ship. */
    ledgerEntry: LedgerEntry;
}>;

export const isSourceEligibleForInspection = (source: ContextualArtifact): boolean => source.rightsStatus === 'reviewed';

/**
 * The instruments a case may ask the bench to draw for a control (Story 3.4).
 *
 * One exported list so the type and `PrimaryControlSchema`'s `z.enum` cannot drift — a fourth member
 * added here is a `tsc` error at every `switch` that draws one, which is the point of deriving both
 * from it. Not a registry: three members is a switch in one instrument class, and
 * `project-context.md` §Guided-Adventure forbids the layer twice over.
 *
 * They are **three instruments, not three labels** — distinct geometry and a distinct pointer→value
 * conversion each:
 *
 * - `knob` — the default. A 270° arc from 135° with a hard stop, and a dead zone at the bottom where a
 *   real knob's shaft is. For a bounded setting whose ends are real ends.
 * - `dial` — a full circle read against a fixed index mark, no dead zone and so no wrap to guard
 *   against. For a **cyclic** quantity, where the knob's stop is an artefact of the widget rather than
 *   of the instrument. Its travel closes, so the minimum and the maximum meet at the index mark: author
 *   it only where those two really are the same reading.
 * - `slider` — linear travel along a track with a draggable thumb. For a quantity read off a scale.
 *
 * Absent means `knob`, resolved at the one place that draws rather than defaulted in the schema — a
 * schema default writes a value into the parsed object the author did not write.
 */
export const CONTROL_AFFORDANCES = ['knob', 'dial', 'slider'] as const;

export type ControlAffordance = typeof CONTROL_AFFORDANCES[number];

/** What a control is drawn as. The one resolution of the absent case; never inline a `?? 'knob'`. */
export const controlAffordance = (control: PrimaryControl): ControlAffordance => control.affordance ?? 'knob';

export type PrimaryControl = Readonly<{
    /**
     * Authored per case (Story 3.1), not a union of Young's two. Every predicate that names a control
     * is validated against the case's own authored IDs, which is what the union used to approximate.
     */
    id: string;
    label: LocalizedText;
    /**
     * The control's name as it reads inside running prose, carrying its own preposition and case —
     * `"d'écartement des fentes"`, not `"Écartement des fentes"`. See `CaseDefinitionSchema`.
     */
    inlineLabel: LocalizedText;
    /** Canonical: SI unit symbols are identical in French. */
    unit: string;
    min: number;
    max: number;
    step: number;
    defaultValue: number;
    /**
     * Which instrument the bench draws for this control. Absent means `knob` — see
     * {@link CONTROL_AFFORDANCES} for what the three are and {@link controlAffordance} for the one
     * place that resolves the absence.
     *
     * It changes only how the control is **drawn and grasped**. The authored `min`, `max`, `step` and
     * `defaultValue` and every validation over them are unchanged by the choice, both paths still snap
     * before dispatch, and the run record stores the value — so nothing here is persisted.
     */
    affordance?: ControlAffordance;
}>;

export type WavelengthMode = 'minimum' | 'advanced';

export type WavelengthComparison = Readonly<{
    // Authored, not pinned (Story 3.1 review): a second case comparing path lengths has its own
    // baseline. `advancedChoicesNm` stays a literal pair because it feeds the persisted
    // `450 | 550 | 650` union, which cannot widen without a record migration.
    fixedMinimumPathNm: number;
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
    /** Optional image asset; the accent and figure remain the vector fallback when it is unavailable. */
    portraitAssetId?: string;
    accentColor: string;
    /**
     * How he is drawn — the same optional block a colleague's portrait carries, and the same reason:
     * AC4 wants him visually distinct from the cast without that distinction being his colour.
     * Unauthored he stands with his arms folded, which is his character note rather than a default.
     */
    figure?: ColleagueFigure;
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
    criticalModelInputIds?: readonly string[];
}>;

export type CaseDefinition = Readonly<{
    /** Kebab-case, and this case's directory name under `public/cases/`. Validated by `CaseIdSchema`. */
    id: string;
    version: string;
    /** The investigation's own name, shown by the laboratory in place of a hard-coded interface string. */
    title: LocalizedText;
    openingDispute: LocalizedText;
    /** At least two: FR4 makes two sources a precondition for predicting, which is a floor. */
    contextualArtifacts: readonly ContextualArtifact[];
    prediction: Readonly<{ required: true }>;
    /** One or two, capped by `MAX_PRIMARY_CONTROLS` for the bench-geometry reason recorded there. */
    apparatus: Readonly<{ primaryControls: readonly PrimaryControl[] }>;
    experiment: Readonly<{
        /**
         * Which implemented deterministic model this case's bench runs (Story 3.2). Canonical, and
         * validated at load against `EXPERIMENT_MODEL_IDS` — never the case ID, and never `modelVersion`,
         * which is the per-run provenance stamp rather than a choice of physics.
         */
        modelId: string;
        /** Canonical: the model version is a compatibility key stored in every run record. */
        modelVersion: string;
        /** Young's fixed 550 nm. Absent for a case whose apparatus has no wavelength at all. */
        wavelengthNm?: number;
        wavelengthComparison?: WavelengthComparison;
        assumptions: LocalizedTextList;
        confound: Readonly<{ id: string; description: LocalizedText; discoverableBy: RecoveryRoute }>;
        resetPath: Readonly<{ recoveryRoute: RecoveryRoute; description: LocalizedText }>;
    }>;
    requirements: Readonly<{ minimumRuns: number; minimumSources: number; minimumSignificantRuns: number }>;
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
        minimumExperimentCycles: number;
        maximumExperimentCycles: number;
        theoryBoardReview: true;
        historicalDebrief: true;
        optionalReplay: true;
    }>;
    /**
     * The neutral auto-summary template (FR23, Story 3.1): a statement of what the player did, filled
     * from their own recorded evidence by `composeCaseSummary` and read in the printable record.
     *
     * Authored `LocalizedText` with `{placeholder}` tokens rather than a translation key, and never
     * evaluative — see `caseSummary.ts` for both reasons. Its placeholder set is validated at load
     * against `AUTO_SUMMARY_PLACEHOLDERS`, so an unknown token fails with a typed `Result` instead of
     * printing itself into the player's record.
     */
    autoSummary: LocalizedText;
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
        entries: readonly Readonly<{ id: string; type: 'image' | 'audio' | 'document'; path: string; rights: AssetRights }>[];
    }>;
    /**
     * The case-level source-and-rights ledger (Story 3.3, FR26). Required, like every field it holds:
     * the release gate reads it, and a case with no ledger is a case nobody audited.
     */
    ledger: CaseLedger;
}>;
