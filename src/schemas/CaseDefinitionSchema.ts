import { z } from 'zod';

import { DEFAULT_LOCALE, LOCALES } from '../core/i18n/Locale';
import { CASE_PHASES } from '../domain/cases/CaseProgress';
import { SCENE_KEYS } from '../domain/cases/ScenarioScript';

const stableId = z.string().trim().min(1);
const sourceRef = z.string().trim().min(1);

/**
 * Every localizable authored string must carry both shipped locales (AC3). The requirement lives in
 * the object schema itself rather than in a `superRefine`, because Zod skips refinements once the
 * base parse has failed — a missing `fr` has to be the base-parse failure, not a later one.
 */
export const LocalizedTextSchema = z.object({
    en: z.string().trim().min(1),
    fr: z.string().trim().min(1)
}).strict();

/**
 * The list variant. Equal lengths across locales is a genuine cross-field rule, so it belongs in a
 * refinement: an `assumptions` list with four English entries and three French ones is a content
 * defect, not a translation choice.
 */
export const LocalizedTextListSchema = z.object({
    en: z.array(z.string().trim().min(1)).min(1),
    fr: z.array(z.string().trim().min(1)).min(1)
}).strict().superRefine((list, context) => {
    if (list.en.length !== list.fr.length) {
        context.addIssue({
            code: 'custom',
            message: 'A localized list must provide the same number of entries in every locale.',
            path: ['fr']
        });
    }
});
/**
 * Detection phrases, not display text. Deliberately *not* {@link LocalizedTextListSchema}: that
 * schema's equal-length rule encodes a display correspondence (entry 3 of `assumptions` is the same
 * assumption in either language), and detection phrases have no such correspondence. One English
 * verb can need two French renderings, and French inflects where English does not — `prouve` and
 * `prouvent` are both required, and neither has an English counterpart to pad the list with.
 */
export const DetectionPhraseListSchema = z.object({
    en: z.array(z.string().trim().min(1)).min(1),
    fr: z.array(z.string().trim().min(1)).min(1)
}).strict();

const isOnStep = (value: number, min: number, step: number): boolean =>
    Math.abs((value - min) / step - Math.round((value - min) / step)) < 0.0000001;

const PrimaryControlSchema = z.object({
    id: z.enum(['slitSpacingMm', 'screenDistanceM']),
    label: LocalizedTextSchema,
    unit: z.string().trim().min(1),
    min: z.number().finite(),
    max: z.number().finite(),
    step: z.number().positive().finite(),
    defaultValue: z.number().finite()
}).strict().superRefine((control, context) => {
    if (control.max <= control.min) {
        context.addIssue({ code: 'custom', message: 'Control max must be greater than min.', path: ['max'] });
    }

    if (control.defaultValue < control.min || control.defaultValue > control.max || !isOnStep(control.defaultValue, control.min, control.step)) {
        context.addIssue({ code: 'custom', message: 'Control default must be in range and aligned to its step.', path: ['defaultValue'] });
    }
});

const RecoveryRouteSchema = z.enum(['replication', 'control-change', 'source-comparison']);
/**
 * The three artifact-classification enums are exported so `I18n.test.ts` can derive its required
 * `source.*` key roster from them rather than transcribing the members. A hand-copied list is a list
 * that stops being updated: a fourth provenance category would have been added here and not there,
 * and the test would have kept passing while the detail panel rendered a raw enum value.
 */
export const SourceProvenanceCategorySchema = z.enum(['primary-material', 'reconstruction', 'later-interpretation', 'deliberate-fiction']);
export const SourceTypeSchema = z.enum(['lecture-record', 'published-book', 'reconstruction', 'interpretive-essay', 'fictionalized-account']);
export const SourceRightsStatusSchema = z.enum(['reviewed', 'incomplete', 'unavailable']);

const TextualRenditionSectionSchema = z.object({
    id: stableId,
    heading: z.string().trim().min(1),
    paragraphs: z.array(z.string().trim().min(1)).min(1),
    sourcePages: z.array(z.number().int().positive()).min(1)
}).strict();

const LocalizedTextualRenditionSchema = z.object({
    locale: z.enum(LOCALES),
    kind: z.enum(['transcription', 'translation']),
    sections: z.array(TextualRenditionSectionSchema).min(1)
}).strict().superRefine((rendition, context) => {
    const ids = rendition.sections.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
        context.addIssue({ code: 'custom', message: 'Rendition section IDs must be stable and unique.', path: ['sections'] });
    }
});

const TextualRenditionSchema = z.object({
    readerLabel: LocalizedTextSchema,
    citation: z.object({
        reuseStatement: LocalizedTextSchema,
        // Canonical: the citation of record and its archive link are bibliographic, not display copy.
        citationText: z.string().trim().min(1),
        archiveUrl: z.string().url().refine((url) => new URL(url).protocol === 'https:', 'Archive URLs must use HTTPS.')
    }).strict(),
    summary: LocalizedTextListSchema.optional(),
    renditions: z.tuple([LocalizedTextualRenditionSchema, LocalizedTextualRenditionSchema])
}).strict().superRefine((rendition, context) => {
    const [first, second] = rendition.renditions;
    if (new Set([first.locale, second.locale]).size !== LOCALES.length) {
        context.addIssue({ code: 'custom', message: 'A readable source must provide exactly one rendition per shipped locale.', path: ['renditions'] });
    }
    // Exactly one rendition may claim to reproduce the printed source; the rest are translations of
    // it. Two transcriptions of the same pages in different languages is a provenance claim nobody
    // has reviewed, which is precisely what this rule exists to stop.
    //
    // The transcription must be `en`. The reader-facing notice (`book.translatedRendition`) names
    // English as the original in both locales, so a French transcription with an English translation
    // would state the provenance backwards on the page. Pinning it here keeps that string true by
    // construction; generalising the notice is the prerequisite for relaxing this rule.
    const transcriptions = rendition.renditions.filter(({ kind }) => kind === 'transcription');
    if (transcriptions.length !== 1) {
        context.addIssue({ code: 'custom', message: 'Exactly one rendition may be the transcription of record; any others are translations.', path: ['renditions'] });
    } else if (transcriptions[0].locale !== DEFAULT_LOCALE) {
        context.addIssue({ code: 'custom', message: 'The transcription of record must be the English rendition; the reader-facing notice names English as the original.', path: ['renditions'] });
    }
    // Page-for-page alignment keeps the spread count and the printed page numbers identical in
    // either language, so "spread 3 of 19" means the same thing to every reader.
    const shape = (candidate: typeof first): string =>
        JSON.stringify(candidate.sections.map(({ id, sourcePages, paragraphs }) => [id, sourcePages, paragraphs.length]));
    if (shape(first) !== shape(second)) {
        context.addIssue({
            code: 'custom',
            message: 'Every rendition must cover the same source pages, in the same order, with the same number of paragraphs.',
            path: ['renditions']
        });
    }
});

