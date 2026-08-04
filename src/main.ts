import { registerOfflineCache } from './adapters/OfflineCache';
import { loadCaseDefinition } from './adapters/content/loadCaseDefinition';
import { createInitialAppState } from './core/store/AppState';
import { createStore } from './core/store/createStore';
import StartGame from './game/main';
import { mountApparatusControls } from './ui/apparatus/ApparatusControls';
import { createBootShell, setBootShellStatus } from './ui/BootShell';

const initializeLaboratory = async (): Promise<void> => {
    const bootShell = document.querySelector<HTMLElement>('#boot-shell');
    const controlsRoot = document.querySelector<HTMLElement>('#apparatus-controls');

    if (!bootShell || !controlsRoot) {
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
    StartGame('game-container', store);
};

document.addEventListener('DOMContentLoaded', () => {
    void initializeLaboratory();
});
