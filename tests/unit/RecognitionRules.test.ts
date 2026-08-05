import { describe, expect, it } from 'vitest';

import { deriveRecognition } from '../../src/domain/recognition/recognitionRules';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import type { RunRecord } from '../../src/domain/evidence/RunRecord';

const definition = {
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm' },
            { id: 'screenDistanceM' }
        ]
    },
    contextualArtifacts: [
        { id: 'reviewed-source', rightsStatus: 'reviewed' },
        { id: 'unreviewed-source', rightsStatus: 'incomplete' }
    ]
} as CaseDefinition;

const run = (id: string, screenDistanceM: number): RunRecord => ({
    id,
    caseId: 'young-interference',
    controls: { slitSpacingMm: 0.25, screenDistanceM },
    result: { label: 'Observation', value: 1, unit: 'relative units' },
    timestamp: '2026-08-05T10:00:00.000Z',
    experimentModelVersion: 'young-v1',
    linkedEvidenceIds: []
});

describe('inquiry recognition rules', () => {
    it('derives only the four authored, non-competitive inquiry behaviours from immutable evidence', () => {
        const recognition = deriveRecognition(definition, {
            inspectedSourceIds: ['reviewed-source'],
            runs: [run('run-1', 2), run('run-2', 2), run('run-3', 3)],
            decisionHistory: [{ feedback: { status: 'reviewed', issues: [] } }]
        });

        expect(recognition.items.map(({ id, achieved }) => [id, achieved])).toEqual([
            ['source-discipline', true],
            ['replication', true],
            ['variable-curiosity', true],
            ['calibrated-conclusion', true]
        ]);
        expect(Object.isFrozen(recognition)).toBe(true);
        expect(Object.isFrozen(recognition.items)).toBe(true);
    });

    it('does not infer recognition from ineligible sources, results, timestamps, or an overreaching review', () => {
        const recognition = deriveRecognition(definition, {
            inspectedSourceIds: ['unreviewed-source'],
            runs: [run('run-1', 2), { ...run('run-2', 2), result: { label: 'Different', value: 999, unit: 'arbitrary' } }],
            decisionHistory: [{ feedback: { status: 'reviewed', issues: [{ code: 'overreach' }] } }]
        });

        expect(recognition.items.map(({ id, achieved }) => [id, achieved])).toEqual([
            ['source-discipline', false],
            ['replication', true],
            ['variable-curiosity', false],
            ['calibrated-conclusion', false]
        ]);
    });

    it('is deterministic and idempotent for repeated snapshots', () => {
        const progress = { inspectedSourceIds: ['reviewed-source'], runs: [run('run-1', 2), run('run-2', 2)], decisionHistory: [] };
        expect(deriveRecognition(definition, progress)).toEqual(deriveRecognition(definition, progress));
    });
});
