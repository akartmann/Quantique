import type { Result } from '../../core/errors/Result';
import { parseAndMigrateCaseRecord, type CaseRecord } from '../../schemas/CaseRecordSchema';

const failure = (): Result<CaseRecord> => ({
    ok: false,
    error: { code: 'invalid-import', message: 'This progress record could not be used. Your current work is unchanged.' }
});

/** Reads only a file selected by the player and never exposes its raw contents to the UI. */
export const importCaseRecord = async (file: Pick<File, 'text'>): Promise<Result<CaseRecord>> => {
    try {
        return parseAndMigrateCaseRecord(await file.text());
    } catch {
        return failure();
    }
};
