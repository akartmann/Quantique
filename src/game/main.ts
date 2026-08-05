import { AUTO, Game, Scale } from 'phaser';

import { LaboratoryScene } from '../adapters/phaser/scenes/LaboratoryScene';
import type { AppStore } from '../core/store/createStore';

const StartGame = (parent: string, store: AppStore): Game => new Game({
    type: AUTO,
    width: 1024,
    height: 768,
    backgroundColor: '#10252c',
    antialias: true,
    antialiasGL: true,
    scale: {
        parent,
        mode: Scale.FIT,
        width: 1024,
        height: 768,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [new LaboratoryScene(store)]
});

export default StartGame;
