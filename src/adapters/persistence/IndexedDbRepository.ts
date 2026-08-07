import { openDB } from 'idb';

import type { Result } from '../../core/errors/Result';

/**
 * Where local progress lives, named once (Story 2.12, AC5).
 *
 * Exported because `tests/e2e/validation-route.spec.ts` opens this database directly — reading the
 * record itself is what makes its isolation proof a byte comparison rather than an inference from
 * whatever a surface chose to re-render — and it used to restate all three literals. A probe that
 * carries its own copy of a database name stops probing anything the day the name changes, and passes
 * while it does: `indexedDB.open` on an unknown name **creates** an empty one, so the spec would read
 * `undefined`, conclude "nothing was written", and be green.
 */
export const PROGRESS_DATABASE_NAME = 'quantique-progress';
export const PROGRESS_DATABASE_VERSION = 1;
export const PROGRESS_STORE_NAME = 'case-records';

type DatabaseConnection = Readonly<{
    get: (storeName: typeof PROGRESS_STORE_NAME, key: string) => Promise<unknown>;
    put: (storeName: typeof PROGRESS_STORE_NAME, value: unknown, key: string) => Promise<unknown>;
    close: () => void;
}>;

export type OpenProgressDatabase = () => Promise<DatabaseConnection>;

const openProgressDatabase: OpenProgressDatabase = () => new Promise((resolve, reject) => {
    let blocked = false;
    void openDB(PROGRESS_DATABASE_NAME, PROGRESS_DATABASE_VERSION, {
        upgrade(database) {
            if (!database.objectStoreNames.contains(PROGRESS_STORE_NAME)) {
                database.createObjectStore(PROGRESS_STORE_NAME);
            }
        },
        blocked() {
            blocked = true;
            reject(new Error('IndexedDB upgrade was blocked.'));
        },
        blocking(_currentVersion, _blockedVersion, event) {
            (event.target as IDBDatabase | null)?.close();
        }
    }).then((database) => {
        if (blocked) {
            database.close();
            return;
        }
        resolve(database as unknown as DatabaseConnection);
    }, reject);
});

const unavailable = <T>(): Result<T> => ({
    ok: false,
    error: { code: 'persistence-unavailable', message: 'Progress could not be saved right now. Your current work is unchanged.' }
});

/** Adapter-owned IndexedDB boundary; domain and store modules never access it directly. */
export class IndexedDbRepository {
    private connection: Promise<DatabaseConnection> | undefined;

    public constructor(private readonly openDatabase: OpenProgressDatabase = openProgressDatabase) {}

    private async database(): Promise<Result<DatabaseConnection>> {
        try {
            this.connection ??= this.openDatabase();
            return { ok: true, value: await this.connection };
        } catch {
            this.connection = undefined;
            return unavailable();
        }
    }

    public async read(caseId: string): Promise<Result<unknown | undefined>> {
        const database = await this.database();
        if (!database.ok) return database;
        try {
            return { ok: true, value: await database.value.get(PROGRESS_STORE_NAME, caseId) };
        } catch {
            this.connection = undefined;
            return unavailable();
        }
    }

    public async write(caseId: string, record: unknown): Promise<Result<void>> {
        const database = await this.database();
        if (!database.ok) return database;
        try {
            await database.value.put(PROGRESS_STORE_NAME, record, caseId);
            return { ok: true, value: undefined };
        } catch {
            this.connection = undefined;
            return unavailable();
        }
    }
}
