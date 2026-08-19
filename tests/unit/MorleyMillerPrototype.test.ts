import { readdir, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { createInitialAppState, reduceAppState, type AppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectConclusionReadiness } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema, KNOWN_CASE_IDS, MORLEY_MILLER_CASE_ID, YOUNG_CASE_ID } from '../../src/schemas/CaseDefinitionSchema';
import { resolveCaseId } from '../../src/adapters/content/resolveCaseId';
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
            // Exactly one transcription of record, and it is the English one.
            expect(rendition!.renditions.filter(({ kind }) => kind === 'transcription').map(({ locale }) => locale)).toEqual(['en']);
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
            { type: 'source.inspected', sourceId: 'morley-miller-1907-reconstruction' },
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
        dispatch({ type: 'source.inspected', sourceId: 'morley-miller-1907-reconstruction' });
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
        dispatch({ type: 'theory.supportSourceSelected', sourceId: 'morley-miller-1907-reconstruction' });
        dispatch({ type: 'theory.conclusionProposalChosen', proposalId: 'conclude-bounded-null' });

        const readiness = selectConclusionReadiness(store.getState());
        expect(readiness.missing).toEqual([]);
        expect(readiness.status).toBe('ready');

        // And the review the readiness gate guards actually opens.
        dispatch({ type: 'case.phaseAdvance', nextPhase: 'review' });
        expect(store.getState().phase).toBe('review');
    });
});

/**
 * The review route, and the two guarantees it has to keep (AC4).
 *
 * A reviewer-facing entry point, not campaign selection: no picker, no menu, no unlock order — Story
 * 4.1 owns those, and FR2 puts Morley–Miller *before* Young, so a picker built here would pre-empt it.
 */
describe('the review route', () => {
    it('opens the default investigation when no case is named', () => {
        expect(resolveCaseId(new URLSearchParams(''))).toBe(YOUNG_CASE_ID);
        expect(resolveCaseId(new URLSearchParams('mode=validation'))).toBe(YOUNG_CASE_ID);
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
                expect(resolveCaseId(new URLSearchParams([['case', requested]]))).toBe(YOUNG_CASE_ID);
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
            { type: 'source.inspected', sourceId: 'morley-miller-1907-reconstruction' },
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
