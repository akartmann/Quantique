import { readdir, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { createInitialAppState, reduceAppState, type AppState } from '../../src/core/store/AppState';
import { createCaseRecordProjection } from '../../src/core/store/CaseRecordProjection';
import { validateCaseRecordForDefinition, type CaseRecord } from '../../src/schemas/CaseRecordSchema';
import { readCompletedCampaignCaseIds } from '../../src/adapters/persistence/completedCampaignCases';
import { CaseRecordRepository, type CaseRecordStorage } from '../../src/adapters/persistence/caseRecordRepository';
import { createStore } from '../../src/core/store/createStore';
import { selectConclusionReadiness, selectDefensibleConclusionProposalIds } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema, KNOWN_CASE_IDS, MORLEY_MILLER_CASE_ID, YOUNG_CASE_ID } from '../../src/schemas/CaseDefinitionSchema';
import { resolveCaseId } from '../../src/adapters/content/resolveCaseId';
import { CAMPAIGN_ORDER } from '../../src/domain/cases/campaignOrder';
import { EXPERIMENT_MODEL_IDS } from '../../src/domain/apparatus/experimentModels';
import {
    ETHER_DEMANDED_DISPLACEMENT_FRINGE_WIDTHS,
    ORIENTATION_AMPLITUDE,
    PUBLISHED_CERTAINTY_FRACTION,
    PUBLISHED_RESIDUAL_BOUND_FRINGE_WIDTHS
} from '../../src/domain/apparatus/calculateInterferometerDrift';

/**
 * The shipped prototype, parsed the way `loadCaseDefinition` parses it.
 *
 * Read from `public/cases/` rather than fabricated, following the dominant fixture pattern: a fixture
 * shaped like the case proves the schema accepts the fixture. This file's whole argument is that the
 * *shipped content* loads and plays, which is the one thing Story 3.1's in-memory second case could
 * not show (D1).
 */
