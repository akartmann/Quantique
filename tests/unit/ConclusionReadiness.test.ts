import { describe, expect, it } from 'vitest';

import {
    createTheoryBoardDraft,
    evaluateConclusionReadiness
} from '../../src/domain/theory/conclusionReadiness';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createRunRecord } from '../../src/domain/evidence/RunRecord';

const definition = { requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [] } as CaseDefinition;

const createRun = (id: string) => {
    const result = createRunRecord({
        id,
        caseId: 'young-interference',
        controls: { slitSpacingMm: 0.25, screenDistanceM: 2 },
        result: { label: 'Observation', value: 1, unit: 'relative units' },
        timestamp: '2026-08-04T12:00:00.000Z',
        experimentModelVersion: 'young-observation-v1'
    });
    if (!result.ok) throw new Error('Fixture run must be valid.');
    return result.value;
};

const evidence = { runs: [createRun('run-1'), createRun('run-2')], inspectedSourceIds: ['source-1', 'source-2'] };

describe('conclusion readiness', () => {
    it.each([
        ['runs', { selectedRunIds: [], selectedSourceIds: ['source-1', 'source-2'], limitation: 'Measurement uncertainty.' }, ['minimum-runs']],
        ['sources', { selectedRunIds: ['run-1', 'run-2'], selectedSourceIds: [], limitation: 'Measurement uncertainty.' }, ['minimum-sources']],
        ['limitation', { selectedRunIds: ['run-1', 'run-2'], selectedSourceIds: ['source-1', 'source-2'], limitation: '  ' }, ['limitation']],
        ['runs and sources', { selectedRunIds: [], selectedSourceIds: [], limitation: 'Measurement uncertainty.' }, ['minimum-runs', 'minimum-sources']],
        ['runs and limitation', { selectedRunIds: [], selectedSourceIds: ['source-1', 'source-2'], limitation: '  ' }, ['minimum-runs', 'limitation']],
        ['sources and limitation', { selectedRunIds: ['run-1', 'run-2'], selectedSourceIds: [], limitation: '  ' }, ['minimum-sources', 'limitation']],
        ['all prerequisites', { selectedRunIds: [], selectedSourceIds: [], limitation: '' }, ['minimum-runs', 'minimum-sources', 'limitation']]
    ])('reports %s as explicit recoverable missing evidence', (_name, partialDraft, expectedCodes) => {
        const readiness = evaluateConclusionReadiness(definition, evidence, {
            ...createTheoryBoardDraft(),
            conclusion: 'A bounded conclusion.',
            ...partialDraft
        });

        expect(readiness.status).toBe('incomplete');
        expect(readiness.missing.map(({ code }) => code)).toEqual(expectedCodes);
    });

    it('is ready only with current selected evidence, a non-blank conclusion, and a non-blank limitation', () => {
        const readiness = evaluateConclusionReadiness(definition, evidence, {
            selectedRunIds: ['run-1', 'run-2'],
            selectedSourceIds: ['source-1', 'source-2'],
            conclusion: 'The observations are consistent with the prediction.',
            limitation: 'The prepared observations are not a full uncertainty analysis.'
        });

        expect(readiness).toMatchObject({ status: 'ready', missing: [] });
        expect(Object.isFrozen(readiness)).toBe(true);
        expect(Object.isFrozen(readiness.missing)).toBe(true);
    });

    it('does not allow a blank conclusion to enter review', () => {
        const readiness = evaluateConclusionReadiness(definition, evidence, {
            selectedRunIds: ['run-1', 'run-2'],
            selectedSourceIds: ['source-1', 'source-2'],
            conclusion: ' ',
            limitation: 'A limitation.'
        });

        expect(readiness.missing.map(({ code }) => code)).toEqual(['conclusion']);
    });

    it('reports unknown and duplicate support deterministically without mutating evidence or draft', () => {
        const draft = {
            selectedRunIds: ['run-1', 'run-1', 'unknown-run'],
            selectedSourceIds: ['source-1', 'source-1', 'unknown-source'],
            conclusion: 'A draft is retained.',
            limitation: 'A limitation.'
        };
        const before = structuredClone({ evidence, draft });

        const readiness = evaluateConclusionReadiness(definition, evidence, draft);

        expect(readiness.missing.map(({ code }) => code)).toEqual([
            'duplicate-run-selection', 'unknown-run-selection', 'minimum-runs',
            'duplicate-source-selection', 'unknown-source-selection', 'minimum-sources'
        ]);
        expect({ evidence, draft }).toEqual(before);
    });

    it('re-evaluates selection, conclusion, and limitation changes deterministically', () => {
        const incomplete = evaluateConclusionReadiness(definition, evidence, createTheoryBoardDraft());
        const validDraft = {
            selectedRunIds: ['run-1', 'run-2'], selectedSourceIds: ['source-1', 'source-2'], conclusion: 'A bounded conclusion.', limitation: 'A limitation.'
        };
        const revisedConclusion = { ...validDraft, conclusion: 'A bounded conclusion based on current evidence.' };

        expect(evaluateConclusionReadiness(definition, evidence, validDraft)).toEqual(
            evaluateConclusionReadiness(definition, evidence, validDraft)
        );
        expect(incomplete.status).toBe('incomplete');
        expect(evaluateConclusionReadiness(definition, evidence, validDraft).status).toBe('ready');
        expect(evaluateConclusionReadiness(definition, evidence, revisedConclusion)).toEqual(
            evaluateConclusionReadiness(definition, evidence, validDraft)
        );
    });
});
