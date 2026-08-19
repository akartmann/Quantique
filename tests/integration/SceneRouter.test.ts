import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createSceneRouter, type SceneRouterTarget } from '../../src/adapters/phaser/SceneRouter';
import { createAppStateFromCaseRecord, createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { calculateYoungFringeSpacing } from '../../src/domain/apparatus/calculateYoungFringeSpacing';
import { CASE_PHASES, type CasePhase } from '../../src/domain/cases/CaseProgress';
import { deriveRecognition } from '../../src/domain/recognition/recognitionRules';
import type { CaseRecord } from '../../src/schemas/CaseRecordSchema';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';
import { loadAuthoringExample } from '../shippedCases';
import type { ScenarioScript, SceneKey } from '../../src/domain/cases/ScenarioScript';

const scenarioScript: ScenarioScript = {
    scenes: [
        { phase: 'context', sceneKey: 'Library' },
        { phase: 'prediction', sceneKey: 'Colleagues' },
        { phase: 'experiment', sceneKey: 'Laboratory' },
        { phase: 'synthesis', sceneKey: 'TheoryBoard' },
        { phase: 'review', sceneKey: 'TheoryBoard' },
        { phase: 'debrief', sceneKey: 'Debrief' }
    ]
};

const definition = {
    // Story 2.12 removed the free-text `prediction.recorded` / `theory.conclusionSet` /
    // `theory.limitationSet` actions, so a fixture that seeds a prediction or a conclusion has to
    // carry the authored proposals the surviving actions choose from. Four of each, because
    // `.length(4)` is the design rather than a minimum.
    predictionProposals: [0, 1, 2, 3].map((index) => ({
        id: `prediction-${index}`,
        colleagueId: 'colleague-1',
        text: { en: `A patterned result may appear (${index}).`, fr: `Un résultat structuré pourrait apparaître (${index}).` }
    })),
    conclusionProposals: [0, 1, 2, 3].map((index) => ({
        id: `conclusion-${index}`,
        colleagueId: 'colleague-1',
        // Index 1 is deliberately overreaching: `peerReviewRules`' `overreach` predicate matches an
        // authored phrase ("proves" / "prouve"), and the free-text conclusions that used to trigger it
        // are gone. A fixture that could not produce a finding would make every peer-review test pass
        // by having nothing to review.
        claim: index === 1
            ? { en: 'The evidence proves a bounded result.', fr: 'Les preuves prouvent un résultat délimité.' }
            : { en: `The observations support a bounded conclusion (${index}).`, fr: `Les observations étayent une conclusion délimitée (${index}).` },
        limitation: { en: `The observations leave alternative explanations open (${index}).`, fr: `Les observations laissent ouvertes d'autres explications (${index}).` },
        supportPredicate: { kind: 'minimum-runs', count: 1 }
    })),
    id: 'young-interference', version: '1.0.0', prediction: { required: true }, requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [],
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    contextualArtifacts: [
        { id: 'source-1', displayName: 'First source', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'first' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' },
        { id: 'source-2', displayName: 'Second source', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'second' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }
    ],
    experiment: { modelId: 'young-double-slit', modelVersion: 'young-observation-v1' },
    scenarioScript
} as CaseDefinition;

/**
 * Stands in for Phaser's scene manager: a headless Phaser.Game needs a canvas Vitest does not have.
 * `start` runs the pending create listener synchronously, mirroring Phaser — `SceneManager.start`
 * boots the scene and emits `create` before returning.
 */
const createFakeSceneManager = (): SceneRouterTarget & { calls: string[]; active: Set<string> } => {
    const active = new Set<string>();
    const calls: string[] = [];
    const createListeners = new Map<string, () => void>();
    return {
        active,
        calls,
        start: (sceneKey) => {
            calls.push(`start:${sceneKey}`);
            active.add(sceneKey);
            const listener = createListeners.get(sceneKey);
            createListeners.delete(sceneKey);
            listener?.();
        },
        stop: (sceneKey) => {
            calls.push(`stop:${sceneKey}`);
            active.delete(sceneKey);
        },
        isActive: (sceneKey) => active.has(sceneKey),
        onceCreated: (sceneKey, listener) => createListeners.set(sceneKey, listener)
    };
};

/** Derived from the domain calculator so the run's stored result matches what restore recomputes. */
const youngRun = (id: string, slitSpacingMm: number, screenDistanceM: number) => {
    const modelInputs = { wavelengthNm: 550, wavelengthMode: 'minimum' as const, slitSpacingMm, screenDistanceM };
    const result = calculateYoungFringeSpacing(modelInputs);
    if (!result.ok) throw new Error(`The ${id} fixture is not a physical Young configuration.`);
    return {
        id,
        caseId: 'young-interference' as const,
        controls: { slitSpacingMm, screenDistanceM },
        modelInputs,
        result: result.value,
        timestamp: `2026-08-05T10:0${id.slice(-1)}:00.000Z`,
        experimentModelVersion: 'young-observation-v1',
        linkedEvidenceIds: ['source-1', 'source-2']
    };
};

const runs = [youngRun('run-001', 0.25, 2), youngRun('run-002', 0.35, 3)];
const runIds: readonly [string, string] = ['run-001', 'run-002'];

/**
 * A record that satisfies every readiness gate restore enforces at the given phase. Restoring at
 * `review` or `debrief` requires a conclusion-ready evidence chain — two distinct physical Young
 * configurations, a saved comparison of them, and a bounded claim — so the fixture carries it for
 * every phase rather than pretending a later phase can be reached without it.
 */
const recordAtPhase = (phase: CasePhase) => {
    const progress = {
        schemaVersion: 3 as const,
        caseId: 'young-interference' as const,
        caseDefinitionVersion: '1.0.0',
        phase,
        activeControlValues: { slitSpacingMm: 0.25, screenDistanceM: 2 },
        inspectedSourceIds: ['source-1', 'source-2'],
        prediction: 'A patterned result may appear.',
        runs,
        comparison: { selectedRunIds: [...runIds], notes: [{ runIds, text: 'Wider spacing narrowed the fringes.' }] },
        theory: {
            selectedRunIds: [...runIds],
            selectedSourceIds: ['source-1', 'source-2'],
            conclusion: 'Within this apparatus range the fringe spacing tracks the slit spacing.',
            limitation: 'Only two configurations were observed.'
        },
        decisionHistory: [],
        replay: { isCounterfactual: false }
    };
    // Restore rejects a record whose recognition disagrees with what the rules derive from it, so it
    // is derived here rather than transcribed.
    return { ...progress, recognition: deriveRecognition(definition, progress) };
};

/**
 * Restores through the same factory the reload path uses, so these cases exercise the mechanism AC2
 * actually relies on rather than a hand-stamped `phase` the reducers could never produce.
 */
const storeAtPhase = (phase: CasePhase): AppStore => {
    const restored = createAppStateFromCaseRecord(recordAtPhase(phase) as CaseRecord, definition);
    if (!restored.ok) throw new Error(`The ${phase} record did not restore: ${restored.error.message}`);
    return createStore(restored.value);
};

const advanceToExperiment = (store: AppStore): void => {
    ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
};

describe('SceneRouter', () => {
    it('activates the scene for the initial phase before any transition', () => {
        const scenes = createFakeSceneManager();

        const router = createSceneRouter(scenes, createStore(createInitialAppState(definition)), scenarioScript);

        expect(router.getActiveSceneKey()).toBe('Library');
        expect(scenes.calls).toEqual(['start:Library']);
        router.dispose();
    });

    it('follows the authoritative phase and stops the scene it leaves', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        const router = createSceneRouter(scenes, store, scenarioScript);

        advanceToExperiment(store);

        expect(router.getActiveSceneKey()).toBe('Laboratory');
        expect(scenes.calls).toEqual([
            'start:Library',
            'stop:Library', 'start:Colleagues',
            'stop:Colleagues', 'start:Laboratory'
        ]);
        expect([...scenes.active]).toEqual(['Laboratory']);
        router.dispose();
    });

    it('never dispatches anything of its own, at construction or on a transition', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        // Spying after construction would miss an activation-time dispatch, so wrap before the router
        // exists and count: every call on the spy has to be one this test made.
        const dispatch = vi.spyOn(store, 'dispatch');
        const router = createSceneRouter(scenes, store, scenarioScript);

        expect(dispatch).not.toHaveBeenCalled();

        store.dispatch({ type: 'source.inspected', sourceId: 'source-1' });
        store.dispatch({ type: 'source.inspected', sourceId: 'source-2' });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });

        expect(dispatch).toHaveBeenCalledTimes(3);
        expect(store.getState().phase).toBe('prediction');
        expect(router.getActiveSceneKey()).toBe('Colleagues');
        router.dispose();
    });

    it('leaves the scene running when a transition keeps the same authored scene', () => {
        const scenes = createFakeSceneManager();
        const store = storeAtPhase('synthesis');
        const router = createSceneRouter(scenes, store, scenarioScript);

        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'review' });

        expect(store.getState().phase).toBe('review');
        expect(router.getActiveSceneKey()).toBe('TheoryBoard');
        expect(scenes.calls).toEqual(['start:TheoryBoard']);
        router.dispose();
    });

    it('does not restart the active scene when the store notifies without a phase change', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        const router = createSceneRouter(scenes, store, scenarioScript);

        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'dom' });

        expect(scenes.calls).toEqual(['start:Library']);
        router.dispose();
    });

    // Restored through the real record path, so each phase here is one a saved session can actually
    // hold. `debrief` is absent deliberately: its record additionally requires a full peer-reviewed
    // completion snapshot, which would make this a persistence fixture rather than a routing test —
    // its phase→scene resolution is covered purely in tests/unit/SceneRouter.test.ts, and the E2E
    // reaches the debrief scene through the real flow.
    it.each([
        ['experiment', 'Laboratory'],
        ['synthesis', 'TheoryBoard'],
        ['review', 'TheoryBoard']
    ] as const)('restores a reloaded session at the %s phase into the %s scene', (phase, sceneKey) => {
        const scenes = createFakeSceneManager();

        const router = createSceneRouter(scenes, storeAtPhase(phase), scenarioScript);

        expect(router.getActiveSceneKey()).toBe(sceneKey);
        expect(scenes.calls).toEqual([`start:${sceneKey}`]);
        router.dispose();
    });

    it('reports each activation so the shell can expose the active scene', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        const activated: SceneKey[] = [];

        const router = createSceneRouter(scenes, store, scenarioScript, (sceneKey) => activated.push(sceneKey));
        advanceToExperiment(store);

        expect(activated).toEqual(['Library', 'Colleagues', 'Laboratory']);
        router.dispose();
    });

    it('reports an activation only once the scene has really been created', () => {
        // Phaser declines an unknown key with a console warning rather than a throw, so a router that
        // announced its own intent would claim a scene that never ran.
        const scenes = { ...createFakeSceneManager(), start: () => undefined };
        const store = createStore(createInitialAppState(definition));
        const activated: SceneKey[] = [];

        const router = createSceneRouter(scenes, store, scenarioScript, (sceneKey) => activated.push(sceneKey));

        expect(activated).toEqual([]);
        router.dispose();
    });

    it('contains a failed activation instead of breaking the dispatch that triggered it', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        const failing = {
            ...scenes,
            start: (sceneKey: SceneKey) => {
                if (sceneKey === 'Colleagues') throw new Error('The scene could not be created.');
                return scenes.start(sceneKey);
            }
        };
        const router = createSceneRouter(failing, store, scenarioScript);
        expect(router.getActiveSceneKey()).toBe('Library');
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));

        // A Phaser create() failure runs inside notify() inside dispatch(). If it escaped, the phase
        // would already have advanced while dispatch threw at its caller and later subscribers were
        // skipped, so the contract to check is that dispatch still returns its Result.
        const transition = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });

        expect(transition.ok).toBe(true);
        expect(store.getState().phase).toBe('prediction');
        // No scene is known to be running, so the next transition must route from scratch rather than
        // matching a stale key and skipping the start.
        expect(router.getActiveSceneKey()).toBeUndefined();
        router.dispose();
    });

    it('stops following the phase once disposed', () => {
        const scenes = createFakeSceneManager();
        const store = createStore(createInitialAppState(definition));
        const router = createSceneRouter(scenes, store, scenarioScript);

        router.dispose();
        advanceToExperiment(store);

        expect(scenes.calls).toEqual(['start:Library']);
        expect(router.getActiveSceneKey()).toBe('Library');
    });
});

