import { registerOfflineCache } from './adapters/OfflineCache';
import { loadCaseDefinition } from './adapters/content/loadCaseDefinition';
import { createInitialAppState } from './core/store/AppState';
import { createStore } from './core/store/createStore';
import { createCalculatedRunRecord, type CalculateExperimentResult } from './domain/evidence/RunRecord';
import StartGame from './game/main';
import { mountApparatusControls } from './ui/apparatus/ApparatusControls';
import { createBootShell, setBootShellStatus } from './ui/BootShell';
import { mountNotebookPanel } from './ui/notebook/NotebookPanel';

const calculatePreparedObservation: CalculateExperimentResult = () => ({
    ok: true,
    value: { label: 'Prepared observation', value: 1, unit: 'relative units' }
});

const initializeLaboratory = async (): Promise<void> => {
    const bootShell = document.querySelector<HTMLElement>('#boot-shell');
    const controlsRoot = document.querySelector<HTMLElement>('#apparatus-controls');
    const notebookRoot = document.querySelector<HTMLElement>('#measurement-notebook');

    if (!bootShell || !controlsRoot || !notebookRoot) {
        return;
    }

    createBootShell(bootShell);
    void registerOfflineCache();

    const caseResult = await loadCaseDefinition('young-interference');
    if (!caseResult.ok) {
        setBootShellStatus(bootShell, 'Laboratory content is unavailable. Please try again when it is available.');
        return;
    }

    const store = createStore(createInitialAppState(caseResult.value));
    mountApparatusControls(controlsRoot, store);
    mountNotebookPanel(notebookRoot, store, () => createCalculatedRunRecord({
        id: crypto.randomUUID(),
        caseId: store.getState().caseDefinition.id,
        controls: store.getState().activeControlValues,
        timestamp: new Date().toISOString(),
        experimentModelVersion: store.getState().caseDefinition.experiment.modelVersion,
        calculateResult: calculatePreparedObservation
    }, store.getState().runs.map(({ id }) => id)));
    StartGame('game-container', store);
};

document.addEventListener('DOMContentLoaded', () => {
    void initializeLaboratory();
});
