import { exportCaseRecord } from '../export/exportCaseRecord';
import { importCaseRecord } from '../export/importCaseRecord';
import { pickRecordFile } from '../export/pickRecordFile';
import { openPrintDialog } from '../print/openPrintDialog';
import type { Result, ResultError } from '../../core/errors/Result';
import { createAppStateFromCaseRecord } from '../../core/store/AppState';
import type { AppStore } from '../../core/store/createStore';
import { selectPortableCaseRecord } from '../../core/store/selectors';
import { CaseRecordRepository } from './caseRecordRepository';

/**
 * Everything the player can do with the record itself, off the panel that used to own all of it.
 *
 * ## What this replaces, and why it is not optional (Story 2.12, Task 2 / AC3 / D1)
 *
 * `src/ui/persistence/CaseProgressPanel.ts` was **not** a projection panel. Its `store.subscribe` *was*
 * the autosave loop, and it held the only call site in `src/` of `exportCaseRecord`, `importCaseRecord`
 * and `openPrintDialog`. Deleting it as the epic's AC1 describes would have taken with it:
 *
 * - **offline reload** — a platform release gate — because nothing would write to IndexedDB;
 * - **FR11**, because ADR-007's print *view* was dutifully retained with nothing left to open it;
 * - **NFR12**, because a failed save would have had no surface at all.
 *
 * So the behaviour moved rather than being rewritten. Same selector, same repository, same serialization
 * chain, same neutral copy on a failed import.
 *
 * ## The validation route constructs none of this
 *
 * `main.ts` builds these only inside its existing `if (!validationMode)` branch, exactly as it built the
 * repository and the progress panel. A moderated session therefore still writes nothing, reads nothing
 * and offers no way to export or import — which is the isolation `validation-route.spec.ts` asserts.
 */
export type CaseRecordOperations = Readonly<{
    /** Downloads the validated player-only record. Never touches the store. */
    exportRecord: () => Result<void>;
    /**
     * Asks for a record, validates and migrates it, saves it, and replaces the session with it.
     *
     * Resolves `undefined` when the player chose no file, which is not a failure and must not be
     * reported as one.
     */
    importRecord: () => Promise<Result<void> | undefined>;
    /** Opens the browser print dialog over the retained semantic print view (ADR-007). */
    printRecord: () => Result<void>;
}>;

const invalidImport = (): ResultError => ({
    // The neutral message the retired panel used, kept verbatim: an import failure must never expose
    // what was wrong with somebody else's file, and `error.invalid-import` is already in both bundles.
    code: 'invalid-import',
    message: 'This progress record could not be used. Your current work is unchanged.'
});

export const createCaseRecordOperations = (
    store: AppStore,
    repository: CaseRecordRepository
): CaseRecordOperations => ({
    exportRecord: () => {
        const record = selectPortableCaseRecord(store.getState());
        return record.ok ? exportCaseRecord(record.value) : record;
    },
    importRecord: async () => {
        const file = await pickRecordFile();
        // No file chosen is not an outcome to report. Reporting it would answer a player who cancelled
        // with a failure message about something they deliberately did not do.
        if (!file) return undefined;
        // Taken **after** a file exists, which is the ordering the retired panel had: the lock refuses
        // every dispatch while it is held, and a chooser left open would otherwise freeze the session.
        const exclusive = store.acquireExclusiveOperation();
        if (!exclusive.ok) return exclusive;
        try {
            const imported = await importCaseRecord(file);
            if (!imported.ok) return { ok: false, error: invalidImport() };
            const candidate = createAppStateFromCaseRecord(imported.value, store.getState().caseDefinition);
            if (!candidate.ok) return { ok: false, error: invalidImport() };
            const candidateRecord = selectPortableCaseRecord(candidate.value);
            if (!candidateRecord.ok) return { ok: false, error: invalidImport() };
            // Written before the session is replaced, so a save that fails leaves the player where they
            // were rather than in an imported state this device cannot keep (NFR12).
            const saved = await repository.save(candidateRecord.value);
            if (!saved.ok) return { ok: false, error: invalidImport() };
            const replaced = store.replaceWithValidatedRecord(candidateRecord.value);
            return replaced.ok ? replaced : { ok: false, error: invalidImport() };
        } finally {
            exclusive.value();
        }
    },
    printRecord: () => openPrintDialog()
});

/**
 * The autosave, relocated from `CaseProgressPanel.ts:108-117` and otherwise unchanged.
 *
 * **The `pendingWrite` chain is kept because it is what stops two writes racing on one key.** Every
 * dispatch triggers a save, `repository.save` is asynchronous, and two overlapping writes to the same
 * `caseId` can land in either order — so a rapid pair of actions could persist the earlier state last.
 * Serializing them is behaviour, not tidiness, which is why this is a relocation rather than a rewrite.
 *
 * @param onSaveFailure Told once per failed write. NFR12: a save that fails must not be silent, and
 * this is the only place that knows it happened. The caller decides where the player reads it.
 */
export const attachAutosave = (
    store: AppStore,
    repository: CaseRecordRepository,
    onSaveFailure: () => void
): (() => void) => {
    let pendingWrite = Promise.resolve();

    const persist = async (): Promise<boolean> => {
        const record = selectPortableCaseRecord(store.getState());
        if (!record.ok) return false;
        let saved = false;
        pendingWrite = pendingWrite.then(async () => { saved = (await repository.save(record.value)).ok; });
        await pendingWrite;
        return saved;
    };

    return store.subscribe(() => {
        void persist().then((saved) => {
            if (!saved) onSaveFailure();
        });
    });
};
