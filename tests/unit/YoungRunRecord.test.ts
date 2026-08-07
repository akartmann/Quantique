import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import { calculateYoungFringeSpacing } from '../../src/domain/apparatus/calculateYoungFringeSpacing';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The recorded value is the model's, and nothing a surface draws can reach it (Story 2.10, AC10).
 *
 * Two assertions, deliberately of different kinds:
 *
 * 1. **Behavioural** — drive `experiment.run` through a real store built from the authored case and
 *    check the saved value against `calculateYoungFringeSpacing` for the same inputs. That is what
 *    makes it non-vacuous: it would fail if the reducer ever started rounding differently, and it
 *    reads the authored bounds rather than restating them.
 * 2. **Structural** — a source-level sweep asserting the two canvas surfaces that *show* a run never
 *    mention the calculator or dispatch `run.record`. No type signature can express that rule, and a
 *    comment is not an assertion. `CharacterStageView.test.ts` established the pattern for ADR-006 and
 *    this is the same shape for the deterministic-record rule.
 *
 * **Comments are stripped before the sweep.** The rule the sweep enforces is about code, and both
 * renderers' docstrings have to be able to *state* it — "there is no call to
 * `calculateYoungFringeSpacing` here and there must never be one" is exactly the prose a reader needs
 * and exactly what a naive `includes` would trip over. `CharacterStageView.test.ts` solved the same
 * problem by keeping the words out of its prose; stripping is the stronger version, because it cannot
 * be defeated by a comment nobody noticed.
 */

let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

const storeAtTheBench = (): AppStore => {
    const store = createStore(createInitialAppState(definition));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    return store;
};

describe('the recorded value is model-derived', () => {
    it('saves exactly what the deterministic model computes, at every authored screen distance', () => {
        const screen = definition.apparatus.primaryControls.find(({ id }) => id === 'screenDistanceM');
        if (!screen) throw new Error('The authored case must carry a screen-distance control.');

        const store = storeAtTheBench();
        const wrong: string[] = [];
        let recorded = 0;
        for (let distance = screen.min; distance <= screen.max + 1e-9; distance += screen.step) {
            const screenDistanceM = Number(distance.toFixed(4));
            store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: screenDistanceM, origin: 'phaser' });
            const state = store.getState();
            const transition = store.dispatch({
                type: 'experiment.run',
                id: `run-${screenDistanceM}`,
                timestamp: `2026-08-07T10:00:00.000Z`
            });
            if (!transition.ok) { wrong.push(`${screenDistanceM} m was refused: ${transition.error.code}`); continue; }
            recorded += 1;
            const expected = calculateYoungFringeSpacing({
                slitSpacingMm: state.activeControlValues.slitSpacingMm,
                screenDistanceM: state.activeControlValues.screenDistanceM,
                wavelengthNm: state.selectedWavelengthNm
            });
            const saved = store.getState().runs[store.getState().runs.length - 1]!;
            if (!expected.ok) { wrong.push(`${screenDistanceM} m has no model value`); continue; }
            if (saved.result.value !== expected.value.value
                || saved.result.unit !== expected.value.unit
                || saved.result.label !== expected.value.label) {
                wrong.push(`${screenDistanceM} m saved ${saved.result.value} ${saved.result.unit}, model says ${expected.value.value} ${expected.value.unit}`);
            }
        }

        expect(wrong).toEqual([]);
        // A guard on the sweep: zero recorded runs would make the assertion above vacuously true.
        expect(recorded).toBeGreaterThan(1);
    });

    it('preserves the model version each observation was recorded under, and never restates it', () => {
        const store = storeAtTheBench();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T10:00:00.000Z' });

        const saved = store.getState().runs[0]!;

        expect(saved.experimentModelVersion).toBe(definition.experiment.modelVersion);
        expect(saved.modelInputs).toMatchObject({
            wavelengthNm: definition.experiment.wavelengthComparison?.fixedMinimumPathNm ?? 550,
            wavelengthMode: 'minimum'
        });
    });

    /**
     * A run recorded through `experiment.run` alone is a complete record.
     *
     * This is the property that makes "dispatch `experiment.run` and nothing else" correct in
     * `PhaserStoreAdapter`: `reduceExperimentRun` hands its record to `reduceRecordRun` itself, so a
     * surface that also dispatched `run.record` would get `duplicate-run-id` — or, with a fresh id,
     * two observations for one press.
     */
    it('needs no second dispatch to reach the notebook', () => {
        const store = storeAtTheBench();

        expect(store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T10:00:00.000Z' }).ok).toBe(true);

        expect(store.getState().runs).toHaveLength(1);
        expect(store.dispatch({ type: 'run.record', record: store.getState().runs[0]! }).ok).toBe(false);
    });
});

/**
 * Comment-free source, so the sweep below reads code rather than prose.
 *
 * Block comments first, then line comments. Both renderers use hex colour literals and simple single
 * quoted strings, neither of which can contain a comment opener, so this is exact for these files —
 * and the guard beneath the sweep fails loudly if it ever stops being.
 */
const codeOf = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('no canvas surface can reach the calculator or record a run itself', () => {
    /**
     * Every term whose presence in a *drawing* surface would mean the picture had become the source
     * of the number.
     *
     * `run.record` is here because `experiment.run` already records: a second dispatch is either a
     * duplicate-id refusal or two observations for one press, and both are worse than the omission.
     */
    const FORBIDDEN = [
        'calculateYoungFringeSpacing',
        'run.record',
        'YoungFringeSpacing'
    ] as const;

    const SURFACES = [
        'src/adapters/phaser/renderers/ApparatusRenderer.ts',
        'src/adapters/phaser/renderers/NotebookRenderer.ts',
        'src/adapters/phaser/renderers/ApparatusInstrument.ts',
        'src/adapters/phaser/renderers/WavelengthChooser.ts'
    ] as const;

    it.each(SURFACES)('%s computes no recorded value of its own', (path) => {
        const code = codeOf(path);

        // Guards on the guard: an unreadable file, or a stripper that ate the whole file, would make
        // the sweep vacuous — which is how a source-level assertion starts passing because the thing
        // it protects moved out from under it.
        expect(code.length).toBeGreaterThan(400);
        expect(code).toContain('export class');
        expect(FORBIDDEN.filter((term) => code.includes(term))).toEqual([]);
    });

    /**
     * The notebook is held to the stricter rule: it may not touch the *visual* model either.
     *
     * `ApparatusRenderer` legitimately samples `interferenceIntensity` to paint the fringes — that
     * module's own header states it never alters a recorded result — but a notebook has nothing to
     * draw from it, and a number arriving there from a visual model would be a recalculated
     * observation wearing a saved one's clothes.
     */
    it('keeps the visual optical model out of the notebook entirely', () => {
        const code = codeOf('src/adapters/phaser/renderers/NotebookRenderer.ts');

        expect(code).toContain('export class NotebookRenderer');
        expect(['interferenceIntensity', 'opticalVisualModel', 'wavelengthToRgb'].filter((term) => code.includes(term))).toEqual([]);
    });

    it('strips comments without eating the code the sweep has to read', () => {
        // The stripper is the load-bearing half of this file: a broken one would silently make every
        // assertion above pass. This pins that it removes prose and keeps statements.
        const stripped = codeOf('src/adapters/phaser/renderers/NotebookRenderer.ts');

        expect(stripped).toContain('saveComparisonNote');
        expect(stripped).toContain('selectNotebookObservations');
        // A phrase that appears only inside the class docstring, and must not survive stripping.
        expect(stripped).not.toContain('An overlay the player opens');
    });
});
