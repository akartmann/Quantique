import type { Result } from '../../core/errors/Result';

const failure = (code: 'invalid-import' | 'incompatible-record-version', message: string): Result<never> => ({
    ok: false,
    error: { code, message }
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
            return { ok: true, value: { ...(input as Record<string, unknown>), schemaVersion: 1 } };
        case 1:
            return { ok: true, value: input };
        default:
            return failure('incompatible-record-version', 'This progress record uses an unsupported version. Your current work is unchanged.');
    }
};
