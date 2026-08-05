import type { CasePhase } from './CaseProgress';

/** The Phaser scenes an authored case may route to. Content vocabulary: adding one is a case-contract change. */
export const SCENE_KEYS = ['Library', 'Colleagues', 'Laboratory', 'TheoryBoard', 'Debrief'] as const;

export type SceneKey = typeof SCENE_KEYS[number];

/**
 * Placeholder for the authored dialogue of a scene. Beats reference localized copy by key rather
 * than carrying text, so authoring stays compatible with the EN+FR foundation (Story 1.1b / ADR-010).
 * The colleague cast and proposal content that fills these in arrives with Story 1.11 / 3.4.
 */
export type ScenarioDialogueBeat = Readonly<{
    id: string;
    speakerId: string;
    textKey: string;
}>;

export type ScenarioScene = Readonly<{
    phase: CasePhase;
    sceneKey: SceneKey;
    dialogueBeats?: readonly ScenarioDialogueBeat[];
}>;

/** Ordered scenes of a case. Validation guarantees it covers every case phase exactly once. */
export type ScenarioScript = Readonly<{
    scenes: readonly ScenarioScene[];
}>;