const loadPrototype = async (): Promise<CaseDefinition> => {
    const raw: unknown = JSON.parse(await readFile('public/cases/morley-miller/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(raw);
    if (!parsed.success) {
        throw new Error(`The shipped prototype does not parse: ${JSON.stringify(parsed.error.issues, null, 2)}`);
    }
    return parsed.data as unknown as CaseDefinition;
};

/**
 * The prototype driven to a completed record through the real reducers.
 *
 * Extracted by the code review of 4.1 so the record-compatibility and campaign-routing tests below can
 * share one genuinely completed investigation. A hand-built `completion` would be shape-valid and prove
 * nothing about the walk that produces it, which is the whole reason the original test drove the
 * reducers rather than assembling a fixture.
 */
/** A repository over a fake storage, for the campaign-routing probe tests. */
const repositoryReturning = (records: Readonly<Record<string, unknown>>): CaseRecordRepository =>
    new CaseRecordRepository({
        read: async (caseId) => ({ ok: true, value: records[caseId] }),
        write: async () => ({ ok: true, value: undefined })
    } satisfies CaseRecordStorage);

const playPrototypeToCompletion = (definition: CaseDefinition): CaseRecord => {
    const store = createStore(createInitialAppState(definition, 'en'));
    const dispatch = (action: Parameters<typeof reduceAppState>[1]): void => {
        const result = store.dispatch(action);
        if (!result.ok) throw new Error(`Refused ${action.type}: ${result.error.code} — ${result.error.message}`);
    };

        dispatch({ type: 'source.inspected', sourceId: 'michelson-morley-1887' });
        dispatch({ type: 'source.inspected', sourceId: 'morley-miller-1907-final-report' });
        dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        dispatch({ type: 'prediction.proposalChosen', proposalId: 'predict-small-shift' });
        dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        dispatch({ type: 'apparatus.controlSet', controlId: 'bathTempC', value: 20, origin: 'phaser' });
        dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-19T10:00:00.000Z' });
        dispatch({ type: 'apparatus.controlSet', controlId: 'rotationDeg', value: 90, origin: 'phaser' });
        dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-19T10:05:00.000Z' });
        dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
        dispatch({ type: 'comparison.runSelected', runId: 'run-1' });
        dispatch({ type: 'comparison.runSelected', runId: 'run-2' });
        dispatch({ type: 'comparison.noteSaved', note: 'Reversing the orientation reverses the sign of a very small displacement.' });
        dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' });
        dispatch({ type: 'theory.supportRunSelected', runId: 'run-2' });
        dispatch({ type: 'theory.supportSourceSelected', sourceId: 'michelson-morley-1887' });
        dispatch({ type: 'theory.supportSourceSelected', sourceId: 'morley-miller-1907-final-report' });
        dispatch({ type: 'theory.conclusionProposalChosen', proposalId: 'conclude-bounded-null' });
        dispatch({ type: 'theory.reviewRequested' });
        dispatch({ type: 'peerReview.requested' });
        dispatch({ type: 'revision.saved', timestamp: '2026-08-19T10:10:00.000Z' });
        dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-19T10:15:00.000Z' });


    const projected = createCaseRecordProjection(store.getState());
    if (!projected.ok) throw new Error('The completion walk did not produce a valid record.');
    return projected.value;
};

describe('the shipped Morley–Miller prototype', () => {
    it('parses through the case contract with no Young field authored anywhere', async () => {
        const definition = await loadPrototype();

        expect(definition.id).toBe(MORLEY_MILLER_CASE_ID);
        expect(definition.experiment.modelId).toBe('morley-miller-interferometer');
        expect(definition.experiment.wavelengthNm).toBeUndefined();
        expect(definition.experiment.wavelengthComparison).toBeUndefined();
        expect(definition.significanceRule.criticalModelInputIds).toBeUndefined();
        expect(definition.apparatus.primaryControls.map(({ id }) => id)).toEqual(['rotationDeg', 'bathTempC']);

        // No Young name survives anywhere in the authored document, at any depth.
        const serialized = JSON.stringify(definition);
        ['slitSpacingMm', 'screenDistanceM', 'wavelengthNm', 'wavelengthComparison', 'young-double-slit']
            .forEach((youngName) => expect(serialized).not.toContain(youngName));
    });

    it('agrees with its own asset manifest, so `manifestsMatch` can pass at load', async () => {
        const definition = await loadPrototype();
        const manifest: unknown = JSON.parse(await readFile('public/cases/morley-miller/asset-manifest.json', 'utf8'));

        expect(manifest).toEqual(definition.assets);
    });

    it('ships every source as reviewed, cited, and readable over HTTPS (AC7)', async () => {
        const definition = await loadPrototype();

        expect(definition.contextualArtifacts).toHaveLength(2);
        definition.contextualArtifacts.forEach((artifact) => {
            expect(artifact.rightsStatus).toBe('reviewed');
            const rendition = artifact.textualRendition;
            expect(rendition).toBeDefined();
            expect(rendition!.citation.citationText.trim().length).toBeGreaterThan(0);
            expect(new URL(rendition!.citation.archiveUrl).protocol).toBe('https:');
            // Exactly one rendition *of record*, and it is the English one. Not "one transcription":
            // the retired **1905** artifact was a reconstruction — its own `reuseStatement` said the prose
            // was written for this investigation — and it declared `kind: 'transcription'` with printed
            // page attributions because the enum offered nothing else. A reconstruction that borrows a
            // transcription's authority is the provenance claim AC7 exists to prevent (review
            // 2026-08-19). Story 4.1 replaced it with the 1907 final report, which is a genuine
            // transcription, so both of this case's renditions of record are now transcriptions — the
            // looser assertion is kept deliberately, because it is the rule the schema enforces.
            expect(rendition!.renditions.filter(({ kind }) => kind !== 'translation').map(({ locale }) => locale)).toEqual(['en']);
        });
    });

    /**
     * The model's two "published figures" against the transcription they are quoted from (AC3).
     *
     * `calculateInterferometerDrift` exports `ETHER_DEMANDED_DISPLACEMENT_FRINGE_WIDTHS = 1.53` and
     * `PUBLISHED_CERTAINTY_FRACTION = 1/80`, and its docstring quotes the 1907 sentence they come from.
     * Two docstrings and a test comment all claimed *this file* asserted the case's prose against them so
     * "the model and the transcription cannot drift" — and the 4.2 code review found no such assertion
     * anywhere, in any file. The constants were pinned only against literals of themselves, so
     * re-transcribing the paragraph to a different figure broke nothing.
     *
     * Mutation target: change either constant, or edit the quoted figures in the 1907 rendition, and this
     * fails by name. It is the only thing in the suite that couples the physics to the historical source.
     */
    it('anchors the model constants to the figures the 1907 rendition actually states', async () => {
        const definition = await loadPrototype();

        const report = definition.contextualArtifacts
            .find(({ textualRendition }) => textualRendition?.renditions
                .some(({ sections }) => sections.some(({ paragraphs }) => paragraphs
                    .some((paragraph) => paragraph.includes('displacement of the interference fringes')))));
        expect(report).toBeDefined();

        const prose = report!.textualRendition!.renditions
            .flatMap(({ sections }) => sections.flatMap(({ paragraphs }) => paragraphs))
            .join(' ');

        // The ether-demanded displacement, as a number the prose writes and the model exports.
        expect(prose).toContain(`${ETHER_DEMANDED_DISPLACEMENT_FRINGE_WIDTHS} wave-lengths`);
        // And the certainty fraction, which the prose states in words rather than as a numeral — so the
        // coupling is asserted on the word and on the arithmetic it stands for, together.
        expect(prose).toContain('one eightieth part');
        expect(PUBLISHED_CERTAINTY_FRACTION).toBe(1 / 80);
        expect(PUBLISHED_RESIDUAL_BOUND_FRINGE_WIDTHS)
            .toBeCloseTo(ETHER_DEMANDED_DISPLACEMENT_FRINGE_WIDTHS / 80, 12);
        // The property that makes the case honest, restated where the source is in hand: the apparatus
        // reads less than the largest residual those observations could not exclude.
        expect(ORIENTATION_AMPLITUDE).toBeLessThan(PUBLISHED_RESIDUAL_BOUND_FRINGE_WIDTHS);
    });

    it('names a model this build implements, and one whose inputs its apparatus authors', async () => {
        const definition = await loadPrototype();

        expect(EXPERIMENT_MODEL_IDS).toContain(definition.experiment.modelId);
    });
});

/**
 * The walk this story exists to make possible.
 *
 * Before Story 3.2 every step below refused: the bench refused the run (`invalid-young-model-input`),
 * and had it not, `evaluateConclusionReadiness` refused the conclusion twice over
 * (`non-physical-young-run`, `distinct-run-configurations`) for a case that records no Young model
 * inputs. All three refusals were **green** in a suite of 1293 tests, because no second case existed
 * to meet them.
 */
describe('the prototype played through the shared framework', () => {
    const advanceTo = (state: AppState, actions: readonly Parameters<typeof reduceAppState>[1][]): AppState =>
        actions.reduce((current, action) => {
            const next = reduceAppState(current, action);
            if (!next.ok) throw new Error(`Refused ${action.type}: ${next.error.code} — ${next.error.message}`);
            return next.value;
        }, state);

    it('records a run through the case\'s own model and lands it in the notebook (AC2)', async () => {
        const definition = await loadPrototype();
        const state = advanceTo(createInitialAppState(definition, 'en'), [
            { type: 'source.inspected', sourceId: 'michelson-morley-1887' },
            { type: 'source.inspected', sourceId: 'morley-miller-1907-final-report' },
            { type: 'case.phaseAdvance', nextPhase: 'prediction' },
            { type: 'prediction.proposalChosen', proposalId: 'predict-small-shift' },
            { type: 'case.phaseAdvance', nextPhase: 'experiment' },
            { type: 'experiment.run', id: 'run-1', timestamp: '2026-08-19T10:00:00.000Z' }
        ]);

        expect(state.runs).toHaveLength(1);
        const [run] = state.runs;
        expect(run!.result).toEqual({ label: 'Fringe displacement', value: 0.11, unit: 'fringe widths' });
        expect(run!.controls).toEqual({ rotationDeg: 0, bathTempC: 22 });
        // The prototype records no Young optical inputs — that is the whole of D4, asserted.
        expect(run!.modelInputs).toBeUndefined();
        expect(run!.experimentModelVersion).toBe('morley-miller-interferometer-v1');
    });

    it('unlocks the conclusion the theory board could never have unlocked before (AC3)', async () => {
        const definition = await loadPrototype();
        const store = createStore(createInitialAppState(definition, 'en'));
        const dispatch = (action: Parameters<typeof reduceAppState>[1]): void => {
            const result = store.dispatch(action);
            if (!result.ok) throw new Error(`Refused ${action.type}: ${result.error.code} — ${result.error.message}`);
        };

        dispatch({ type: 'source.inspected', sourceId: 'michelson-morley-1887' });
        dispatch({ type: 'source.inspected', sourceId: 'morley-miller-1907-final-report' });
        dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        dispatch({ type: 'prediction.proposalChosen', proposalId: 'predict-small-shift' });
        dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });

        // Two orientations at the stable bath window: a genuinely distinguishing pair, because the
        // model's `cos(2θ)` term reverses sign between them.
        dispatch({ type: 'apparatus.controlSet', controlId: 'bathTempC', value: 20, origin: 'phaser' });
        dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-19T10:00:00.000Z' });
        dispatch({ type: 'apparatus.controlSet', controlId: 'rotationDeg', value: 90, origin: 'phaser' });
        dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-19T10:05:00.000Z' });

        // The significant-measure gate opens — this is what lets the case reach synthesis at all.
        dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
        dispatch({ type: 'comparison.runSelected', runId: 'run-1' });
        dispatch({ type: 'comparison.runSelected', runId: 'run-2' });
        dispatch({ type: 'comparison.noteSaved', note: 'Reversing the orientation reverses the sign of a very small displacement.' });
        dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' });
        dispatch({ type: 'theory.supportRunSelected', runId: 'run-2' });
        dispatch({ type: 'theory.supportSourceSelected', sourceId: 'michelson-morley-1887' });
        dispatch({ type: 'theory.supportSourceSelected', sourceId: 'morley-miller-1907-final-report' });
        dispatch({ type: 'theory.conclusionProposalChosen', proposalId: 'conclude-bounded-null' });

        const readiness = selectConclusionReadiness(store.getState());
        expect(readiness.missing).toEqual([]);
        expect(readiness.status).toBe('ready');

        // And the review the readiness gate guards actually opens.
        dispatch({ type: 'case.phaseAdvance', nextPhase: 'review' });
        expect(store.getState().phase).toBe('review');
    });

    /**
     * **The bounded-null claim is honest *and* reachable by the route the case teaches.**
     * (Code review 2026-08-19.)
     *
     * The claim reads "Held at a steady bath temperature" and no predicate enforced it, so the game
     * endorsed it over evidence taken at two temperatures whose thermal term (0.05/°C) dwarfs the whole
     * ±0.01 orientation signal being bounded. The obvious fix — an all-runs `unvaried-control` — would
     * have made it unreachable instead, because `experiment.resetPath` instructs the player to *move* the
     * bath and come back: "Bring the bath back to its steady window and take the reading again."
     *
     * So this walks the taught route in full — vary the bath, discover the confound, return to the window,
     * take two orientations there, pin those two — and asserts the claim is defensible. The sibling row
     * asserts the pair that should *not* defend it.
     */
    it('defends the bounded-null claim after the taught confound detour, and refuses a pair taken at two temperatures', async () => {
        const definition = await loadPrototype();

        const walk = (pinned: readonly [string, string], warmRun: boolean): readonly string[] => {
            const store = createStore(createInitialAppState(definition, 'en'));
            const dispatch = (action: Parameters<typeof reduceAppState>[1]): void => {
                const result = store.dispatch(action);
                if (!result.ok) throw new Error(`Refused ${action.type}: ${result.error.code} — ${result.error.message}`);
            };
            dispatch({ type: 'source.inspected', sourceId: 'michelson-morley-1887' });
            dispatch({ type: 'source.inspected', sourceId: 'morley-miller-1907-final-report' });
            dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
            dispatch({ type: 'prediction.proposalChosen', proposalId: 'predict-small-shift' });
            dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });

            // The confound detour the case teaches: a reading taken warm, which stays in the notebook.
            if (warmRun) {
                dispatch({ type: 'apparatus.controlSet', controlId: 'bathTempC', value: 24, origin: 'phaser' });
                dispatch({ type: 'experiment.run', id: 'run-warm', timestamp: '2026-08-19T09:50:00.000Z' });
            }
            // Back to the steady window, then two orientations there.
            dispatch({ type: 'apparatus.controlSet', controlId: 'bathTempC', value: 20, origin: 'phaser' });
            dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-19T10:00:00.000Z' });
            dispatch({ type: 'apparatus.controlSet', controlId: 'rotationDeg', value: 90, origin: 'phaser' });
            dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-19T10:05:00.000Z' });

            dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
            pinned.forEach((runId) => dispatch({ type: 'theory.supportRunSelected', runId }));
            dispatch({ type: 'theory.supportSourceSelected', sourceId: 'michelson-morley-1887' });
            dispatch({ type: 'theory.supportSourceSelected', sourceId: 'morley-miller-1907-final-report' });
            return selectDefensibleConclusionProposalIds(store.getState());
        };

        // The taught route, warm detour included: the pinned pair was held at the window, so it defends.
        expect(walk(['run-1', 'run-2'], true)).toContain('conclude-bounded-null');
        // And without the detour at all, which must not have become a requirement.
        expect(walk(['run-1', 'run-2'], false)).toContain('conclude-bounded-null');
        // Pinning the warm reading against a cold one is the evidence the claim must not survive.
        expect(walk(['run-warm', 'run-2'], true)).not.toContain('conclude-bounded-null');
    });

    /**
     * **A finished second case survives a reload.** (Review 2026-08-19.)
     *
     * `validateCaseRecordForDefinition`'s completion walk required `modelInputs` of every completion run
     * and then called `calculateYoungFringeSpacing` on it unconditionally — so a *completed* prototype
     * record failed, `createAppStateFromCaseRecord` returned failure, and the whole saved investigation
     * was discarded on the next boot with "Your current work is unchanged". The pre-completion walk 90
     * lines earlier was already guarded, which is what made the two walks disagree about whether a second
     * case may finish at all.
     *
     * Driven to completion through the real reducers and validated through the real projection, because
     * the defect lives in the disagreement between two code paths and a hand-built record would only
     * exercise one.
     */
    it('restores a completed prototype investigation instead of discarding it', async () => {
        const definition = await loadPrototype();
        const record = playPrototypeToCompletion(definition);

        // The record carries a completion, and none of its runs carries Young's optical inputs.
        expect(record.completion).toBeDefined();
        expect(record.completion!.runs.every((run) => run.modelInputs === undefined)).toBe(true);

        expect(validateCaseRecordForDefinition(record, definition)).toMatchObject({ ok: true });
        // And the state actually rebuilds, which is the boot path the player meets.
        const reloaded = createStore(createInitialAppState(definition, 'en'));
        expect(reloaded.replaceWithValidatedRecord(record)).toEqual({ ok: true, value: undefined });
    });

    /**
     * The campaign-routing probe, against records this case can actually produce (code review of 4.1).
     *
     * These live here rather than in `CampaignOrder.test.ts` because they need a *genuinely* completed
     * prototype record, and the walk that produces one is in this file. `CampaignOrder.test.ts` owns the
     * order and the pure predicates; this owns what the prototype's own records do to the routing.
     *
     * **The gap these close.** The story's probe was `loaded.ok && loaded.value?.completion !== undefined`,
     * and the only fixture testing it seeded an unparseable object and an absent record — so both halves
     * failed at `loaded.ok` and mutating the guard to "a record exists" left the suite green. The
     * regression that hides behind that: a player mid-investigation counted as finished and routed past
     * the case. And `CaseRecordRepository.load` applies no definition-version check, so a record
     * completed at 1.3.0 loaded cleanly and routed the player to Young past an investigation the app
     * would then refuse.
     *
     * **Named changes that break these:** loosening the probe's `completion !== undefined` test to
     * `loaded.value !== undefined` breaks the first; dropping its `recordNamesRetiredArtifact` conjunct
     * breaks the second.
     */
    it('does not count an in-progress prototype record as a campaign completion', async () => {
        const definition = await loadPrototype();
        const store = createStore(createInitialAppState(definition, 'en'));
        store.dispatch({ type: 'source.inspected', sourceId: 'michelson-morley-1887' });
        const projected = createCaseRecordProjection(store.getState());
        expect(projected.ok).toBe(true);
        if (!projected.ok) return;
        // A readable, schema-valid record that simply has not finished — the fixture the story lacked.
        expect(projected.value.completion).toBeUndefined();

        expect(await readCompletedCampaignCaseIds(repositoryReturning({ [MORLEY_MILLER_CASE_ID]: projected.value })))
            .toEqual([]);
    });

    it('counts a completed prototype record, unless it still names the retired artifact', async () => {
        const definition = await loadPrototype();
        const record = playPrototypeToCompletion(definition);

        expect(await readCompletedCampaignCaseIds(repositoryReturning({ [MORLEY_MILLER_CASE_ID]: record })))
            .toEqual([MORLEY_MILLER_CASE_ID]);

        // The same completed investigation, saved before the re-anchor. `validateCaseRecordForDefinition`
        // refuses it, so counting it would route the player to Young past a case they cannot reopen.
        const namesRetired = {
            ...record,
            caseDefinitionVersion: '1.3.0',
            inspectedSourceIds: [...record.inspectedSourceIds, 'morley-miller-1905-reconstruction']
        };
        expect(validateCaseRecordForDefinition(namesRetired, definition)).toMatchObject({ ok: false });
        expect(await readCompletedCampaignCaseIds(repositoryReturning({ [MORLEY_MILLER_CASE_ID]: namesRetired })))
            .toEqual([]);
    });

    /**
     * The 1.4.0 record-compatibility decision, both directions (Story 4.1 AC9, as corrected by its
     * code review).
     *
     * Every bump on this case before 1.4.0 was additive and its allowlist listed the prior versions.
     * 1.4.0 is the first that moves an id a saved record *holds* — the retired
     * `morley-miller-1905-reconstruction` — so the clause is conditional on the record rather than on
     * the version alone. The story shipped it as a flat exclusion, and the review found the cost: a
     * record autosaved in the `context` phase names no retired id, satisfies every check below the
     * version gate, and was refused and then overwritten by `attachAutosave` anyway.
     *
     * Both tests are needed and neither implies the other. Without the first, the flat exclusion looks
     * correct; without the second, listing the versions unconditionally looks correct.
     *
     * **Named change that breaks the first:** dropping `&& !recordNamesRetiredArtifact(record)`'s clause
     * entirely, back to no 1.4.0 branch. **Named change that breaks the second:** dropping the
     * `!recordNamesRetiredArtifact(record)` conjunct, so the allowlist accepts a record naming content
     * that no longer exists.
     */
    it('restores a context-phase record saved before the artifact was re-anchored, which names no retired content', async () => {
        const definition = await loadPrototype();
        // The shipped version, pinned so a bump cannot land without a reader of this file meeting the
        // allowlist clause it needs. That is the whole reason the literal is here rather than read from the
        // definition — Story 3.4's severest finding was a bump shipped without its clause, and this row is
        // what makes the two one action. 1.5.0 was Story 4.2's; 1.6.0 is its code review's, which moved one
        // character of French display copy (U+0020 → U+202F before `°C` in `resetPath.description`) and
        // added the matching allowlist clause in the same change. This row is what made that a single action
        // rather than two, exactly as intended.
        expect(definition.version).toBe('1.6.0');
        const store = createStore(createInitialAppState(definition, 'en'));
        store.dispatch({ type: 'source.inspected', sourceId: 'michelson-morley-1887' });
        const projected = createCaseRecordProjection(store.getState());
        expect(projected.ok).toBe(true);
        if (!projected.ok) return;
        // The shape the whole decision turns on: still in `context`, so the readiness gate that would
        // have forced both artifact ids into the record has not fired.
        expect(projected.value.phase).toBe('context');
        expect(projected.value.inspectedSourceIds).toEqual(['michelson-morley-1887']);

        // Every prior version this case has shipped, including 1.4.0 — which the 1.5.0 clause accepts for
        // the same reason 1.4.0 accepted its own predecessors, and which would be the version a returning
        // player's autosave actually holds.
        (['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0'] as const).forEach((caseDefinitionVersion) => {
            const stale = { ...projected.value, caseDefinitionVersion };
            expect(validateCaseRecordForDefinition(stale, definition)).toMatchObject({ ok: true });
        });

        expect(validateCaseRecordForDefinition(projected.value, definition)).toMatchObject({ ok: true });
    });

    it('refuses a record that still names the retired artifact, as incompatible rather than invalid', async () => {
        const definition = await loadPrototype();
        const store = createStore(createInitialAppState(definition, 'en'));
        store.dispatch({ type: 'source.inspected', sourceId: 'michelson-morley-1887' });
        const projected = createCaseRecordProjection(store.getState());
        expect(projected.ok).toBe(true);
        if (!projected.ok) return;

        // Built by hand rather than dispatched: the store refuses an unknown `sourceId` outright, which
        // is why no projection can produce this record and why it has to be constructed to be tested.
        const namesRetired = {
            ...projected.value,
            inspectedSourceIds: ['michelson-morley-1887', 'morley-miller-1905-reconstruction']
        };

        (['1.0.0', '1.1.0', '1.2.0', '1.3.0'] as const).forEach((caseDefinitionVersion) => {
            expect(validateCaseRecordForDefinition({ ...namesRetired, caseDefinitionVersion }, definition)).toMatchObject({
                ok: false,
                error: { code: 'incompatible-case-record' }
            });
        });

        // At the *current* version the version gate passes and the artifact cross-check is what refuses
        // it — `invalid-case-record`, and the distinction between the two codes is the point of both.
        expect(validateCaseRecordForDefinition(namesRetired, definition)).toMatchObject({
            ok: false,
            error: { code: 'invalid-case-record' }
        });
    });
});

