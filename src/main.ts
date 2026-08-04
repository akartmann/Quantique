import StartGame from './game/main';
import { registerOfflineCache } from './adapters/OfflineCache';
import { createBootShell } from './ui/BootShell';

document.addEventListener('DOMContentLoaded', () => {

    const bootShell = document.querySelector<HTMLElement>('#boot-shell');

    if (!bootShell) {
        throw new Error('The boot shell root is missing.');
    }

    createBootShell(bootShell);
    StartGame('game-container');
    void registerOfflineCache();

});
