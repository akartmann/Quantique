import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DebriefRenderer } from '../../src/adapters/phaser/renderers/DebriefRenderer';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState, type AppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { RECOGNITION_IDS } from '../../src/domain/recognition/recognitionRules';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { loadMorleyMillerCase } from './shippedCases';
import { makeSceneSlice, makeWindowStub, type SceneSlice } from './sceneSlice';

/**
 * **This case's debrief, painted from the case that ships** (Story 4.3, AC4).
 *
 * `DebriefRenderer.test.ts` covers the renderer's mechanics — the paging, the deeper-theory toggle, the
 * counterfactual warning, the locale repaint — against a fixture, which is right for mechanics. It is
 * wrong for content: a fixture cites its own two artifacts and reports its own two provenance
 * categories, so it can prove the renderer draws *a* citation while saying nothing about whether
 * Morley–Miller's two citations resolve at all. `ApparatusCaseVoice.test.ts` states the rule this file
 * follows — *"a fixture would let a projection agree with a case nobody plays"*.
 *
 * That distinction is not hypothetical here. `debrief.sourceRefs` on this case authors
 * `michelson-morley-1887-ajs`, which **matches no `contextualArtifacts` id** (the artifact is
 * `michelson-morley-1887`; the `-ajs` string is its `provenance.reference`). Nothing reads `sourceRefs`,
 * so nothing has ever noticed. What the surface actually cites is
 * `historicalComparison.sourceIds`, which the schema cross-checks — and that is what is asserted below,
 * by resolved display name rather than by count.
 *
 * ## The state is reached, not constructed
 *
 * The completion snapshot comes from driving the real store through the real reducers to
 * `case.debriefCompleted`, on the two observations the case's own `resetPath` teaches. A hand-built
 * `CompletionSnapshot` would let this file agree with itself about what a finished investigation on this
 * case looks like — and `reduceDebriefComplete` is the authority on that, refusing without a saved
 * reviewed revision whose draft still matches the live one.
 */

const STEADY_BATH_C = 20;

let definition: CaseDefinition;

beforeAll(async () => {
    definition = await loadMorleyMillerCase();
});

const mustDispatch = (store: AppStore, action: Parameters<AppStore['dispatch']>[0], what: string): void => {
    const result = store.dispatch(action);
    if (!result.ok) throw new Error(`${what}: ${result.error.code} — ${result.error.message}`);
};

/**
 * A completed investigation on this case, in the given locale, concluding with the named proposal.
 *
 * Both conclusions AC4 asks about are reachable through this one function, and that matters: the
 * recognition account differs between them by exactly one row, and a second helper would be a second
 * opinion about what "completed" means.
 */
const completedState = (locale: 'en' | 'fr', conclusionProposalId: string): AppState => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    mustDispatch(store, { type: 'case.phaseAdvance', nextPhase: 'prediction' }, 'prediction');
    mustDispatch(store, { type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id }, 'prediction choice');
    mustDispatch(store, { type: 'case.phaseAdvance', nextPhase: 'experiment' }, 'experiment');

    ([[0, 'run-a'], [90, 'run-b']] as const).forEach(([rotationDeg, id], index) => {
        mustDispatch(store, { type: 'apparatus.controlSet', controlId: 'rotationDeg', value: rotationDeg, origin: 'phaser' }, 'rotation');
        mustDispatch(store, { type: 'apparatus.controlSet', controlId: 'bathTempC', value: STEADY_BATH_C, origin: 'phaser' }, 'bath');
        mustDispatch(store, { type: 'experiment.run', id, timestamp: `2026-08-21T09:0${index}:00.000Z` }, `run ${id}`);
    });

    mustDispatch(store, { type: 'comparison.runSelected', runId: 'run-a' }, 'select a');
    mustDispatch(store, { type: 'comparison.runSelected', runId: 'run-b' }, 'select b');
    mustDispatch(store, { type: 'comparison.noteSaved', note: 'The turn moves it; the bath was held.' }, 'note');
    mustDispatch(store, { type: 'case.phaseAdvance', nextPhase: 'synthesis' }, 'synthesis');

    mustDispatch(store, { type: 'theory.conclusionProposalChosen', proposalId: conclusionProposalId }, 'conclusion');
    (['run-a', 'run-b'] as const).forEach((runId) =>
        mustDispatch(store, { type: 'theory.supportRunSelected', runId }, `pin ${runId}`));
    definition.contextualArtifacts.forEach(({ id }) =>
        mustDispatch(store, { type: 'theory.supportSourceSelected', sourceId: id }, `pin ${id}`));

    mustDispatch(store, { type: 'theory.reviewRequested' }, 'review');
    mustDispatch(store, { type: 'peerReview.requested' }, 'peer review');
    mustDispatch(store, { type: 'revision.saved', timestamp: '2026-08-21T10:00:00.000Z' }, 'revision');
    mustDispatch(store, { type: 'case.debriefCompleted', timestamp: '2026-08-21T11:00:00.000Z' }, 'debrief');

    const state = store.getState();
    if (state.phase !== 'debrief') throw new Error(`The case must reach debrief, not ${state.phase}.`);
    if (!state.completion) throw new Error('Completing the case must write a snapshot.');
    return state;
};