/**
 * The review route, and the guarantees it has to keep (AC4) — now beside the campaign default.
 *
 * Still a reviewer-facing entry point and still not a picker: there is no menu and no selection UI.
 * What changed in Story 4.1 is that the *default* is no longer Young but the campaign entry, and
 * `?case=` outranks it, because a reviewer opening a case is not a player progressing through one.
 */
describe('the review route', () => {
    it('opens the campaign entry when no case is named, not Young', () => {
        // The assertion that would have passed before Story 4.1 and must now fail: `/` meant Young.
        expect(resolveCaseId(new URLSearchParams(''))).toBe(MORLEY_MILLER_CASE_ID);
        expect(resolveCaseId(new URLSearchParams(''))).toBe(CAMPAIGN_ORDER[0]);
    });

    /**
     * The moderated route keeps opening Young, and this is not a Young-shaped assumption left standing:
     * `docs/validation/young-validation-plan.md` names `?mode=validation` as the entry route for
     * validating *the Young laboratory*, so a facilitator's existing link must keep opening Young after
     * the campaign default flips. A facilitator wanting the other case says `&case=morley-miller`.
     */
    it('keeps the moderated validation route on Young', () => {
        expect(resolveCaseId(new URLSearchParams('mode=validation'))).toBe(YOUNG_CASE_ID);
        expect(resolveCaseId(new URLSearchParams('mode=validation'), [MORLEY_MILLER_CASE_ID])).toBe(YOUNG_CASE_ID);
        expect(resolveCaseId(new URLSearchParams(`mode=validation&case=${MORLEY_MILLER_CASE_ID}`))).toBe(MORLEY_MILLER_CASE_ID);
    });

    /** The campaign entry advances with the player, which is the whole point of reading the order. */
    it('advances the default to the next uncompleted campaign case', () => {
        expect(resolveCaseId(new URLSearchParams(''), [MORLEY_MILLER_CASE_ID])).toBe(YOUNG_CASE_ID);
        // Every case completed: the last one, not a boot failure and not a phase nothing authors.
        expect(resolveCaseId(new URLSearchParams(''), [...CAMPAIGN_ORDER])).toBe(YOUNG_CASE_ID);
    });

    it('opens an allowlisted case', () => {
        KNOWN_CASE_IDS.forEach((caseId) => {
            expect(resolveCaseId(new URLSearchParams(`case=${caseId}`))).toBe(caseId);
        });
        expect(resolveCaseId(new URLSearchParams(`case=${MORLEY_MILLER_CASE_ID}`))).toBe(MORLEY_MILLER_CASE_ID);
    });

    /**
     * Never `loadCaseDefinition(<reviewer text>)`: that call composes a `contentPath`, so an unlisted
     * value would be a fetch built from a query string. It falls back rather than failing, because a
     * mistyped review link should open the game.
     */
    it('falls back to the default rather than passing reviewer-supplied text through', () => {
        ['unknown-case', '../young-interference', 'https://elsewhere.example/case', '', 'Young-Interference']
            .forEach((requested) => {
                expect(resolveCaseId(new URLSearchParams([['case', requested]]))).toBe(CAMPAIGN_ORDER[0]);
            });
    });

    it('names every case that ships a directory under public/cases', async () => {
        const directories = (await readdir('public/cases', { withFileTypes: true }))
            .filter((entry) => entry.isDirectory())
            .map(({ name }) => name)
            .sort();

        expect(directories).toEqual([...KNOWN_CASE_IDS].sort());
    });
});