const ContextualArtifactSchema = z.object({
    id: stableId,
    displayName: LocalizedTextSchema,
    creatorOrOrigin: z.string().trim().min(1),
    sourceType: SourceTypeSchema,
    provenance: z.object({
        category: SourceProvenanceCategorySchema,
        reference: sourceRef
    }).strict(),
    rightsStatus: SourceRightsStatusSchema,
    caseRelationship: LocalizedTextSchema,
    textualRendition: TextualRenditionSchema.optional()
}).strict();

const ConsultationPredicateSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('missing-run') }).strict(),
    z.object({ kind: z.literal('missing-source'), sourceId: stableId }).strict(),
    z.object({ kind: z.literal('alternative-test'), controlId: z.enum(['slitSpacingMm', 'screenDistanceM']) }).strict(),
    z.object({ kind: z.literal('missing-limitation') }).strict()
]);

const ConsultationRuleSchema = z.object({
    id: stableId,
    predicate: ConsultationPredicateSchema,
    layers: z.object({
        observation: LocalizedTextSchema,
        plainLanguage: LocalizedTextSchema,
        technicalDetail: LocalizedTextSchema
    }).strict(),
    nextStep: LocalizedTextSchema
}).strict();

const PeerReviewRuleSchema = z.object({
    id: stableId,
    predicate: z.object({
        kind: z.enum(['missing-evidence', 'unsupported-support', 'overreach']),
        // Detection phrases, not display text: both locales are always matched as a union, and the
        // two lists are sized independently. See {@link DetectionPhraseListSchema}.
        overreachPhrases: DetectionPhraseListSchema.optional()
    }).strict(),
    feedback: LocalizedTextSchema,
    revisionPath: LocalizedTextSchema
}).strict();

/**
 * When a run counts as a distinguishing measurement (Story 2.6).
 *
 * `criticalControlIds` is `.min(1)` and its entries are checked against the authored controls in the
 * top-level refinement, where the message can name the offending ID. `criticalModelInputIds` is
 * `.min(1)` when present for the same reason an empty control list is rejected: an empty list is an
 * author writing a field that does nothing, which is worth failing on rather than silently accepting.
 *
 * There is no reading-distance field. One existed (`minimumResultDelta`) and was removed in review
 * (2026-08-06) because it made the count depend on recording order; see {@link SignificanceRule}.
 */
const SignificanceRuleSchema = z.object({
    criticalControlIds: z.array(z.enum(['slitSpacingMm', 'screenDistanceM'])).min(1),
    criticalModelInputIds: z.array(z.enum(['wavelengthNm'])).min(1).optional()
}).strict();

const ColleagueHintPredicateSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('no-recorded-runs') }).strict(),
    z.object({ kind: z.literal('repeated-configuration') }).strict(),
    z.object({ kind: z.literal('unvaried-control'), controlId: z.enum(['slitSpacingMm', 'screenDistanceM']) }).strict(),
    z.object({ kind: z.literal('below-significant-measures') }).strict()
]);

/**
 * The same bound, and the same reason, as {@link RivalLabCritiqueSchema}'s: the hint is drawn into a
 * fixed lab surface with no scroll, and clamping the prose at runtime would truncate the one thing
 * the player needs to read. Failing at case load puts the problem where an author can see it.
 */
const MAX_HINT_LINE_LENGTH = 320;

const ColleagueHintSchema = z.object({
    id: stableId,
    colleagueId: stableId,
    predicate: ColleagueHintPredicateSchema,
    line: LocalizedTextSchema.refine(
        ({ en, fr }) => en.length <= MAX_HINT_LINE_LENGTH && fr.length <= MAX_HINT_LINE_LENGTH,
        `A colleague hint must be at most ${MAX_HINT_LINE_LENGTH} characters in each locale.`
    )
}).strict();

const ReadingGateHintPredicateSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('missing-artifact'), artifactId: stableId }).strict(),
    z.object({ kind: z.literal('any-missing-reading') }).strict()
]);

/**
 * The same bound, and the same reason, as {@link ColleagueHintSchema}'s: the line is drawn into a
 * fixed reading-room band with no scroll, and clamping the prose at runtime would truncate the one
 * thing the player needs to read. Failing at case load puts the problem where an author can see it.
 */
const MAX_READING_GATE_LINE_LENGTH = 320;

const ReadingGateHintSchema = z.object({
    id: stableId,
    colleagueId: stableId,
    predicate: ReadingGateHintPredicateSchema,
    line: LocalizedTextSchema.refine(
        ({ en, fr }) => en.length <= MAX_READING_GATE_LINE_LENGTH && fr.length <= MAX_READING_GATE_LINE_LENGTH,
        `A reading-gate line must be at most ${MAX_READING_GATE_LINE_LENGTH} characters in each locale.`
    )
}).strict();

