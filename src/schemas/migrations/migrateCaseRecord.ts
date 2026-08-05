import type { Result } from '../../core/errors/Result';

const failure = (code: 'invalid-import' | 'incompatible-record-version', message: string): Result<never> => ({
    ok: false,
    error: { code, message }
});

const legacyRecognition = () => ({
    version: 0 as const,
    items: [] as const
});

const migrateLegacyRecognition = (input: Record<string, unknown>): Record<string, unknown> =>
    !('recognition' in input) || (input.recognition && typeof input.recognition === 'object' && !Array.isArray(input.recognition) && Object.keys(input.recognition).length === 0)
        ? { ...input, recognition: legacyRecognition() }
        : input;

const requiresPrediction = (phase: unknown): boolean => ['experiment', 'synthesis', 'review', 'debrief'].includes(phase as string);
const hasCompleteLegacyContext = (sourceIds: unknown): boolean =>
    Array.isArray(sourceIds) && new Set(sourceIds).size >= 2;

const migrateV1Prediction = (input: Record<string, unknown>): Record<string, unknown> => ({
    ...migrateLegacyRecognition(input),
    schemaVersion: 2,
    prediction: '',
    phase: requiresPrediction(input.phase)
        ? hasCompleteLegacyContext(input.inspectedSourceIds) ? 'prediction' : 'context'
        : input.phase
});

const migrateV2Completion = (input: Record<string, unknown>): Record<string, unknown> => ({
    ...migrateLegacyRecognition(input),
    schemaVersion: 3,
    replay: { isCounterfactual: false }
});

/** Migrates only explicitly supported portable record versions. */
export const migrateCaseRecord = (input: unknown): Result<unknown> => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return failure('invalid-import', 'This progress record could not be used. Your current work is unchanged.');
    }

    const version = (input as { schemaVersion?: unknown }).schemaVersion;
    if (!Number.isInteger(version) || (version as number) < 0) {
        return failure('invalid-import', 'This progress record could not be used. Your current work is unchanged.');
    }

    switch (version) {
        case 0:
            return { ok: true, value: migrateV2Completion(migrateV1Prediction({ ...(input as Record<string, unknown>), schemaVersion: 1 })) };
        case 1:
            return { ok: true, value: migrateV2Completion(migrateV1Prediction(input as Record<string, unknown>)) };
        case 2:
            return { ok: true, value: migrateV2Completion(input as Record<string, unknown>) };
        case 3:
            return { ok: true, value: migrateLegacyRecognition(input as Record<string, unknown>) };
        default:
            return failure('incompatible-record-version', 'This progress record uses an unsupported version. Your current work is unchanged.');
    }
};