/**
 * AC5, half one: **the router drives the full flow from an authored script, with no shipped case
 * loaded** (Story 3.4).
 *
 * Driven from `docs/content-authoring/minimal-scenario.case.json` — the authoring example, which is not
 * a member of `KNOWN_CASE_IDS` and is not under `public/cases/`. If any part of the flow needed a
 * shipped case, this could not resolve at all.
 *
 * The store is a **structural slice** rather than a restored record, for the reason `SceneRouterTarget`
 * itself is one: the router reads exactly two things from state — the phase and whether a rival-lab
 * challenge stands — and building six persisted records to vary the first would make this a persistence
 * fixture rather than a routing test. The phases it is driven through are `CASE_PHASES` itself, so a
 * seventh phase would fail here rather than silently going unrouted.
 *
 * The second test is the one with teeth: it **permutes** the authored phase→scene map and asserts the
 * router follows the permutation. Resolving the example's own map proves only that the map happens to
 * match the order the engine would have used anyway.
 */
describe('an authored scenario drives the whole flow', () => {
    let example: CaseDefinition;

    beforeAll(async () => { example = await loadAuthoringExample(); });

    /** A store that reports one phase and notifies nobody: the two facts the router actually reads. */
    const storeReporting = (phase: CasePhase): AppStore => {
        const state = { ...createInitialAppState(example), phase };
        return {
            getState: () => state,
            subscribe: () => () => undefined,
            dispatch: () => ({ ok: true, value: state })
        } as unknown as AppStore;
    };

    const authoredSceneFor = (script: ScenarioScript, phase: CasePhase): SceneKey =>
        script.scenes.find((scene) => scene.phase === phase)!.sceneKey;

    it('resolves every phase to the scene the example authors', () => {
        CASE_PHASES.forEach((phase) => {
            const scenes = createFakeSceneManager();
            const router = createSceneRouter(scenes, storeReporting(phase), example.scenarioScript);

            expect(router.getActiveSceneKey()).toBe(authoredSceneFor(example.scenarioScript, phase));
            expect(scenes.calls).toEqual([`start:${authoredSceneFor(example.scenarioScript, phase)}`]);
            router.dispose();
        });
    });

    it('follows a permuted map, so no phase→scene pairing is written into the engine', () => {
        // Every phase sent to a scene the shipped cases never send it to. If any scene key were
        // inferred from the phase rather than read from the script, at least one of these would come
        // back with the conventional answer instead of the authored one.
        const permuted: ScenarioScript = {
            scenes: [
                { phase: 'context', sceneKey: 'Debrief' },
                { phase: 'prediction', sceneKey: 'Laboratory' },
                { phase: 'experiment', sceneKey: 'TheoryBoard' },
                { phase: 'synthesis', sceneKey: 'Colleagues' },
                { phase: 'review', sceneKey: 'Library' },
                { phase: 'debrief', sceneKey: 'Colleagues' }
            ]
        };
        // It is authorable content, not a shape only this test can make: the same schema that guards
        // the shipped cases accepts it, which is what makes the permutation a real authoring choice.
        expect(CaseDefinitionSchema.safeParse({ ...example, scenarioScript: permuted }).success).toBe(true);

        CASE_PHASES.forEach((phase) => {
            const scenes = createFakeSceneManager();
            const router = createSceneRouter(scenes, storeReporting(phase), permuted);

            expect(router.getActiveSceneKey()).toBe(authoredSceneFor(permuted, phase));
            router.dispose();
        });

        // And it really is a permutation — if it matched the example's own map, the walk above would
        // pass without the router having read anything.
        const moved = CASE_PHASES.filter((phase) =>
            authoredSceneFor(permuted, phase) !== authoredSceneFor(example.scenarioScript, phase));
        expect(moved).toEqual([...CASE_PHASES]);
    });

    it('reuses one scene for two phases when the script says so, without restarting it', () => {
        // The property that makes `TheoryBoard` able to host `synthesis` and `review`, stated against
        // authored content rather than against Young's habit of doing it.
        const scenes = createFakeSceneManager();
        const script = example.scenarioScript;
        const shared = script.scenes.filter(({ sceneKey }) => sceneKey === 'TheoryBoard');
        expect(shared.length).toBeGreaterThan(1);

        const router = createSceneRouter(scenes, storeReporting(shared[0]!.phase), script);
        expect(scenes.calls).toEqual(['start:TheoryBoard']);
        router.dispose();
    });
});
