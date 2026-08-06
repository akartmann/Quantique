import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import {
    selectCasePhase,
    selectLocalizedColleagueHint,
    selectLocalizedError,
    selectNotebookObservations,
    selectRecognition,
    selectSignificantMeasureCount,
    selectSignificantMeasureGate,
    selectTheoryBoardDraft
} from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The significant-measure gate, through **public store actions and selectors only** — no Phaser, no
 * renderer, no internal store shape. AC3 asks for exactly that, and it is also what keeps these
 * assertions alive through a presentation rewrite.
 *
 * Driven against the authored Young case rather than a fixture, so the rule, the hints, and the
 * requirement count all have to agree with each other in the content that ships.
 */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

/** A store standing in the laboratory, having recorded nothing yet. */
const storeInLaboratory = (locale: 'en' | 'fr' = 'en'): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    return store;
};

const advance = (store: AppStore) => store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });

describe('the significant-measure gate (AC1)', () => {
    it('refuses the advance to synthesis with nothing recorded', () => {
        const store = storeInLaboratory();

        const result = advance(store);

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error.code).toBe('significant-measures-required');
        expect(selectCasePhase(store.getState())).toBe('experiment');
    });

    it('refuses the advance with a single recorded observation', () => {
        const store = storeInLaboratory();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });

        expect(advance(store).ok).toBe(false);
        expect(selectSignificantMeasureCount(store.getState())).toBe(1);
    });

    it('still refuses after a second observation at the same configuration — a replication is not a variation', () => {
        const store = storeInLaboratory();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
        store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-06T12:01:00.000Z' });

        expect(selectNotebookObservations(store.getState())).toHaveLength(2);
        expect(selectSignificantMeasureCount(store.getState())).toBe(1);
        expect(advance(store).ok).toBe(false);
        expect(selectCasePhase(store.getState())).toBe('experiment');
    });

    it('opens once a second observation varies a critical control', () => {
        const store = storeInLaboratory();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'phaser' });
        store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-06T12:01:00.000Z' });

        expect(selectSignificantMeasureCount(store.getState())).toBe(2);
        expect(advance(store).ok).toBe(true);
        expect(selectCasePhase(store.getState())).toBe('synthesis');
    });

    it('opens when the third observation changes only the wavelength, at one arrangement', () => {
        // The scenario the review found unreachable (2026-08-06). Two identical 550 nm runs unlock the
        // optional wavelength comparison; a third at the *same* slit separation and throw on a
        // different colour moves the fringe spacing by a wide margin, so calling it a repetition was
        // false — and the `repeated-configuration` hint then told the player they had written the same
        // arrangement down twice when they had just changed the light.
        //
        // Driven entirely through public actions, so it also proves the recorded `modelInputs` carry
        // the wavelength the rule reads.
        const store = storeInLaboratory();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
        store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-06T12:01:00.000Z' });

        // Two runs at one arrangement is still one measurement, and the gate still refuses.
        expect(selectSignificantMeasureCount(store.getState())).toBe(1);
        expect(advance(store).ok).toBe(false);

        const switched = store.dispatch({ type: 'apparatus.wavelengthSet', wavelengthNm: 450 });
        expect(switched.ok).toBe(true);
        store.dispatch({ type: 'experiment.run', id: 'run-3', timestamp: '2026-08-06T12:02:00.000Z' });

        expect(selectSignificantMeasureCount(store.getState())).toBe(2);
        expect(selectLocalizedColleagueHint(store.getState())).toBeUndefined();
        expect(advance(store).ok).toBe(true);
        expect(selectCasePhase(store.getState())).toBe('synthesis');
    });

    it('reports the gate as a count against the authored requirement, not a bare boolean', () => {
        const store = storeInLaboratory();
        expect(selectSignificantMeasureGate(store.getState())).toStrictEqual({ count: 0, required: 2, isMet: false });

        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.35, origin: 'phaser' });
        store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-06T12:01:00.000Z' });

        expect(selectSignificantMeasureGate(store.getState())).toStrictEqual({ count: 2, required: 2, isMet: true });
    });

    it('gates nothing else — every other phase transition keeps its own rules', () => {
        // The gate is on `experiment → synthesis` alone. A backwards or skipping transition must
        // still fail for its own reason, not this one.
        const store = storeInLaboratory();
        const skipped = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'review' });

        expect(skipped.ok).toBe(false);
        expect(skipped.ok === false && skipped.error.code).toBe('invalid-case-transition');
    });
});