/**
 * The bench-match and model-version checks, hoisted out of the `modelInputs` branch (AC3).
 *
 * Inside it they applied only to runs carrying `YoungModelInputs`, so a case recording none — which is
 * every case but Young — was validated strictly *less* than Young was: a caller-supplied record could
 * claim a bench setting the bench was never at, and no rule saw it.
 */
describe('what reduceRecordRun now checks for every run', () => {
    const atExperiment = async (): Promise<AppState> => {
        const definition = await loadPrototype();
        const state = createInitialAppState(definition, 'en');
        const advanced = [
            { type: 'source.inspected', sourceId: 'michelson-morley-1887' },
            { type: 'source.inspected', sourceId: 'morley-miller-1907-final-report' },
            { type: 'case.phaseAdvance', nextPhase: 'prediction' },
            { type: 'prediction.proposalChosen', proposalId: 'predict-small-shift' },
            { type: 'case.phaseAdvance', nextPhase: 'experiment' }
        ] as const;
        return advanced.reduce((current, action) => {
            const next = reduceAppState(current, action);
            if (!next.ok) throw new Error(`Refused ${action.type}: ${next.error.code}`);
            return next.value;
        }, state);
    };

    it('refuses a run that claims a bench setting the bench was never at', async () => {
        const state = await atExperiment();

        expect(reduceAppState(state, {
            type: 'run.record',
            record: {
                id: 'run-1',
                caseId: 'morley-miller',
                // The bench stands at rotationDeg 0; this record says 90.
                controls: { rotationDeg: 90, bathTempC: 22 },
                result: { label: 'Fringe displacement', value: 0.09, unit: 'fringe widths' },
                timestamp: '2026-08-19T10:00:00.000Z',
                experimentModelVersion: 'morley-miller-interferometer-v1',
                linkedEvidenceIds: []
            }
        })).toMatchObject({ ok: false, error: { code: 'mismatched-experiment-record' } });
    });

    it('refuses a run stamped with a model version this case does not run', async () => {
        const state = await atExperiment();

        expect(reduceAppState(state, {
            type: 'run.record',
            record: {
                id: 'run-1',
                caseId: 'morley-miller',
                controls: { rotationDeg: 0, bathTempC: 22 },
                result: { label: 'Fringe displacement', value: 0.11, unit: 'fringe widths' },
                timestamp: '2026-08-19T10:00:00.000Z',
                experimentModelVersion: 'young-double-slit-v1',
                linkedEvidenceIds: []
            }
        })).toMatchObject({ ok: false, error: { code: 'mismatched-experiment-record' } });
    });

    it('accepts a run that matches both', async () => {
        const state = await atExperiment();

        const result = reduceAppState(state, {
            type: 'run.record',
            record: {
                id: 'run-1',
                caseId: 'morley-miller',
                controls: { rotationDeg: 0, bathTempC: 22 },
                result: { label: 'Fringe displacement', value: 0.11, unit: 'fringe widths' },
                timestamp: '2026-08-19T10:00:00.000Z',
                experimentModelVersion: 'morley-miller-interferometer-v1',
                linkedEvidenceIds: []
            }
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.value.runs).toHaveLength(1);
    });
});