const ColleagueRoleSchema = z.enum(['lead', 'builder', 'analyst', 'communicator']);

/**
 * How a figure is drawn, as a closed vocabulary rather than free-form art direction.
 *
 * Enums and booleans only, and **no authored colour** beyond the accent that is already there: the
 * room is lit warm and dark, and a free `hairColor` would eventually carry one that does not sit in
 * that light. Every field is optional and the whole block is optional, so this is additive — no case
 * that validated before this schema changed stops validating now.
 */
const ColleagueFigureSchema = z.object({
    build: z.enum(['suited', 'gowned']).optional(),
    pose: z.enum(['at-rest', 'arms-folded', 'holding-paper', 'raising-instrument', 'presenting']).optional(),
    hair: z.enum(['cropped', 'swept', 'upswept']).optional(),
    hairColor: z.enum(['dark', 'auburn', 'fair', 'grey']).optional(),
    skinTone: z.enum(['light', 'tan', 'brown', 'deep']).optional(),
    spectacles: z.boolean().optional(),
    moustache: z.boolean().optional()
}).strict();

const ColleaguePortraitSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('asset'), assetId: stableId }).strict(),
    // Lower-case six-digit hex only: the renderer parses it with `Number.parseInt(…, 16)`, and a
    // single canonical spelling keeps authored accents comparable at a glance.
    z.object({
        kind: z.literal('silhouette'),
        accentColor: z.string().regex(/^#[0-9a-f]{6}$/, 'A silhouette accent must be a lower-case #rrggbb colour.'),
        figure: ColleagueFigureSchema.optional()
    }).strict()
]);

const ColleagueSchema = z.object({
    id: stableId,
    // Canonical: a proper noun, following the `creatorOrOrigin` precedent. The *role* is what gets
    // localized, by stable enum value.
    name: z.string().trim().min(1),
    role: ColleagueRoleSchema,
    portrait: ColleaguePortraitSchema
}).strict();

/**
 * Support predicates, built as three explicit nested levels rather than `z.lazy`.
 *
 * The bound is the point: an authored `all-of` tree has no business nesting deeper than this, and an
 * unbounded recursive schema would accept one. Writing the levels out also sidesteps Zod 4's `lazy`
 * inference gap — no `z.ZodType<T>` annotation is needed, so the inferred type stays a real
 * discriminated union that structurally matches `ConclusionSupportPredicate`.
 *
 * An empty `predicates` array is rejected in the top-level refinement rather than with `.min(1)`
 * here, so the failure carries the authored explanation instead of a generic `too_small`.
 */
const leafSupportPredicates = [
    z.object({ kind: z.literal('never') }).strict(),
    z.object({ kind: z.literal('minimum-runs'), count: z.number().int().positive() }).strict(),
    z.object({ kind: z.literal('varied-control'), controlId: z.enum(['slitSpacingMm', 'screenDistanceM']) }).strict(),
    z.object({ kind: z.literal('inspected-source'), sourceId: stableId }).strict()
] as const;

const allOfSchema = <T extends z.ZodTypeAny>(child: T) =>
    z.object({ kind: z.literal('all-of'), predicates: z.array(child) }).strict();

/** Depth 3: leaves, an `all-of` over leaves, and an `all-of` over those. */
const SupportPredicateDepth3Schema = z.discriminatedUnion('kind', [...leafSupportPredicates]);
const SupportPredicateDepth2Schema = z.discriminatedUnion('kind', [...leafSupportPredicates, allOfSchema(SupportPredicateDepth3Schema)]);
const ConclusionSupportPredicateSchema = z.discriminatedUnion('kind', [...leafSupportPredicates, allOfSchema(SupportPredicateDepth2Schema)]);

const PredictionProposalSchema = z.object({
    id: stableId,
    colleagueId: stableId,
    text: LocalizedTextSchema
}).strict();

const ConclusionProposalSchema = z.object({
    id: stableId,
    colleagueId: stableId,
    claim: LocalizedTextSchema,
    limitation: LocalizedTextSchema,
    supportPredicate: ConclusionSupportPredicateSchema
}).strict();

/**
 * One rival-lab critique. `line` is {@link LocalizedTextSchema} and deliberately **not**
 * {@link DetectionPhraseListSchema}: this is prose the player reads, so both locales carry one
 * corresponding string, not two independently-sized match lists.
 */
/**
 * The bound on an authored objection, in characters, per locale.
 *
 * `RivalLabRenderer` anchors its revise control to the canvas floor so the way back always exists, and
 * clamps the guide just above it — but the body itself is deliberately unclamped, because truncating
 * the objection is the one thing that surface must not do. That leaves the prose as the only thing that
 * can overrun: past roughly 3000 characters it reaches the guide and then runs off a non-scrolling
 * 1024×768 `Scale.FIT` surface, where nobody can read it and no author can see that it happened.
 *
 * So the bound is enforced here, at case load, where a failure names the critique and an author can act
 * on it. It sits well under the geometric ceiling on purpose: it is an editorial bound, not a last line
 * of defence. The longest authored line today is 404 characters (2.5 review).
 */
const MAX_CRITIQUE_LINE_LENGTH = 700;

const RivalLabCritiqueSchema = z.object({
    id: stableId,
    proposalId: stableId,
    line: LocalizedTextSchema.refine(
        ({ en, fr }) => en.length <= MAX_CRITIQUE_LINE_LENGTH && fr.length <= MAX_CRITIQUE_LINE_LENGTH,
        `A rival-lab critique must be at most ${MAX_CRITIQUE_LINE_LENGTH} characters in each locale.`
    )
}).strict();

