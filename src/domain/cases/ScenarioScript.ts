import type { LocalizedText } from './CaseDefinition';
import type { CasePhase } from './CaseProgress';

/** The Phaser scenes an authored case may route to. Content vocabulary: adding one is a case-contract change. */
export const SCENE_KEYS = ['Library', 'Colleagues', 'Laboratory', 'TheoryBoard', 'Debrief'] as const;

export type SceneKey = typeof SCENE_KEYS[number];

/**
 * The scenes that stage a column of colleague figures, and therefore the only ones an authored
 * {@link ScenarioScene.cast} says anything about (Story 3.4).
 *
 * These are exactly the scene keys whose scenes construct a `ColleagueRenderer`: `Colleagues` hosts the
 * prediction board and `TheoryBoard` hosts both `synthesis` and `review`. `Library`, `Laboratory` and
 * `Debrief` construct none, and the rival lab stages its own cast of one from `rivalLab` rather than
 * from the script — which is also why {@link RIVAL_LAB_SCENE_KEY} is not authorable and so cannot
 * appear here.
 *
 * A `cast` authored on any other scene is content nothing reads, so `CaseDefinitionSchema` refuses it
 * at load against this list. The list is *not* only a schema constant: `ScenarioAuthoringContract.test.ts` reads
 * the scene sources for `new ColleagueRenderer(` and asserts the two sets are equal, so a scene that
 * starts or stops staging a cast without this constant moving fails there rather than silently
 * teaching the schema a rule the renderers no longer follow.
 */
export const FIGURE_STAGING_SCENE_KEYS = ['Colleagues', 'TheoryBoard'] as const satisfies readonly SceneKey[];

export type FigureStagingSceneKey = typeof FIGURE_STAGING_SCENE_KEYS[number];

/** Whether a scene draws a figure column, and so whether an authored cast has anything to stage. */
export const stagesFigureColumn = (sceneKey: SceneKey): sceneKey is FigureStagingSceneKey =>
    (FIGURE_STAGING_SCENE_KEYS as readonly SceneKey[]).includes(sceneKey);

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
    /**
     * Who is in the room for this scene, as authored colleague IDs (Story 3.4).
     *
     * **Absent means the whole cast**, which is why the field is optional rather than defaulted: a
     * default written into the parsed object would read back as authored content the author did not
     * write. An authored empty array is *refused* at load — absence already says "everyone", and
     * "nobody" is not a state a figure-staging scene can render. That is the deliberate opposite of
     * {@link ScenarioDialogueBeat}'s array, where `[]` and absent are identical because "no conversation
     * yet" is something an author means.
     *
     * It decides **presence only**. Sequence is still proposal order — see
     * `presentColleagueIds`, which orders the authored cast proposal-order-first — because the two
     * boards attribute in different orders and a fixed cast order would put three of the four
     * colleagues beside somebody else's draft.
     *
     * Four load-time rules hold it: every ID resolves to an authored `colleagues[]` entry, no ID
     * repeats, the array is not empty, and every one of this scene's `dialogueBeats` is spoken by a
     * member of it. The last is what makes the field safe — without it a beat plays with its speaker
     * nowhere on stage. Only a scene in {@link FIGURE_STAGING_SCENE_KEYS} may author one.
     */
    cast?: readonly string[];
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
