import { z } from 'zod';

import { LOCALES } from '../core/i18n/Locale';
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
    if (rendition.renditions.filter(({ kind }) => kind === 'transcription').length !== 1) {
        context.addIssue({ code: 'custom', message: 'Exactly one rendition may be the transcription of record; any others are translations.', path: ['renditions'] });
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
        // Detection phrases, not display text: both locales are always matched as a union.
        overreachPhrases: LocalizedTextListSchema.optional()
    }).strict(),
    feedback: LocalizedTextSchema,
    revisionPath: LocalizedTextSchema
}).strict();

const ScenarioDialogueBeatSchema = z.object({
    id: stableId,
    speakerId: stableId,
    textKey: stableId
}).strict();

const ScenarioSceneSchema = z.object({
    phase: z.enum(CASE_PHASES),
    sceneKey: z.enum(SCENE_KEYS),
    dialogueBeats: z.array(ScenarioDialogueBeatSchema).min(1).optional()
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
 * The word list is locale-specific by necessity: `route` and `phase` are ordinary French words (and
 * `scène` reads naturally in "mise en scène"), so applying the English list to French copy produces
 * only false positives and pressure to mangle the translation. The arrow forms are the reliable
 * cross-language signal and stay in both.
 */
const forbiddenPath: Readonly<Record<'en' | 'fr', RegExp>> = {
    en: /(?:\b(?:scene|phase|route)\b|→|->)/i,
    fr: /(?:→|->)/
};

const encodesPath = (text: Readonly<{ en: string; fr: string }>): boolean =>
    forbiddenPath.en.test(text.en) || forbiddenPath.fr.test(text.fr);

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

});
