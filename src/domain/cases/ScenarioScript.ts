import type { LocalizedText } from './CaseDefinition';
import type { CasePhase } from './CaseProgress';

/** The Phaser scenes an authored case may route to. Content vocabulary: adding one is a case-contract change. */
export const SCENE_KEYS = ['Library', 'Colleagues', 'Laboratory', 'TheoryBoard', 'Debrief'] as const;

export type SceneKey = typeof SCENE_KEYS[number];

/**
 * The rival lab, which is routable but deliberately **not authorable**.
 *
 * {@link SCENE_KEYS} is the *content* vocabulary: the scenes a case's `scenarioScript` may map a phase
 * to, and `ScenarioScriptSchema` requires that map to cover every phase exactly once. The rival lab is
 * not a phase — it is a state the theory board enters and leaves while the phase stands still. Putting
 * it in `SCENE_KEYS` would let an author route, say, `debrief` to it, and `resolveSceneKey` would stop
 * being the pure phase lookup ADR-009 describes.
 *
 * So the content contract stays narrow and the *runtime registry* is what widens.
 */
export const RIVAL_LAB_SCENE_KEY = 'RivalLab' as const;

/** Every scene the router may activate and the game must register: the authorable ones, plus the rival lab. */
export const ROUTABLE_SCENE_KEYS = [...SCENE_KEYS, RIVAL_LAB_SCENE_KEY] as const;

export type RoutableSceneKey = typeof ROUTABLE_SCENE_KEYS[number];

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
