import { AUTO, Game } from 'phaser';

import { LaboratoryScene } from '../adapters/phaser/scenes/LaboratoryScene';
import type { AppStore } from '../core/store/createStore';

const StartGame = (parent: string, store: AppStore): Game => new Game({
    type: AUTO,
    width: 1024,
    height: 768,
    parent,
    backgroundColor: '#10252c',
    scene: [new LaboratoryScene(store)]
});

export default StartGame;
