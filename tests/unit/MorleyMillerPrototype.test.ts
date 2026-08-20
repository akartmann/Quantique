import { readdir, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { createInitialAppState, reduceAppState, type AppState } from '../../src/core/store/AppState';
import { createCaseRecordProjection } from '../../src/core/store/CaseRecordProjection';
import { validateCaseRecordForDefinition } from '../../src/schemas/CaseRecordSchema';
import { createStore } from '../../src/core/store/createStore';
import { selectConclusionReadiness, selectDefensibleConclusionProposalIds } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema, KNOWN_CASE_IDS, MORLEY_MILLER_CASE_ID, YOUNG_CASE_ID } from '../../src/schemas/CaseDefinitionSchema';
import { resolveCaseId } from '../../src/adapters/content/resolveCaseId';
import { CAMPAIGN_ORDER } from '../../src/domain/cases/campaignOrder';
import { EXPERIMENT_MODEL_IDS } from '../../src/domain/apparatus/experimentModels';

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
        expect(projected.ok).toBe(true);
        if (!projected.ok) return;
        // The record carries a completion, and none of its runs carries Young's optical inputs.
        expect(projected.value.completion).toBeDefined();
        expect(projected.value.completion!.runs.every((run) => run.modelInputs === undefined)).toBe(true);

        expect(validateCaseRecordForDefinition(projected.value, definition)).toMatchObject({ ok: true });
        // And the state actually rebuilds, which is the boot path the player meets.
        const reloaded = createStore(createInitialAppState(definition, 'en'));
        expect(reloaded.replaceWithValidatedRecord(projected.value)).toEqual({ ok: true, value: undefined });
    });

    /**
     * The 1.4.0 record-compatibility decision, asserted rather than left as an absence (Story 4.1, AC9).
     *
     * Every bump on this case before 1.4.0 was additive and its allowlist listed the prior versions.
     * 1.4.0 is the first that moves an id a saved record *holds* — the retired
     * `morley-miller-1905-reconstruction` — so it deliberately lists none, and the refusal a returning
     * player meets must be `incompatible-case-record` ("a different version of this investigation"),
     * not `invalid-case-record` ("could not be used").
     *
     * **Named change that breaks this:** adding `|| (isPrototype && definition.version === '1.4.0' && [...]
     * .includes(record.caseDefinitionVersion))` to `CaseRecordSchema` — the very edit 3.4's review
     * asked for at 1.3.0 and which is the wrong move here. Without this test that edit looks like
     * consistency with every clause above it.
     */
    it('refuses a record saved before the artifact was re-anchored, as incompatible rather than invalid', async () => {
        const definition = await loadPrototype();
        expect(definition.version).toBe('1.4.0');
        const store = createStore(createInitialAppState(definition, 'en'));
        store.dispatch({ type: 'source.inspected', sourceId: 'michelson-morley-1887' });
        const projected = createCaseRecordProjection(store.getState());
        expect(projected.ok).toBe(true);
        if (!projected.ok) return;

        (['1.0.0', '1.1.0', '1.2.0', '1.3.0'] as const).forEach((caseDefinitionVersion) => {
            const stale = { ...projected.value, caseDefinitionVersion };
            expect(validateCaseRecordForDefinition(stale, definition)).toMatchObject({
                ok: false,
                error: { code: 'incompatible-case-record' }
            });
        });

        // The exact version still restores, so the clause refuses old records without refusing all of them.
        expect(validateCaseRecordForDefinition(projected.value, definition)).toMatchObject({ ok: true });
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