describe('the colleague hint (AC2)', () => {
    it('offers an attributed hint when the gate refuses', () => {
        const store = storeInLaboratory();

        expect(advance(store).ok).toBe(false);
        const hint = selectLocalizedColleagueHint(store.getState());

        expect(hint).toBeDefined();
        expect(hint?.line.length).toBeGreaterThan(0);
        // Attributed to a named member of the cast, so it reads as a colleague speaking.
        expect(hint?.speaker.length).toBeGreaterThan(0);
        expect(definition.colleagues.some(({ name }) => hint?.speaker.includes(name))).toBe(true);
    });

    it('offers a hint in French for a French session', () => {
        const store = storeInLaboratory('fr');
        const french = selectLocalizedColleagueHint(store.getState());
        const english = selectLocalizedColleagueHint(storeInLaboratory('en').getState());

        expect(french?.hintId).toBe(english?.hintId);
        // The same hint, genuinely different prose — not an English string with a French label.
        expect(french?.line).not.toBe(english?.line);
        const authored = definition.colleagueHints.find(({ id }) => id === french?.hintId);
        expect(french?.line).toBe(authored?.line.fr);
        expect(english?.line).toBe(authored?.line.en);
    });

    it('escalates from "record something" to "vary something" as evidence accumulates', () => {
        const store = storeInLaboratory();
        const empty = selectLocalizedColleagueHint(store.getState());

        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
        const afterOne = selectLocalizedColleagueHint(store.getState());

        expect(empty?.hintId).toBe('hint-record-a-first-observation');
        expect(afterOne?.hintId).not.toBe(empty?.hintId);
        expect(afterOne).toBeDefined();
    });

    it('withdraws the hint once the gate is met', () => {
        const store = storeInLaboratory();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'phaser' });
        store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-06T12:01:00.000Z' });

        expect(selectLocalizedColleagueHint(store.getState())).toBeUndefined();
    });

    it('never supplies the conclusion', () => {
        const store = storeInLaboratory();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
        const hint = selectLocalizedColleagueHint(store.getState());

        // No defensibility field can reach a surface through this projection...
        expect(Object.keys(hint ?? {}).sort()).toStrictEqual(['hintId', 'line', 'speaker']);
        // ...and no authored claim is quoted inside the line.
        definition.conclusionProposals.forEach(({ claim }) => {
            expect(hint?.line).not.toContain(claim.en);
            expect(hint?.line).not.toContain(claim.fr);
        });
    });

    it('carries no punitive vocabulary in either locale', () => {
        // The `u` flag with explicit boundaries, not `\b`: `\b` is ASCII-defined, so `/\béchec\b/`
        // never matches inside "un échec" and half the French guard would be dead (2.5 review).
        const punitive = new RegExp(
            '(?:^|[^\\p{L}\\p{N}_])(?:score|timer|attempt|failed|failure|penalty|locked'
            + '|échec|échoué|pénalité|verrouillé|tentative)(?=$|[^\\p{L}\\p{N}_])',
            'iu'
        );
        expect(punitive.test('un échec complet')).toBe(true);

        (['en', 'fr'] as const).forEach((locale) => {
            const store = storeInLaboratory(locale);
            store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
            expect(punitive.test(selectLocalizedColleagueHint(store.getState())?.line ?? '')).toBe(false);
        });
    });

    it('resolves the refusal to localized copy rather than a raw error', () => {
        (['en', 'fr'] as const).forEach((locale) => {
            const store = storeInLaboratory(locale);
            const result = advance(store);
            if (result.ok) throw new Error('The gate must refuse with nothing recorded.');

            const message = selectLocalizedError(store.getState(), result.error);
            expect(message.length).toBeGreaterThan(0);
            expect(message).not.toBe(result.error.code);
        });
    });
});

describe('the refusal is not a fail state (AC2)', () => {
    it('changes nothing at all', () => {
        const store = storeInLaboratory();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
        const before = store.getState();

        expect(advance(store).ok).toBe(false);

        // The whole state, not a hand-picked subset: a gate that quietly cost the player anything
        // would have to show up here.
        expect(store.getState()).toStrictEqual(before);
    });

    it('leaves the notebook, the draft, and recognition untouched across repeated refusals', () => {
        const store = storeInLaboratory();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
        const runs = selectNotebookObservations(store.getState());
        const draft = selectTheoryBoardDraft(store.getState());
        const recognition = selectRecognition(store.getState());

        for (let attempt = 0; attempt < 5; attempt += 1) expect(advance(store).ok).toBe(false);

        expect(selectNotebookObservations(store.getState())).toStrictEqual(runs);
        expect(selectTheoryBoardDraft(store.getState())).toStrictEqual(draft);
        expect(selectRecognition(store.getState())).toStrictEqual(recognition);
    });

    it('blocks no other action, so the player is never stuck', () => {
        const store = storeInLaboratory();
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
        expect(advance(store).ok).toBe(false);

        // Every route out of the refusal still works: change a control, measure again, reset, consult.
        expect(store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'phaser' }).ok).toBe(true);
        expect(store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-06T12:01:00.000Z' }).ok).toBe(true);
        expect(store.dispatch({ type: 'consultation.requested' }).ok).toBe(true);
        expect(store.dispatch({ type: 'apparatus.reset' }).ok).toBe(true);

        // And the gate now opens, from inside the same session that was refused.
        expect(advance(store).ok).toBe(true);
    });

    it('imposes no cap on retries or on recorded observations', () => {
        const store = storeInLaboratory();
        for (let i = 0; i < 4; i += 1) {
            store.dispatch({ type: 'experiment.run', id: `run-${i}`, timestamp: `2026-08-06T12:0${i}:00.000Z` });
            expect(advance(store).ok).toBe(false);
        }
        expect(selectNotebookObservations(store.getState())).toHaveLength(4);
    });
});
