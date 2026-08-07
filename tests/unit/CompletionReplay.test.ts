import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectCompletionSnapshot } from '../../src/core/store/selectors';
import { createCaseRecordProjection } from '../../src/core/store/CaseRecordProjection';
import { validateCaseRecordForDefinition } from '../../src/schemas/CaseRecordSchema';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { calculateYoungFringeSpacing } from '../../src/domain/apparatus/calculateYoungFringeSpacing';

const definition = {
    id: 'young-interference', version: '1.2.0', prediction: { required: true }, requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [],
    apparatus: { primaryControls: [{ id: 'slitSpacingMm', label: { en: 'Spacing', fr: 'Spacing [fr]' }, unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 }, { id: 'screenDistanceM', label: { en: 'Distance', fr: 'Distance [fr]' }, unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }] },
    contextualArtifacts: [{ id: 'source-1', displayName: { en: 'Source one', fr: 'Source one [fr]' }, creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Evidence. [fr]' } }, { id: 'source-2', displayName: { en: 'Source two', fr: 'Source two [fr]' }, creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Evidence. [fr]' } }],
    consultationRules: [], peerReviewRules: [{ id: 'overreach', predicate: { kind: 'overreach', overreachPhrases: { en: ['proves'], fr: ['prouve'] } }, feedback: { en: 'Bound the claim.', fr: 'Bound the claim. [fr]' }, revisionPath: { en: 'Revise.', fr: 'Revise. [fr]' } }],
    experiment: { modelVersion: 'young-double-slit-v1', wavelengthComparison: { fixedMinimumPathNm: 550, advancedChoicesNm: [450, 650] } }
} as CaseDefinition;

const completeToReview = (withComparison = true, store = createStore(createInitialAppState(definition))) => {
    ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.recorded', prediction: 'A patterned result may appear.' });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-05T12:00:00.000Z' });
    store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'dom' });
    store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-05T12:01:00.000Z' });
    ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'comparison.runSelected', runId }));
    if (withComparison) store.dispatch({ type: 'comparison.noteSaved', note: 'The spacing changes with the screen distance.' });
    ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
    ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId }));
    store.dispatch({ type: 'theory.conclusionSet', conclusion: 'The two recorded patterns support an interference inference.' });
    store.dispatch({ type: 'theory.limitationSet', limitation: 'The observations do not settle every account of light.' });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
    if (!withComparison) return store;
    expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });
    expect(store.dispatch({ type: 'peerReview.requested' })).toEqual({ ok: true, value: undefined });
    expect(store.dispatch({ type: 'revision.saved', timestamp: '2026-08-05T12:02:00.000Z' })).toEqual({ ok: true, value: undefined });
    return store;
};

describe('authoritative Young completion and replay', () => {
    it('does not allow generic phase advancement or review without the saved comparison evidence', () => {
        const incomplete = completeToReview(false);
        expect(incomplete.getState().phase).toBe('synthesis');
        expect(incomplete.dispatch({ type: 'theory.reviewRequested' })).toMatchObject({ ok: false, error: { code: 'conclusion-not-ready' } });

        const reviewed = completeToReview();
        expect(reviewed.dispatch({ type: 'case.phaseAdvance', nextPhase: 'debrief' })).toMatchObject({ ok: false, error: { code: 'debrief-completion-required' } });
        // Two distinct codes since Story 2.11 (AC6): a stamp *earlier than the reviewed revision* is
        // reachable in normal play — a progress import from another device, or a backwards clock
        // correction between `revision.saved` and the advance click — and its remedy is the device
        // clock. A malformed stamp keeps the message that describes a malformed stamp.
        expect(reviewed.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-05T12:01:59.000Z' })).toMatchObject({ ok: false, error: { code: 'completion-timestamp-not-later' } });
        expect(reviewed.dispatch({ type: 'case.debriefCompleted', timestamp: 'not-a-timestamp' })).toMatchObject({ ok: false, error: { code: 'invalid-completion-timestamp' } });
    });

    it('requires a saved comparison and reviewed revision before freezing debrief completion', () => {
        const store = completeToReview();
        expect(store.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-05T12:03:00.000Z' })).toEqual({ ok: true, value: undefined });
        expect(store.getState().phase).toBe('debrief');
        expect(selectCompletionSnapshot(store.getState())).toMatchObject({
            completedAt: '2026-08-05T12:03:00.000Z',
            finalDecision: { selectedRunIds: ['run-1', 'run-2'] }
        });
        expect(Object.isFrozen(selectCompletionSnapshot(store.getState()))).toBe(true);
        expect(Object.isFrozen(selectCompletionSnapshot(store.getState())?.runs[0]?.controls)).toBe(true);
    });

    it('starts a labelled counterfactual workspace without mutating the historical completion', () => {
        const store = completeToReview();
        store.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-05T12:03:00.000Z' });
        const completed = selectCompletionSnapshot(store.getState());
        expect(store.dispatch({ type: 'case.replayStarted' })).toEqual({ ok: true, value: undefined });
        expect(store.getState()).toMatchObject({ phase: 'context', replay: { isCounterfactual: true }, runs: [], decisionHistory: [] });
        expect(selectCompletionSnapshot(store.getState())).toEqual(completed);
    });

    // A replay clears case progress. The interface language describes the device, not progress.
    it('preserves the active locale across a counterfactual replay', () => {
        const store = createStore(createInitialAppState(definition, 'fr'));
        completeToReview(true, store);
        store.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-05T12:03:00.000Z' });
        expect(store.dispatch({ type: 'case.replayStarted' })).toEqual({ ok: true, value: undefined });

        expect(store.getState().locale).toBe('fr');
    });

    // A record exported by a French player must not switch an English player's interface language.
    it('keeps the live session locale when a portable record is restored', () => {
        const store = completeToReview();
        store.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-05T12:03:00.000Z' });
        const projected = createCaseRecordProjection(store.getState());
        expect(projected.ok).toBe(true);
        if (!projected.ok) return;

        const english = createStore(createInitialAppState(definition, 'en'));
        expect(english.replaceWithValidatedRecord(projected.value)).toEqual({ ok: true, value: undefined });
        expect(english.getState().locale).toBe('en');
    });

    it('does not treat a legacy prepared observation as completion evidence', () => {
        const result = calculateYoungFringeSpacing({ slitSpacingMm: 0.25, screenDistanceM: 2, wavelengthNm: 550 });
        expect(result.ok).toBe(true);
    });

    it('rejects a portable completion archive whose saved physical result was altered', () => {
        const store = completeToReview();
        store.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-05T12:03:00.000Z' });
        const projected = createCaseRecordProjection(store.getState());
        expect(projected.ok).toBe(true);
        if (!projected.ok || !projected.value.completion) return;
        const altered = {
            ...projected.value,
            completion: {
                ...projected.value.completion,
                runs: projected.value.completion.runs.map((run, index) => index === 0 ? { ...run, result: { ...run.result, value: run.result.value + 1 } } : run)
            }
        };
        expect(validateCaseRecordForDefinition(altered, definition)).toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });
    });
});
