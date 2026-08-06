import type { LocalizedText } from './CaseDefinition';
import type { CasePhase } from './CaseProgress';

/** The Phaser scenes an authored case may route to. Content vocabulary: adding one is a case-contract change. */
export const SCENE_KEYS = ['Library', 'Colleagues', 'Laboratory', 'TheoryBoard', 'Debrief'] as const;

export type SceneKey = typeof SCENE_KEYS[number];

/**
 * One line of authored dialogue: who speaks, and what they say in every shipped locale.
 *
 * `text` carries the prose rather than referencing `en.ts` by key, which the Story 1.10 placeholder
 * shape (`textKey`) assumed. Two independent reasons that shape could not be implemented:
 *
 * 1. `translate` takes a `TranslationKey = keyof typeof en`. A key authored in `case.json` is a plain
 *    `string`, so passing it needs a cast — and the cast defeats the only mechanism that guarantees
 *    `fr.ts` carries the key too.
 * 2. It would put case prose into the application bundle. Every other authored string a player reads
 *    is `LocalizedText` inside `case.json`, because case content is versioned and immutable (ADR-003)
 *    while `en.ts`/`fr.ts` are interface chrome that ships with the build.
 *
 * `speakerId` resolves to an authored `colleagues[]` entry, so a beat is attributed through the same
 * path the proposal cards use.
 */
export type ScenarioDialogueBeat = Readonly<{
    id: string;
    speakerId: string;
    text: LocalizedText;
}>;

export type ScenarioScene = Readonly<{
    phase: CasePhase;
    sceneKey: SceneKey;
    dialogueBeats?: readonly ScenarioDialogueBeat[];
}>;

/**
 * The scenes of a case, keyed by phase. Validation guarantees the list covers every case phase
 * exactly once, so resolution is total.
 *
 * Array order carries no meaning: `resolveSceneKey` looks a scene up by phase, and the authored
 * sequence of the adventure is owned by `CASE_PHASES` / the phase machine. Reordering this list
 * changes nothing.
 */
export type ScenarioScript = Readonly<{
    scenes: readonly ScenarioScene[];
}>;
