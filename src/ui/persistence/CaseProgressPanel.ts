import { exportCaseRecord } from '../../adapters/export/exportCaseRecord';
import { importCaseRecord } from '../../adapters/export/importCaseRecord';
import { openPrintDialog } from '../../adapters/print/openPrintDialog';
import { CaseRecordRepository } from '../../adapters/persistence/caseRecordRepository';
import { createAppStateFromCaseRecord } from '../../core/store/AppState';
import type { AppStore } from '../../core/store/createStore';
import { selectPortableCaseRecord } from '../../core/store/selectors';

const neutralImportMessage = 'This progress record could not be used. Your current work is unchanged.';

/** Accessible persistence controls with serialized adapter writes and recovery-focused status. */
export const mountCaseProgressPanel = (root: HTMLElement, store: AppStore, repository: CaseRecordRepository): (() => void) => {
    let statusMessage = '';
    let requestedFocusKey: string | undefined;
    let pendingWrite = Promise.resolve();

    const persist = async (): Promise<boolean> => {
        const record = selectPortableCaseRecord(store.getState());
        if (!record.ok) return false;
        let saved = false;
        pendingWrite = pendingWrite.then(async () => { saved = (await repository.save(record.value)).ok; });
        await pendingWrite;
        return saved;
    };

    const render = (): void => {
        const active = document.activeElement;
        const focusKey = requestedFocusKey ?? (active instanceof HTMLElement && root.contains(active) ? active.dataset.progressFocus : undefined);
        requestedFocusKey = undefined;
        const panel = document.createElement('section');
        panel.className = 'case-progress-panel';
        panel.setAttribute('aria-label', 'Save, export, import, and print');
        const heading = document.createElement('h2'); heading.textContent = 'Progress and record';
        const status = document.createElement('p');
        status.className = 'case-progress-status';
        status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-label', 'Progress status');
        status.textContent = statusMessage;
        const save = document.createElement('button');
        save.type = 'button'; save.dataset.progressFocus = 'save'; save.textContent = 'Save progress';
        save.addEventListener('click', async () => {
            requestedFocusKey = 'save';
            statusMessage = await persist() ? 'Progress saved on this device.' : 'Progress could not be saved right now. Your current work is unchanged.';
            render();
        });
        const exportButton = document.createElement('button');
        exportButton.type = 'button'; exportButton.dataset.progressFocus = 'export'; exportButton.textContent = 'Export progress';
        exportButton.addEventListener('click', () => {
            requestedFocusKey = 'export';
            const record = selectPortableCaseRecord(store.getState());
            statusMessage = record.ok && exportCaseRecord(record.value).ok
                ? 'Progress exported as a portable record.'
                : 'Progress could not be exported right now. Your current work is unchanged.';
            render();
        });
        const importLabel = document.createElement('label');
        importLabel.htmlFor = 'progress-import'; importLabel.textContent = 'Import a progress record';
        const importInput = document.createElement('input');
        importInput.type = 'file'; importInput.id = 'progress-import'; importInput.accept = 'application/json,.json'; importInput.dataset.progressFocus = 'import';
        importInput.addEventListener('change', async () => {
            requestedFocusKey = 'import';
            const file = importInput.files?.item(0);
            if (!file) return;
            const imported = await importCaseRecord(file);
            if (!imported.ok) {
                statusMessage = neutralImportMessage;
                render();
                return;
            }
            const restored = createAppStateFromCaseRecord(imported.value, store.getState().caseDefinition);
            if (!restored.ok || !store.replaceWithValidatedState(restored.value).ok) {
                statusMessage = neutralImportMessage;
                render();
                return;
            }
            statusMessage = await persist() ? 'Progress imported and saved on this device.' : 'Progress imported. It could not be saved right now.';
            render();
        });
        const print = document.createElement('button');
        print.type = 'button'; print.dataset.progressFocus = 'print'; print.textContent = 'Print investigation record';
        print.addEventListener('click', () => {
            requestedFocusKey = 'print';
            statusMessage = openPrintDialog().ok ? 'Printable investigation record opened.' : 'The printable record could not be opened right now. Your current work is unchanged.';
            render();
        });
        panel.append(heading, status, save, exportButton, importLabel, importInput, print);
        root.replaceChildren(panel);
        if (focusKey) root.querySelector<HTMLElement>(`[data-progress-focus="${focusKey}"]`)?.focus();
    };

    const unsubscribe = store.subscribe(() => { void persist(); render(); });
    render();
    return () => { unsubscribe(); root.replaceChildren(); };
};