type Harness = Readonly<{ slice: SceneSlice; renderer: DebriefRenderer }>;

const mount = (state: AppState): Harness => {
    const slice = makeSceneSlice();
    const renderer = new DebriefRenderer(slice.scene, createPhaserStoreAdapter(createStore(state)));
    renderer.create();
    renderer.render(state);
    return { slice, renderer };
};

/** `textStyles.textResolution()` reads `window.devicePixelRatio`, and Vitest runs in Node. */
const stub = makeWindowStub();

let harness: Harness | undefined;

beforeEach(() => {
    vi.stubGlobal('window', stub.window);
});

afterEach(() => {
    harness?.renderer.destroy();
    harness = undefined;
    vi.unstubAllGlobals();
});

describe('the Morley–Miller debrief paints this case\'s own record', () => {
    it('renders the authored summary and the historical comparison, in the active locale', () => {
        harness = mount(completedState('en', 'conclude-bounded-null'));
        const english = harness.slice.texts();

        expect(english).toContain(definition.debrief.summary.en);
        expect(english).toContain(definition.debrief.historicalComparison.title.en);
        expect(english).toContain(definition.debrief.historicalComparison.text.en);
        // No English leaking where French belongs is the other half, and it is asserted by the locale row
        // below rather than by an absence here.
        expect(english).not.toContain(definition.debrief.summary.fr);
    });

    it('renders the same three blocks in French, with no English fallback', () => {
        harness = mount(completedState('fr', 'conclude-bounded-null'));
        const french = harness.slice.texts();

        expect(french).toContain(definition.debrief.summary.fr);
        expect(french).toContain(definition.debrief.historicalComparison.title.fr);
        expect(french).toContain(definition.debrief.historicalComparison.text.fr);
        expect(french).not.toContain(definition.debrief.summary.en);
        expect(french).not.toContain(definition.debrief.historicalComparison.text.en);
    });

    /**
     * **Both of the 1907 report's own numbers reach the surface**, which is the whole point of Story
     * 4.1's re-anchoring and the reason this case teaches a bounded null rather than a disproof.
     *
     * Asserted as substrings of the *painted* text rather than of `case.json`, and in both locales with
     * each locale's own decimal comma — a check against the authored string alone would pass while the
     * comparison band was cropped or omitted, which is exactly what happened to the recognition rows in
     * Story 2.11 under 1125 green tests.
     *
     * **Named change that breaks this:** dropping `historicalComparison.text` from `DebriefRenderer`'s
     * comparison band, or authoring the numbers back out of the 1907 transcription.
     */
    it('states the 1907 bound — 1.53 wave-lengths, one eightieth — where the player reads it', () => {
        harness = mount(completedState('en', 'conclude-bounded-null'));
        const comparison = harness.slice.texts().find((text) => text === definition.debrief.historicalComparison.text.en);
        expect(comparison).toBeDefined();
        expect(comparison).toContain('1.53');
        expect(comparison).toContain('one eightieth');

        harness.renderer.destroy();
        harness = mount(completedState('fr', 'conclude-bounded-null'));
        const french = harness.slice.texts().find((text) => text === definition.debrief.historicalComparison.text.fr);
        expect(french).toBeDefined();
        expect(french).toContain('1,53');
        expect(french).toContain('quatre-vingtième');
    });

    it('renders the optional deeper-theory layer\'s authored title', () => {
        harness = mount(completedState('en', 'conclude-bounded-null'));
        expect(harness.slice.texts()).toContain(definition.debrief.deeperTheory.title.en);
    });

    /**
     * The two citations resolve — **by name, and from `historicalComparison.sourceIds`**.
     *
     * `selectLocalizedDebrief` cites that two-tuple, which `CaseDefinitionSchema` cross-checks against
     * `contextualArtifacts`. `debrief.sourceRefs` is a *different* field, is validated against nothing,
     * authors `michelson-morley-1887-ajs` — an id no artifact carries — and is read by nothing at all.
     * This asserts the field that works, so that a future edit moving the citation to `sourceRefs` fails
     * here rather than painting an empty band.
     *
     * **Named change that breaks this:** the mutation §SS10 asked for — pointing one `sourceIds` entry at
     * an id no artifact matches — turns out **not to reach this assertion at all**, and that is worth
     * recording rather than papering over. `CaseDefinitionSchema` refuses such a case *at load*, with the
     * offending path named (*"Historical comparison must cite two distinct authored sources"*), so
     * `loadMorleyMillerCase` throws and every test in this file errors before the renderer is mounted.
     * A stronger guard than the one the story anticipated, one layer earlier.
     *
     * So what this row actually guards is the half the schema cannot see: the **rendering** path. Proved
     * by mutating that instead — making `DebriefRenderer.renderSources` treat the first row's source as
     * absent, which is its own degraded-cache branch — and the row goes red while the case still parses
     * (mutation proof 6). The distinction matters: the schema guarantees the citation *resolves*, and
     * only this guarantees it is *drawn*.
     */
    it('cites both artifacts named by historicalComparison.sourceIds, resolved to display names', () => {
        harness = mount(completedState('fr', 'conclude-bounded-null'));
        const french = harness.slice.texts();

        const cited = definition.debrief.historicalComparison.sourceIds.map((sourceId) => {
            const artifact = definition.contextualArtifacts.find(({ id }) => id === sourceId);
            if (!artifact) throw new Error(`The schema must cross-check ${sourceId} against an artifact.`);
            return artifact;
        });
        expect(cited).toHaveLength(2);
        cited.forEach((artifact) => expect(french).toContain(artifact.displayName.fr));
    });

    /**
     * Each cited source's provenance, source type and rights, composed by `debrief.sources.line` and
     * localized — the three labels AC4 names.
     */
    it('names each cited source\'s provenance, type and rights beside it', () => {
        harness = mount(completedState('en', 'conclude-bounded-null'));
        const english = harness.slice.texts();

        definition.debrief.historicalComparison.sourceIds.forEach((sourceId) => {
            const artifact = definition.contextualArtifacts.find(({ id }) => id === sourceId)!;
            const line = en['debrief.sources.line']
                .replace('{provenance}', en[`source.provenanceName.${artifact.provenance.category}`])
                .replace('{type}', en[`source.type.${artifact.sourceType}`])
                .replace('{rights}', en[`source.rights.${artifact.rightsStatus}`]);
            expect(english).toContain(line);
        });
    });
});

