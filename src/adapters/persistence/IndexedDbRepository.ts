import { openDB } from 'idb';

import type { Result } from '../../core/errors/Result';

type DatabaseConnection = Readonly<{
    get: (storeName: 'case-records', key: string) => Promise<unknown>;
    put: (storeName: 'case-records', value: unknown, key: string) => Promise<unknown>;
    close: () => void;
}>;

export type OpenProgressDatabase = () => Promise<DatabaseConnection>;

const openProgressDatabase: OpenProgressDatabase = () => new Promise((resolve, reject) => {
    let blocked = false;
    void openDB('quantique-progress', 1, {
        upgrade(database) {
            if (!database.objectStoreNames.contains('case-records')) {
                database.createObjectStore('case-records');
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
            return { ok: true, value: await database.value.get('case-records', caseId) };
        } catch {
            this.connection = undefined;
            return unavailable();
        }
    }

    public async write(caseId: string, record: unknown): Promise<Result<void>> {
        const database = await this.database();
        if (!database.ok) return database;
        try {
            await database.value.put('case-records', record, caseId);
            return { ok: true, value: undefined };
        } catch {
            this.connection = undefined;
            return unavailable();
        }
    }
}
