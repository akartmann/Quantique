import { z } from 'zod';

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

export const CaseDefinitionSchema = z.object({
    id: z.literal('young-interference'),
    version: z.string().trim().min(1),
    openingDispute: z.string().trim().min(1),
    contextualArtifacts: z.tuple([z.object({
        id: stableId,
        displayName: z.string().trim().min(1),
        provenanceRef: sourceRef
    }).strict(), z.object({
        id: stableId,
        displayName: z.string().trim().min(1),
        provenanceRef: sourceRef
    }).strict()]),
    prediction: z.object({ required: z.literal(true) }).strict(),
    apparatus: z.object({ primaryControls: z.tuple([PrimaryControlSchema, PrimaryControlSchema]) }).strict(),
    experiment: z.object({
        modelVersion: z.string().trim().min(1),
        wavelengthNm: z.literal(550),
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
    debrief: z.object({
        summary: z.string().trim().min(1),
        sourceRefs: z.array(sourceRef).min(1)
    }).strict(),
    assets: z.object({
        manifestVersion: z.string().trim().min(1),
        entries: z.array(z.object({
            id: stableId,
            type: z.enum(['image', 'audio', 'document']),
            path: z.string().regex(/^\//, 'Asset paths must be static root paths.')
        }).strict()).min(1)
    }).strict()
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

    if (new Set(definition.assets.entries.map((asset) => asset.id)).size !== definition.assets.entries.length) {
        context.addIssue({ code: 'custom', message: 'Asset IDs must be stable and unique.', path: ['assets', 'entries'] });
    }
});