describe('the recognition account the debrief paints, on this case', () => {
    it('draws all four rows, localized by stable id, with no canonical English in the French frame', () => {
        harness = mount(completedState('fr', 'conclude-bounded-null'));
        const french = harness.slice.texts();

        RECOGNITION_IDS.forEach((id) => {
            expect(french).toContain(fr[`recognition.${id}.label`]);
            expect(french).not.toContain(en[`recognition.${id}.label`]);
        });
        expect(french).toContain(fr['debrief.recognition.intro']);
    });

    /**
     * **The NFR8 row, read where the player reads it** (AC4's recognition clause).
     *
     * The two paths differ by **exactly one row**, and that row is `calibrated-conclusion`. Asserted as a
     * difference rather than as two absolute tallies, for a reason worth recording: the first version of
     * this test expected four "Recorded" marks on the bounded path and got three, because these two
     * observations vary the rotation and so earn `variable-curiosity` and **not** `replication` — which is
     * correct behaviour and the pair the case's own `resetPath` teaches. An absolute count here would have
     * been a number chosen to match today's walk, and it would move the next time the walk's evidence
     * changed for reasons having nothing to do with overclaiming.
     *
     * What is not negotiable is the difference, and the difference is the thing NFR8 is about.
     *
     * Both halves are read off the painted frame, not off `deriveRecognition` —
     * `MorleyMillerConclusion.test.ts` asserts the rule directly; this asserts that the debrief shows it.
     *
     * **Named change that breaks this:** reverting `conclude-ether-disproved.claim.en` to text the
     * authored phrase set does not match, at which point the two paths paint identical accounts and the
     * debrief tells a player who declared the ether disproved that they recorded a calibrated conclusion
     * (mutation proof 9).
     */
    it('marks the bounded conclusion calibrated and the overclaim not, on the same evidence', () => {
        const marks = (conclusionProposalId: string) => {
            harness?.renderer.destroy();
            harness = mount(completedState('en', conclusionProposalId));
            const texts = harness.slice.texts();
            return {
                recorded: texts.filter((text) => text === en['debrief.recognition.achieved']).length,
                notRecorded: texts.filter((text) => text === en['debrief.recognition.notRecorded']).length
            };
        };

        const bounded = marks('conclude-bounded-null');
        const overclaim = marks('conclude-ether-disproved');

        // Every row is accounted for on both paths — a band that painted no mark at all would otherwise
        // satisfy the difference below with two zeroes.
        expect(bounded.recorded + bounded.notRecorded).toBe(RECOGNITION_IDS.length);
        expect(overclaim.recorded + overclaim.notRecorded).toBe(RECOGNITION_IDS.length);
        // And the overclaim earns exactly one fewer.
        expect(overclaim.recorded).toBe(bounded.recorded - 1);

        // Which row moved, which the counts cannot say. The renderer reads the persisted snapshot, so this
        // reads the same snapshot.
        const achievedOn = (conclusionProposalId: string) => new Set(
            (completedState('en', conclusionProposalId).completion?.recognition.items ?? [])
                .filter(({ achieved }) => achieved).map(({ id }) => id)
        );
        const boundedIds = achievedOn('conclude-bounded-null');
        const overclaimIds = achievedOn('conclude-ether-disproved');

        expect(boundedIds.has('calibrated-conclusion')).toBe(true);
        expect(overclaimIds.has('calibrated-conclusion')).toBe(false);
        expect([...boundedIds].filter((id) => !overclaimIds.has(id))).toEqual(['calibrated-conclusion']);
        expect([...overclaimIds].filter((id) => !boundedIds.has(id))).toEqual([]);
    });

    /**
     * The debrief is reachable **with** the overclaim standing, and that is required rather than
     * incidental: FR16 and NFR8 forbid a hard fail, a penalty or a lockout, so a weak conclusion earns
     * feedback and still finishes the case.
     *
     * `reduceDebriefComplete` deliberately does not inspect the standing issues. This is the row that
     * fails if someone "fixes" the overclaim by refusing completion — the shape §SS11 warns against.
     */
    it('completes the case on the overclaim, because a weak conclusion is never a lockout', () => {
        const state = completedState('en', 'conclude-ether-disproved');

        expect(state.phase).toBe('debrief');
        expect(state.completion?.finalDecision.feedback.status).toBe('reviewed');
        const feedback = state.completion?.finalDecision.feedback;
        expect(feedback?.status === 'reviewed' && feedback.issues.map(({ code }) => code)).toEqual(['overreach']);
    });
});
