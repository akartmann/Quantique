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
const SourceProvenanceCategorySchema = z.enum(['primary-material', 'reconstruction', 'later-interpretation', 'deliberate-fiction']);
const SourceTypeSchema = z.enum(['lecture-record', 'published-book', 'reconstruction', 'interpretive-essay', 'fictionalized-account']);
const SourceRightsStatusSchema = z.enum(['reviewed', 'incomplete', 'unavailable']);

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

const ColleagueRoleSchema = z.enum(['lead', 'builder', 'analyst', 'communicator']);

const ColleaguePortraitSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('asset'), assetId: stableId }).strict(),
    // Lower-case six-digit hex only: the renderer parses it with `Number.parseInt(…, 16)`, and a
    // single canonical spelling keeps authored accents comparable at a glance.
    z.object({ kind: z.literal('silhouette'), accentColor: z.string().regex(/^#[0-9a-f]{6}$/, 'A silhouette accent must be a lower-case #rrggbb colour.') }).strict()
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
    requirements: z.object({ minimumRuns: z.literal(2), minimumSources: z.literal(2) }).strict(),
    colleagues: z.array(ColleagueSchema).min(1),
    // `.length(4)`, not `.min(4)`: the pivot makes both the prediction and the conclusion a 1-of-4
    // attributed choice, and a wrong count is unambiguous enough that a generic length failure reads
    // correctly without an authored message.
    predictionProposals: z.array(PredictionProposalSchema).length(4),
    conclusionProposals: z.array(ConclusionProposalSchema).length(4),
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