const RivalLabSchema = z.object({
    // Canonical: a proper noun, following the `Colleague.name` and `creatorOrOrigin` precedent.
    name: z.string().trim().min(1),
    // The same lower-case #rrggbb rule the colleague silhouette uses: the renderer parses it with
    // `Number.parseInt(…, 16)`, and one canonical spelling keeps authored accents comparable.
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/, 'A rival-lab accent must be a lower-case #rrggbb colour.'),
    // The same optional block a colleague's portrait carries, validated by the same schema — he is
    // drawn by the same renderer and there is no second vocabulary for him to be authored in.
    figure: ColleagueFigureSchema.optional(),
    // `.min(1)` only. Full coverage of the conclusion proposals is a cross-field rule and lives in the
    // top-level refinement, where the message can name what is actually missing.
    critiques: z.array(RivalLabCritiqueSchema).min(1)
}).strict();

/** Walks an authored predicate tree, including nested `all-of` children. */
const flattenSupportPredicates = (
    predicate: z.infer<typeof ConclusionSupportPredicateSchema>
): readonly z.infer<typeof SupportPredicateDepth3Schema>[] => predicate.kind === 'all-of'
    ? predicate.predicates.flatMap((child) => flattenSupportPredicates(child as z.infer<typeof ConclusionSupportPredicateSchema>))
    : [predicate];

/** True only where some evidence could satisfy the predicate — an empty `all-of` is not "some". */
const isSatisfiablePredicate = (predicate: z.infer<typeof ConclusionSupportPredicateSchema>): boolean => predicate.kind === 'never'
    ? false
    : predicate.kind !== 'all-of'
        || (predicate.predicates.length > 0
            && predicate.predicates.every((child) => isSatisfiablePredicate(child as z.infer<typeof ConclusionSupportPredicateSchema>)));

const hasEmptyAllOf = (predicate: z.infer<typeof ConclusionSupportPredicateSchema>): boolean => predicate.kind === 'all-of'
    && (predicate.predicates.length === 0
        || predicate.predicates.some((child) => hasEmptyAllOf(child as z.infer<typeof ConclusionSupportPredicateSchema>)));

const ScenarioDialogueBeatSchema = z.object({
    id: stableId,
    speakerId: stableId,
    // Authored prose, not a bundle key. See `ScenarioDialogueBeat` for why the key shape could not work.
    text: LocalizedTextSchema
}).strict();

const ScenarioSceneSchema = z.object({
    phase: z.enum(CASE_PHASES),
    sceneKey: z.enum(SCENE_KEYS),
    // No `.min` here either, for the same reason it is absent on `scenes` below. `"dialogueBeats": []`
    // is the natural way to write "no conversation yet", and as a base-parse failure it reported a
    // generic too_small *and* skipped the whole top-level superRefine — silencing every authored-content
    // message at once (unresolved speakerId, encodesPath, duplicate beat ids, and the rules that have
    // nothing to do with this field), so an author fixed one problem at a time from a message that named
    // none of them (1.12 review). An empty array and an absent field both mean "no beats", which
    // `selectDialogueBeats` already treats identically.
    dialogueBeats: z.array(ScenarioDialogueBeatSchema).optional()
}).strict();

// No `.min` on `scenes`: Zod skips a superRefine once the base parse has failed, so a length rule
// would intercept the most common authoring mistake — a missing phase — and report a generic
// too_small instead of the authored message. The refinement below is the single coverage rule.
const ScenarioScriptSchema = z.object({
    scenes: z.array(ScenarioSceneSchema)
}).strict().superRefine((script, context) => {
    const phases = script.scenes.map(({ phase }) => phase);
    if (new Set(phases).size !== phases.length || CASE_PHASES.some((phase) => !phases.includes(phase))) {
        context.addIssue({
            code: 'custom',
            message: 'The scenario script must map every case phase exactly once.',
            path: ['scenes']
        });
    }
});

/**
 * Authored help content must describe *what to do next*, never the route the app takes to get there.
 *
 * Arrows are the reliable cross-language signal and are matched identically in both locales.
 *
 * The *word* list has to be locale-specific: `route` and `phase` are ordinary French words (and
 * `scène` reads naturally in "mise en scène"), so applying the English list to French copy produces
 * only false positives and pressure to mangle the translation. French is guarded at the phrase level
 * instead — "ouvrez la scène" encodes a route, "la mise en scène de l'expérience" does not — which
 * catches the real failure without punishing legitimate copy.
 */
const FORBIDDEN_ARROWS = /(?:→|⇒|⟶|->|=>)/;

/**
 * A word boundary that understands accents. `\b` is ASCII-only, so `\bétape` never matches — the
 * position before `é` is not a boundary because `é` is not a `\w` character. Every French pattern
 * here has to use this instead.
 */
const word = (pattern: string): string => `(?:^|[^\\p{L}\\p{N}_])(?:${pattern})(?=$|[^\\p{L}\\p{N}_])`;

const forbiddenPath: Readonly<Record<'en' | 'fr', readonly RegExp[]>> = {
    en: [FORBIDDEN_ARROWS, new RegExp(word('scene|phase|route'), 'iu')],
    fr: [
        FORBIDDEN_ARROWS,
        new RegExp(`${word('ouvrez|allez|rendez-vous|retournez|naviguez|passez')}[^.!?]{0,20}${word('scène|phase|étape|écran|route')}`, 'iu')
    ]
};

const encodesPath = (text: Readonly<{ en: string; fr: string }>): boolean =>
    forbiddenPath.en.some((pattern) => pattern.test(text.en))
    || forbiddenPath.fr.some((pattern) => pattern.test(text.fr));

