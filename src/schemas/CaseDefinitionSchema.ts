import { z } from 'zod';

import { CASE_PHASES } from '../domain/cases/CaseProgress';
import { SCENE_KEYS } from '../domain/cases/ScenarioScript';

const stableId = z.string().trim().min(1);
const sourceRef = z.string().trim().min(1);
const isOnStep = (value: number, min: number, step: number): boolean =>
    Math.abs((value - min) / step - Math.round((value - min) / step)) < 0.0000001;

const PrimaryControlSchema = z.object({
    id: z.enum(['slitSpacingMm', 'screenDistanceM']),
    label: z.string().trim().min(1),
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
    locale: z.literal('en'),
    sections: z.array(TextualRenditionSectionSchema).min(1)
}).strict().superRefine((rendition, context) => {
    const ids = rendition.sections.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
        context.addIssue({ code: 'custom', message: 'Rendition section IDs must be stable and unique.', path: ['sections'] });
    }
});

const TextualRenditionSchema = z.object({
    readerLabel: z.string().trim().min(1),
    citation: z.object({
        reuseStatement: z.string().trim().min(1),
        citationText: z.string().trim().min(1),
        archiveUrl: z.string().url().refine((url) => new URL(url).protocol === 'https:', 'Archive URLs must use HTTPS.')
    }).strict(),
    summary: z.array(z.string().trim().min(1)).min(1).optional(),
    renditions: z.tuple([LocalizedTextualRenditionSchema])
}).strict();

const ContextualArtifactSchema = z.object({
    id: stableId,
    displayName: z.string().trim().min(1),
    creatorOrOrigin: z.string().trim().min(1),
    sourceType: SourceTypeSchema,
    provenance: z.object({
        category: SourceProvenanceCategorySchema,
        reference: sourceRef
    }).strict(),
    rightsStatus: SourceRightsStatusSchema,
    caseRelationship: z.string().trim().min(1),
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
        observation: z.string().trim().min(1),
        plainLanguage: z.string().trim().min(1),
        technicalDetail: z.string().trim().min(1)
    }).strict(),
    nextStep: z.string().trim().min(1)
}).strict();

const PeerReviewRuleSchema = z.object({
    id: stableId,
    predicate: z.object({
        kind: z.enum(['missing-evidence', 'unsupported-support', 'overreach']),
        overreachPhrases: z.array(z.string().trim().min(1)).min(1).optional()
    }).strict(),
    feedback: z.string().trim().min(1),
    revisionPath: z.string().trim().min(1)
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

const forbiddenPath = /(?:\b(?:scene|phase|route)\b|→|->)/i;

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
    openingDispute: z.string().trim().min(1),
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
        assumptions: z.array(z.string().trim().min(1)).min(1),
        confound: z.object({
            id: stableId,
            description: z.string().trim().min(1),
            discoverableBy: RecoveryRouteSchema
        }).strict(),
        resetPath: z.object({
            recoveryRoute: RecoveryRouteSchema,
            description: z.string().trim().min(1)
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
        summary: z.string().trim().min(1),
        sourceRefs: z.array(sourceRef).min(1),
        historicalComparison: z.object({
            title: z.string().trim().min(1),
            text: z.string().trim().min(1),
            sourceIds: z.tuple([stableId, stableId])
        }).strict(),
        deeperTheory: z.object({ title: z.string().trim().min(1), text: z.string().trim().min(1) }).strict(),
        replayLabel: z.string().trim().min(1)
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
        if (Object.values(rule.layers).some((text) => forbiddenPath.test(text)) || forbiddenPath.test(rule.nextStep)) {
            context.addIssue({ code: 'custom', message: 'Authored help content must not encode a scene, route, or phase path.', path: ['consultationRules', index] });
        }
    });
    definition.peerReviewRules.forEach((rule, index) => {
        if (forbiddenPath.test(rule.feedback) || forbiddenPath.test(rule.revisionPath)) {
            context.addIssue({ code: 'custom', message: 'Peer-review content must not encode a scene, route, or phase path.', path: ['peerReviewRules', index] });
        }
        if (rule.predicate.kind === 'overreach' && !rule.predicate.overreachPhrases) {
            context.addIssue({ code: 'custom', message: 'An overreach rule needs authored signal phrases.', path: ['peerReviewRules', index, 'predicate'] });
        }
    });

});
