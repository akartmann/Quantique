import { AUTO, Game, Scale } from 'phaser';

import { LaboratoryScene } from '../adapters/phaser/scenes/LaboratoryScene';
import type { LectureBookController } from '../adapters/phaser/renderers/LectureBookRenderer';
import type { AppStore } from '../core/store/createStore';

export type { LectureBookController, LectureBookPresentation } from '../adapters/phaser/renderers/LectureBookRenderer';

const StartGame = (parent: string, store: AppStore, onLectureBookReady?: (controller: LectureBookController) => void): Game => new Game({
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
    scene: [new LaboratoryScene(store, onLectureBookReady)]
});

export default StartGame;
