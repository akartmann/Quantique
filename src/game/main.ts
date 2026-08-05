import { AUTO, Game, Scale, type Scene } from 'phaser';

import type { LectureBookController } from '../adapters/phaser/renderers/LectureBookRenderer';
import { ColleaguesScene } from '../adapters/phaser/scenes/ColleaguesScene';
import { DebriefScene } from '../adapters/phaser/scenes/DebriefScene';
import { LaboratoryScene } from '../adapters/phaser/scenes/LaboratoryScene';
import { LectureBookScene } from '../adapters/phaser/scenes/LectureBookScene';
import { LibraryScene } from '../adapters/phaser/scenes/LibraryScene';
import { TheoryBoardScene } from '../adapters/phaser/scenes/TheoryBoardScene';
import type { AppStore } from '../core/store/createStore';
import type { SceneKey } from '../domain/cases/ScenarioScript';

export type { LectureBookController, LectureBookPresentation } from '../adapters/phaser/renderers/LectureBookRenderer';

/** The overlay scene key is deliberately outside SceneKey: no phase may route to it. */
export const LECTURE_BOOK_SCENE_KEY = 'LectureBook';

const StartGame = (parent: string, store: AppStore, onLectureBookReady?: (controller: LectureBookController) => void): Game => {
    const laboratoryScene = new LaboratoryScene(store);
    const phaseScenes: readonly (readonly [SceneKey, Scene])[] = [
        ['Library', new LibraryScene(store)],
        ['Colleagues', new ColleaguesScene(store)],
        ['Laboratory', laboratoryScene],
        ['TheoryBoard', new TheoryBoardScene(store)],
        ['Debrief', new DebriefScene(store)]
    ];

    const game = new Game({
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
        // Registered below instead of here: Phaser auto-starts the first scene of a config array,
        // and the SceneRouter must own which phase scene runs, including at boot.
        scene: []
    });

    phaseScenes.forEach(([sceneKey, scene]) => game.scene.add(sceneKey, scene, false));
    // Added last so it draws above the routed scene, and auto-started so the book is available
    // in every phase — including the phases whose scene has no book of its own yet.
    game.scene.add(LECTURE_BOOK_SCENE_KEY, new LectureBookScene(
        (visible) => laboratoryScene.setApparatusInputEnabled(!visible),
        onLectureBookReady
    ), true);

    return game;
};

export default StartGame;