export const AssetManifestSchema = z.object({
    manifestVersion: z.string().trim().min(1),
    entries: z.array(z.object({
        id: stableId,
        type: z.enum(['image', 'audio', 'document']),
        path: z.string().regex(/^\/(?!\/)/, 'Asset paths must be same-origin static root paths.')
    }).strict()).min(1)
}).strict().superRefine((manifest, context) => {
    if (new Set(manifest.entries.map((asset) => asset.id)).size !== manifest.entries.length) {
        context.addIssue({ code: 'custom', message: 'Asset IDs must be stable and unique.', path: ['entries'] });
    }
});

export const CaseDefinitionSchema = z.object({
    id: z.literal('young-interference'),
    version: z.string().trim().min(1),
    openingDispute: LocalizedTextSchema,
    contextualArtifacts: z.tuple([ContextualArtifactSchema, ContextualArtifactSchema]),
    prediction: z.object({ required: z.literal(true) }).strict(),
    apparatus: z.object({ primaryControls: z.tuple([PrimaryControlSchema, PrimaryControlSchema]) }).strict(),
    experiment: z.object({
        modelVersion: z.string().trim().min(1),
        wavelengthNm: z.literal(550),
        wavelengthComparison: z.object({
            fixedMinimumPathNm: z.literal(550),
            advancedChoicesNm: z.tuple([z.literal(450), z.literal(650)])
        }).strict().optional(),
        assumptions: LocalizedTextListSchema,
        confound: z.object({
            id: stableId,
            description: LocalizedTextSchema,
            discoverableBy: RecoveryRouteSchema
        }).strict(),
        resetPath: z.object({
            recoveryRoute: RecoveryRouteSchema,
            description: LocalizedTextSchema
        }).strict()
    }).strict(),
    requirements: z.object({
        minimumRuns: z.literal(2),
        minimumSources: z.literal(2),
        // The ≥2-significant-measure gate. A literal for the same reason the other two are: the count
        // is the design, not a tuning knob.
        minimumSignificantRuns: z.literal(2)
    }).strict(),
    significanceRule: SignificanceRuleSchema,
    // `.min(1)` only. "At least one hint applies with no runs recorded" is a cross-field rule and
    // lives in the top-level refinement, where the message can say what is missing and why.
    colleagueHints: z.array(ColleagueHintSchema).min(1),
    // `.min(1)` only, for the same reason: "a floor is authored and authored last" is a cross-field
    // rule and lives in the top-level refinement, where the message can say what is missing and why.
    readingGateHints: z.array(ReadingGateHintSchema).min(1),
    colleagues: z.array(ColleagueSchema).min(1),
    // `.length(4)`, not `.min(4)`: the pivot makes both the prediction and the conclusion a 1-of-4
    // attributed choice, and a wrong count is unambiguous enough that a generic length failure reads
    // correctly without an authored message.
    predictionProposals: z.array(PredictionProposalSchema).length(4),
    conclusionProposals: z.array(ConclusionProposalSchema).length(4),
    rivalLab: RivalLabSchema,
    consultationRules: z.array(ConsultationRuleSchema).min(4),
    peerReviewRules: z.array(PeerReviewRuleSchema).min(3),
    flow: z.object({
        openingDispute: z.literal(true),
        curatedRecord: z.literal(true),
        labSetup: z.literal(true),
        minimumExperimentCycles: z.literal(2),
        maximumExperimentCycles: z.literal(4),
        theoryBoardReview: z.literal(true),
        historicalDebrief: z.literal(true),
        optionalReplay: z.literal(true)
    }).strict(),
    scenarioScript: ScenarioScriptSchema,
    debrief: z.object({
        summary: LocalizedTextSchema,
        sourceRefs: z.array(sourceRef).min(1),
        historicalComparison: z.object({
            title: LocalizedTextSchema,
            text: LocalizedTextSchema,
            sourceIds: z.tuple([stableId, stableId])
        }).strict(),
        deeperTheory: z.object({ title: LocalizedTextSchema, text: LocalizedTextSchema }).strict(),
        replayLabel: LocalizedTextSchema
    }).strict(),
    assets: AssetManifestSchema
}).strict().superRefine((definition, context) => {
    const controls = Object.fromEntries(definition.apparatus.primaryControls.map((control) => [control.id, control]));
    const slitSpacing = controls.slitSpacingMm;
    const screenDistance = controls.screenDistanceM;

    if (!slitSpacing || slitSpacing.min !== 0.1 || slitSpacing.max !== 0.5 || slitSpacing.step !== 0.05) {
        context.addIssue({ code: 'custom', message: 'Young slit spacing must be 0.10–0.50 mm in 0.05 mm steps.', path: ['apparatus', 'primaryControls'] });
    }

    if (!screenDistance || screenDistance.min !== 1 || screenDistance.max !== 4 || screenDistance.step !== 0.25) {
        context.addIssue({ code: 'custom', message: 'Young screen distance must be 1.0–4.0 m in 0.25 m steps.', path: ['apparatus', 'primaryControls'] });
    }

    if (new Set(definition.contextualArtifacts.map((artifact) => artifact.id)).size !== 2) {
        context.addIssue({ code: 'custom', message: 'Contextual artifact IDs must be stable and unique.', path: ['contextualArtifacts'] });
    }

    const consultationIds = definition.consultationRules.map((rule) => rule.id);
    const peerReviewIds = definition.peerReviewRules.map((rule) => rule.id);
    if (new Set(consultationIds).size !== consultationIds.length || new Set(peerReviewIds).size !== peerReviewIds.length) {
        context.addIssue({ code: 'custom', message: 'Consultation and peer-review rule IDs must be unique.', path: ['consultationRules'] });
    }
    const sourceIds = new Set(definition.contextualArtifacts.map((artifact) => artifact.id));
    definition.contextualArtifacts.forEach((artifact, index) => {
        if (artifact.textualRendition && artifact.rightsStatus !== 'reviewed') {
            context.addIssue({ code: 'custom', message: 'Only reviewed sources may provide a local textual rendition.', path: ['contextualArtifacts', index, 'textualRendition'] });
        }
        // The converse, and the one that matters at play time (Story 2.8 review).
        //
        // `isSourceEligibleForInspection` is `rightsStatus === 'reviewed'` alone, so
        // `evaluateContextReadiness` requires every reviewed artifact to be *inspected* before the
        // player may leave the reading room. But the room refuses to open an artifact with no rendition
        // — correctly, per AC3 — and so never dispatches `source.inspected` for it, while the reducer
        // would have accepted it. The result was authorable content that shut the context gate forever:
        // readiness could never reach `ready`, and the colleague's hint kept naming a reference the room
        // had just said could not be read. Unreachable with shipped Young content, and an unconditional
        // soft-lock once Story 2.12 removes the DOM panel that dispatches unconditionally.
        //
        // Closed here rather than at play time because a case that cannot be finished is a content
        // defect, and the cheapest place to say so is at load, once, with the artifact's own path.
        if (artifact.rightsStatus === 'reviewed' && !artifact.textualRendition) {
            context.addIssue({
                code: 'custom',
                message: 'A reviewed source must provide a local textual rendition: context readiness requires it to be inspected, and a source with nothing to read can never be.',
                path: ['contextualArtifacts', index, 'textualRendition']
            });
        }
    });
    if (definition.debrief.historicalComparison.sourceIds.some((sourceId) => !sourceIds.has(sourceId)
        || definition.debrief.historicalComparison.sourceIds[0] === definition.debrief.historicalComparison.sourceIds[1])) {
        context.addIssue({ code: 'custom', message: 'Historical comparison must cite two distinct authored sources.', path: ['debrief', 'historicalComparison', 'sourceIds'] });
    }
    const controlIds = new Set(definition.apparatus.primaryControls.map((control) => control.id));
    definition.consultationRules.forEach((rule, index) => {
        if (rule.predicate.kind === 'missing-source' && !sourceIds.has(rule.predicate.sourceId)) {
            context.addIssue({ code: 'custom', message: 'Consultation rules may only reference authored sources.', path: ['consultationRules', index, 'predicate', 'sourceId'] });
        }
        if (rule.predicate.kind === 'alternative-test' && !controlIds.has(rule.predicate.controlId)) {
            context.addIssue({ code: 'custom', message: 'Consultation rules may only reference authored controls.', path: ['consultationRules', index, 'predicate', 'controlId'] });
        }
        if (Object.values(rule.layers).some(encodesPath) || encodesPath(rule.nextStep)) {
            context.addIssue({ code: 'custom', message: 'Authored help content must not encode a scene, route, or phase path.', path: ['consultationRules', index] });
        }
    });
    definition.peerReviewRules.forEach((rule, index) => {
        if (encodesPath(rule.feedback) || encodesPath(rule.revisionPath)) {
            context.addIssue({ code: 'custom', message: 'Peer-review content must not encode a scene, route, or phase path.', path: ['peerReviewRules', index] });
        }
        if (rule.predicate.kind === 'overreach' && !rule.predicate.overreachPhrases) {
            context.addIssue({ code: 'custom', message: 'An overreach rule needs authored signal phrases.', path: ['peerReviewRules', index, 'predicate'] });
        }
    });

    // --- Colleague cast and proposals -----------------------------------------------------------

    const colleagueIds = new Set(definition.colleagues.map(({ id }) => id));
    if (colleagueIds.size !== definition.colleagues.length) {
        context.addIssue({ code: 'custom', message: 'Colleague IDs must be stable and unique.', path: ['colleagues'] });
    }
    const assetIds = new Set(definition.assets.entries.map(({ id }) => id));
    definition.colleagues.forEach((colleague, index) => {
        // A portrait naming an absent asset would pass the strict parse and then fail
        // `manifestsMatch` at load with a message about the manifest rather than the cast.
        if (colleague.portrait.kind === 'asset' && !assetIds.has(colleague.portrait.assetId)) {
            context.addIssue({ code: 'custom', message: 'A colleague asset portrait must name an authored asset.', path: ['colleagues', index, 'portrait', 'assetId'] });
        }
    });

    // Unique *within* each set: a prediction and a conclusion proposal may share an id without
    // ambiguity, because each is looked up against its own set.
    ([['predictionProposals', definition.predictionProposals], ['conclusionProposals', definition.conclusionProposals]] as const)
        .forEach(([field, proposals]) => {
            if (new Set(proposals.map(({ id }) => id)).size !== proposals.length) {
                context.addIssue({ code: 'custom', message: 'Proposal IDs must be unique within each proposal set.', path: [field] });
            }
            proposals.forEach((proposal, index) => {
                if (!colleagueIds.has(proposal.colleagueId)) {
                    context.addIssue({ code: 'custom', message: 'Every proposal must be attributed to an authored colleague.', path: [field, index, 'colleagueId'] });
                }
            });
        });

    definition.predictionProposals.forEach((proposal, index) => {
        if (encodesPath(proposal.text)) {
            context.addIssue({ code: 'custom', message: 'Authored proposal copy must not encode a scene, route, or phase path.', path: ['predictionProposals', index, 'text'] });
        }
    });

    definition.conclusionProposals.forEach((proposal, index) => {
        if (encodesPath(proposal.claim) || encodesPath(proposal.limitation)) {
            context.addIssue({ code: 'custom', message: 'Authored proposal copy must not encode a scene, route, or phase path.', path: ['conclusionProposals', index] });
        }
        // An empty `all-of` is vacuously true, which would silently make an overreaching claim
        // defensible — the exact failure the `never` kind exists to express explicitly.
        if (hasEmptyAllOf(proposal.supportPredicate)) {
            context.addIssue({ code: 'custom', message: 'An all-of support predicate needs at least one child predicate.', path: ['conclusionProposals', index, 'supportPredicate'] });
        }
        flattenSupportPredicates(proposal.supportPredicate).forEach((leaf) => {
            if (leaf.kind === 'inspected-source' && !sourceIds.has(leaf.sourceId)) {
                context.addIssue({ code: 'custom', message: 'Conclusion proposals may only reference authored sources.', path: ['conclusionProposals', index, 'supportPredicate'] });
            }
            if (leaf.kind === 'varied-control' && !controlIds.has(leaf.controlId)) {
                context.addIssue({ code: 'custom', message: 'Conclusion proposals may only reference authored controls.', path: ['conclusionProposals', index, 'supportPredicate'] });
            }
        });
    });

    // Without this the case is uncompletable by construction: every conclusion on offer would be
    // one the evaluator can never defend, and no evidence the player gathers would change that.
    if (definition.conclusionProposals.length > 0 && !definition.conclusionProposals.some(({ supportPredicate }) => isSatisfiablePredicate(supportPredicate))) {
        context.addIssue({ code: 'custom', message: 'At least one conclusion proposal must be defensible on some evidence.', path: ['conclusionProposals'] });
    }

    // --- Significant-measure gate and colleague hints (Story 2.6) -------------------------------
    //
    // Here rather than in the field schemas: every rule below is about the rule and the hints
    // *against the authored controls and cast*, which neither schema can see.

    definition.significanceRule.criticalControlIds.forEach((controlId, index) => {
        if (!controlIds.has(controlId)) {
            context.addIssue({
                code: 'custom',
                message: 'The significance rule may only name authored primary controls.',
                path: ['significanceRule', 'criticalControlIds', index]
            });
        }
    });
    if (new Set(definition.significanceRule.criticalControlIds).size !== definition.significanceRule.criticalControlIds.length) {
        context.addIssue({
            code: 'custom',
            message: 'The significance rule must not name the same control twice.',
            path: ['significanceRule', 'criticalControlIds']
        });
    }
    const criticalModelInputIds = definition.significanceRule.criticalModelInputIds ?? [];
    if (new Set(criticalModelInputIds).size !== criticalModelInputIds.length) {
        context.addIssue({
            code: 'custom',
            message: 'The significance rule must not name the same model input twice.',
            path: ['significanceRule', 'criticalModelInputIds']
        });
    }

    const hintIds = definition.colleagueHints.map(({ id }) => id);
    if (new Set(hintIds).size !== hintIds.length) {
        context.addIssue({ code: 'custom', message: 'Colleague hint IDs must be stable and unique.', path: ['colleagueHints'] });
    }
    definition.colleagueHints.forEach((hint, index) => {
        if (!colleagueIds.has(hint.colleagueId)) {
            context.addIssue({
                code: 'custom',
                // The rival lab is deliberately not in `colleagues[]`, so this also stops an author
                // putting the challenger's voice behind a helpful nudge.
                message: 'Every colleague hint must be attributed to an authored colleague.',
                path: ['colleagueHints', index, 'colleagueId']
            });
        }
        if (hint.predicate.kind === 'unvaried-control' && !controlIds.has(hint.predicate.controlId)) {
            context.addIssue({
                code: 'custom',
                message: 'Colleague hints may only reference authored controls.',
                path: ['colleagueHints', index, 'predicate', 'controlId']
            });
        }
        // Naming a control the significance rule does not consider critical produces advice that
        // cannot work: the player varies exactly what they were told to, the configuration key never
        // changes, the count never moves, and the gate refuses again with the same hint. A colleague
        // must not send someone to do something that provably cannot open the way on.
        if (hint.predicate.kind === 'unvaried-control'
            && controlIds.has(hint.predicate.controlId)
            && !new Set<string>(definition.significanceRule.criticalControlIds).has(hint.predicate.controlId)) {
            context.addIssue({
                code: 'custom',
                message: 'A colleague hint may only ask the player to vary a control the significance rule treats as critical.',
                path: ['colleagueHints', index, 'predicate', 'controlId']
            });
        }
        if (encodesPath(hint.line)) {
            context.addIssue({
                code: 'custom',
                message: 'Colleague hint copy must not encode a scene, route, or phase path.',
                path: ['colleagueHints', index, 'line']
            });
        }
    });

    // The floor that makes the gate honest, and the two things that have to be true about it.
    //
    // Only `below-significant-measures` actually delivers the guarantee. An earlier version of this
    // rule accepted `no-recorded-runs` as an alternative (review, 2026-08-06), but that predicate
    // holds *only* with an empty notebook: a case authoring it alone passes validation and then goes
    // silent the instant the player records their first run — the advance refused, nothing said, no
    // way to learn what would help. That is the silent dead end AC2 forbids, reached through a rule
    // written to prevent it.
    const floorIndex = definition.colleagueHints.findIndex(({ predicate }) => predicate.kind === 'below-significant-measures');
    if (floorIndex === -1) {
        context.addIssue({
            code: 'custom',
            message: 'Colleague hints must include a below-significant-measures hint, so the gate always has something to say.',
            path: ['colleagueHints']
        });
    } else if (floorIndex !== definition.colleagueHints.length - 1) {
        // Selection is first-match in authored order and this predicate is unconditionally true, so
        // anywhere but last it shadows every hint after it: the escalation ladder silently collapses
        // to one generic line at every stage, and the specific hints become unreachable content that
        // no test and no validation would otherwise notice. Authoring more than one is caught here
        // too, because the earlier of them cannot be last.
        context.addIssue({
            code: 'custom',
            message: 'The below-significant-measures hint must be the last authored hint, or it shadows every hint after it.',
            path: ['colleagueHints', floorIndex]
        });
    }

    // --- Reading-gate lines (Story 2.8) -----------------------------------------------------------
    //
    // Every guarantee `colleagueHints` gets, for the same reasons, against the artifacts rather than
    // the runs. The two lists are siblings and their validation is deliberately symmetrical: a defect
    // found in one is a defect in the other, and asymmetric rules are how the pair would drift.
    const readingGateHintIds = definition.readingGateHints.map(({ id }) => id);
    if (new Set(readingGateHintIds).size !== readingGateHintIds.length) {
        context.addIssue({ code: 'custom', message: 'Reading-gate line IDs must be stable and unique.', path: ['readingGateHints'] });
    }
    definition.readingGateHints.forEach((hint, index) => {
        if (!colleagueIds.has(hint.colleagueId)) {
            context.addIssue({
                code: 'custom',
                // The rival lab is deliberately not in `colleagues[]`, so this also stops an author
                // putting the challenger's voice behind a helpful nudge.
                message: 'Every reading-gate line must be attributed to an authored colleague.',
                path: ['readingGateHints', index, 'colleagueId']
            });
        }
        // Naming an artifact this case does not carry produces a line no player can ever be shown:
        // the predicate is matched against `missingArtifactIds`, which is drawn from
        // `contextualArtifacts`, so the entry is silently unreachable content.
        if (hint.predicate.kind === 'missing-artifact' && !sourceIds.has(hint.predicate.artifactId)) {
            context.addIssue({
                code: 'custom',
                message: 'A reading-gate line may only name an authored contextual artifact.',
                path: ['readingGateHints', index, 'predicate', 'artifactId']
            });
        }
        if (encodesPath(hint.line)) {
            context.addIssue({
                code: 'custom',
                message: 'Reading-gate copy must not encode a scene, route, or phase path.',
                path: ['readingGateHints', index, 'line']
            });
        }
    });

    // The floor that makes this gate honest, on exactly the terms `colleagueHints` states above: only
    // `any-missing-reading` is unconditionally true for an unmet gate, and selection is first-match in
    // authored order, so anywhere but last it shadows every line after it.
    const readingFloorIndex = definition.readingGateHints.findIndex(({ predicate }) => predicate.kind === 'any-missing-reading');
    if (readingFloorIndex === -1) {
        context.addIssue({
            code: 'custom',
            message: 'Reading-gate lines must include an any-missing-reading line, so the gate always has something to say.',
            path: ['readingGateHints']
        });
    } else if (readingFloorIndex !== definition.readingGateHints.length - 1) {
        context.addIssue({
            code: 'custom',
            message: 'The any-missing-reading line must be the last authored line, or it shadows every line after it.',
            path: ['readingGateHints', readingFloorIndex]
        });
    }

    // --- Rival lab ------------------------------------------------------------------------------
    //
    // Here rather than in `RivalLabSchema`'s own refinement: every rule below is about the critiques
    // *against the conclusion proposals*, which that schema cannot see.

    const critiqueIds = definition.rivalLab.critiques.map(({ id }) => id);
    if (new Set(critiqueIds).size !== critiqueIds.length) {
        context.addIssue({ code: 'custom', message: 'Rival-lab critique IDs must be stable and unique.', path: ['rivalLab', 'critiques'] });
    }
    const conclusionIds = new Set(definition.conclusionProposals.map(({ id }) => id));
    definition.rivalLab.critiques.forEach((critique, index) => {
        if (!conclusionIds.has(critique.proposalId)) {
            context.addIssue({
                code: 'custom',
                message: 'Every rival-lab critique must answer an authored conclusion proposal.',
                path: ['rivalLab', 'critiques', index, 'proposalId']
            });
        }
        if (encodesPath(critique.line)) {
            context.addIssue({
                code: 'custom',
                message: 'Rival-lab copy must not encode a scene, route, or phase path.',
                path: ['rivalLab', 'critiques', index, 'line']
            });
        }
    });
    // Total coverage is what makes critique selection total, and it is why no generic fallback line
    // exists: a conclusion the rival has nothing to say about would submit into silence.
    const critiquedProposalIds = new Set(definition.rivalLab.critiques.map(({ proposalId }) => proposalId));
    if (definition.conclusionProposals.some(({ id }) => !critiquedProposalIds.has(id))) {
        context.addIssue({
            code: 'custom',
            message: 'Every conclusion proposal must carry at least one rival-lab critique.',
            path: ['rivalLab', 'critiques']
        });
    }

    // --- Scenario dialogue beats ----------------------------------------------------------------
    //
    // Here rather than in `ScenarioScriptSchema`'s own refinement: that one cannot see `colleagues`,
    // and a speaker is only meaningful against the authored cast.

    definition.scenarioScript.scenes.forEach((scene, sceneIndex) => {
        const beats = scene.dialogueBeats;
        if (!beats) return;
        const beatPath = ['scenarioScript', 'scenes', sceneIndex, 'dialogueBeats'];
        // Unique *within* a scene. Across scenes a beat id may repeat: a scene is the unit a
        // conversation belongs to, and `prediction` and `review` both reasonably open with `intro`.
        if (new Set(beats.map(({ id }) => id)).size !== beats.length) {
            context.addIssue({ code: 'custom', message: 'Dialogue beat IDs must be unique within a scene.', path: beatPath });
        }
        beats.forEach((beat, beatIndex) => {
            if (!colleagueIds.has(beat.speakerId)) {
                context.addIssue({
                    code: 'custom',
                    message: 'Every dialogue beat must be spoken by an authored colleague.',
                    path: [...beatPath, beatIndex, 'speakerId']
                });
            }
            if (encodesPath(beat.text)) {
                context.addIssue({
                    code: 'custom',
                    message: 'Authored dialogue copy must not encode a scene, route, or phase path.',
                    path: [...beatPath, beatIndex, 'text']
                });
            }
        });
    });
});
