import { AUTO, Game, Scale, type Scene } from 'phaser';

import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../adapters/phaser/designSurface';

import { ColleaguesScene } from '../adapters/phaser/scenes/ColleaguesScene';
import { DebriefScene } from '../adapters/phaser/scenes/DebriefScene';
import { LaboratoryScene } from '../adapters/phaser/scenes/LaboratoryScene';
import { LibraryScene } from '../adapters/phaser/scenes/LibraryScene';
import { RivalLabScene } from '../adapters/phaser/scenes/RivalLabScene';
import { TheoryBoardScene } from '../adapters/phaser/scenes/TheoryBoardScene';
import type { CaseRecordOperations } from '../adapters/persistence/caseRecordOperations';
import type { AppStore } from '../core/store/createStore';
import { RIVAL_LAB_SCENE_KEY, ROUTABLE_SCENE_KEYS, type RoutableSceneKey } from '../domain/cases/ScenarioScript';

/**
 * Every routed scene, and nothing else (Story 2.8).
 *
 * There is no longer an always-running overlay scene above them. `LectureBookScene` was registered
 * last so it drew over whatever the router had started, auto-started so the book was reachable in every
 * phase, and — because it was the one scene that always ran — it also owned the session-wide canvas
 * bounds refresh and a callback that reached into five other scenes to suppress their input.
 *
 * All three of those jobs moved somewhere they belong:
 *
 * - The **book** is a `ReferenceBookPresenter` owned by each scene that can host one (`LibraryScene`,
 *   `LaboratoryScene`), so the scene that draws it is the scene that suppresses itself. No reach-in.
 * - The **bounds refresh** is `registerCanvasBoundsRefresh`, registered and disposed by every routed
 *   scene's own lifecycle. Exactly one routed scene runs at a time, so exactly one listener exists.
 * - The **suppression callback** is gone entirely, and with it the `isOverlayVisible` parameter the
 *   five other scenes took. It was dropped rather than defaulted: a `() => false` fallback would have
 *   made a wiring omission a compile-time success, which the 2.7 review flagged as its own defect.
 */
const StartGame = (parent: string, store: AppStore, record?: CaseRecordOperations): Game => {
    // A Record, not an array of pairs: this is the one place that has to be exhaustive over the
    // *routable* keys, and only the index signature makes the compiler reject a key the router can
    // activate. It is wider than `SceneKey` because the rival lab is routable but not authorable.
    const phaseScenes: Record<RoutableSceneKey, Scene> = {
        Library: new LibraryScene(store),
        Colleagues: new ColleaguesScene(store),
        Laboratory: new LaboratoryScene(store),
        // The only scene that takes the record operations: the case file it hosts *is* the record, and
        // the row is drawn only when there is a repository behind it (Story 2.12).
        TheoryBoard: new TheoryBoardScene(store, record),
        Debrief: new DebriefScene(store),
        [RIVAL_LAB_SCENE_KEY]: new RivalLabScene(store)
    };

    const game = new Game({
        type: AUTO,
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        backgroundColor: '#10252c',
        antialias: true,
        antialiasGL: true,
        scale: {
            parent,
            mode: Scale.FIT,
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            autoCenter: Scale.CENTER_BOTH
        },
        // Registered below instead of here: Phaser auto-starts the first scene of a config array,
        // and the SceneRouter must own which phase scene runs, including at boot.
        scene: []
    });

    ROUTABLE_SCENE_KEYS.forEach((sceneKey) => game.scene.add(sceneKey, phaseScenes[sceneKey], false));

    return game;
};

export default StartGame;
