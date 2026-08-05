import type { Result } from '../../core/errors/Result';
import { CaseRecordSchema, migrateAndValidateCaseRecord, type CaseRecord } from '../../schemas/CaseRecordSchema';
import { IndexedDbRepository } from './IndexedDbRepository';

export type CaseRecordStorage = Readonly<{
    read: (caseId: string) => Promise<Result<unknown | undefined>>;
    write: (record: CaseRecord) => Promise<Result<void>>;
}>;

const invalidRecord = <T>(): Result<T> => ({
    ok: false,
    error: { code: 'invalid-import', message: 'This progress record could not be used. Your current work is unchanged.' }
});

/** Validates every value crossing the IndexedDB record boundary. */
export class CaseRecordRepository {
    private readonly storage: CaseRecordStorage;

    public constructor(storage: CaseRecordStorage | IndexedDbRepository = new IndexedDbRepository()) {
        this.storage = storage instanceof IndexedDbRepository
            ? {
                read: (caseId) => storage.read(caseId),
                write: (record) => storage.write(record.caseId, record)
            }
            : storage;
    }

    public async load(caseId: string): Promise<Result<CaseRecord | undefined>> {
        const loaded = await this.storage.read(caseId);
        if (!loaded.ok) return { ok: false, error: loaded.error };
        if (loaded.value === undefined) return { ok: true, value: undefined };
        const parsed = migrateAndValidateCaseRecord(loaded.value);
        return parsed.ok && parsed.value.caseId === caseId ? parsed : parsed.ok ? invalidRecord() : parsed;
    }

    public async save(record: CaseRecord): Promise<Result<void>> {
        const parsed = CaseRecordSchema.safeParse(record);
        if (!parsed.success) return invalidRecord();
        return this.storage.write(parsed.data);
    }
}
