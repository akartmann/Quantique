import { AUTO, Game, Scale, type Scene } from 'phaser';

import type { LectureBookController } from '../adapters/phaser/renderers/LectureBookRenderer';
import { ColleaguesScene } from '../adapters/phaser/scenes/ColleaguesScene';
import { DebriefScene } from '../adapters/phaser/scenes/DebriefScene';
import { LaboratoryScene } from '../adapters/phaser/scenes/LaboratoryScene';
import { LECTURE_BOOK_SCENE_KEY, LectureBookScene } from '../adapters/phaser/scenes/LectureBookScene';
import { LibraryScene } from '../adapters/phaser/scenes/LibraryScene';
import { RivalLabScene } from '../adapters/phaser/scenes/RivalLabScene';
import { TheoryBoardScene } from '../adapters/phaser/scenes/TheoryBoardScene';
import type { AppStore } from '../core/store/createStore';
import { RIVAL_LAB_SCENE_KEY, ROUTABLE_SCENE_KEYS, type RoutableSceneKey } from '../domain/cases/ScenarioScript';

export type { LectureBookController, LectureBookPresentation } from '../adapters/phaser/renderers/LectureBookRenderer';
export { LECTURE_BOOK_SCENE_KEY } from '../adapters/phaser/scenes/LectureBookScene';

const StartGame = (parent: string, store: AppStore, onLectureBookReady?: (controller: LectureBookController) => void): Game => {
    // Assigned below: every scene with its own canvas input reads the book's live visibility, and the
    // book is built after them.
    let lectureBookScene: LectureBookScene | undefined;
    const isOverlayVisible = (): boolean => lectureBookScene?.isOverlayVisible() ?? false;
    const laboratoryScene = new LaboratoryScene(store, isOverlayVisible);
    const colleaguesScene = new ColleaguesScene(store, isOverlayVisible);
    const theoryBoardScene = new TheoryBoardScene(store, isOverlayVisible);
    const rivalLabScene = new RivalLabScene(store, isOverlayVisible);
    // A Record, not an array of pairs: this is the one place that has to be exhaustive over the
    // *routable* keys, and only the index signature makes the compiler reject a key the router can
    // activate. It is wider than `SceneKey` because the rival lab is routable but not authorable.
    const phaseScenes: Record<RoutableSceneKey, Scene> = {
        Library: new LibraryScene(store),
        Colleagues: colleaguesScene,
        Laboratory: laboratoryScene,
        TheoryBoard: theoryBoardScene,
        Debrief: new DebriefScene(store),
        [RIVAL_LAB_SCENE_KEY]: rivalLabScene
    };

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

    ROUTABLE_SCENE_KEYS.forEach((sceneKey) => game.scene.add(sceneKey, phaseScenes[sceneKey], false));
    // Added last so it draws above the routed scene, and auto-started so the book is available
    // in every phase — including the phases whose scene has no book of its own yet.
    lectureBookScene = new LectureBookScene(
        store,
        // Every routed scene that owns canvas input, not just the laboratory: the book is reachable in
        // every phase, and the proposal cards cover almost the whole canvas.
        (visible) => {
            laboratoryScene.setApparatusInputEnabled(!visible);
            colleaguesScene.setProposalInputEnabled(!visible);
            theoryBoardScene.setProposalInputEnabled(!visible);
            // The rival lab too: the book is reachable in every phase and the critique surface covers
            // the canvas, so omitting it reproduces exactly the click-through defect 1.12 fixed for the
            // proposal cards — a page-turn falling through to the revise control underneath.
            rivalLabScene.setInputEnabled(!visible);
        },
        onLectureBookReady
    );
    game.scene.add(LECTURE_BOOK_SCENE_KEY, lectureBookScene, true);

    return game;
};

export default StartGame;
