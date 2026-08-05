import { isSourceEligibleForInspection, type CaseDefinition } from '../cases/CaseDefinition';
import type { RunRecord } from '../evidence/RunRecord';
import type { PeerReviewProjection } from '../review/peerReviewRules';

export const RECOGNITION_IDS = ['source-discipline', 'replication', 'variable-curiosity', 'calibrated-conclusion'] as const;
export type RecognitionId = typeof RECOGNITION_IDS[number];

export type RecognitionItem = Readonly<{
    id: RecognitionId;
    label: string;
    description: string;
    achieved: boolean;
}>;

export type RecognitionState = Readonly<{
    version: 1;
    items: readonly RecognitionItem[];
}>;

export type RecognitionProgress = Readonly<{
    inspectedSourceIds: readonly string[];
    runs: readonly RunRecord[];
    decisionHistory: readonly Readonly<{ feedback: PeerReviewProjection }>[];
}>;

const definitions: Readonly<Record<RecognitionId, Omit<RecognitionItem, 'achieved'>>> = Object.freeze({
    'source-discipline': Object.freeze({
        id: 'source-discipline', label: 'Source discipline recorded',
        description: 'Each reviewed contextual source has been inspected as evidence.'
    }),
    replication: Object.freeze({
        id: 'replication', label: 'Replication recorded',
        description: 'Two observations use the same setup for comparison.'
    }),
    'variable-curiosity': Object.freeze({
        id: 'variable-curiosity', label: 'Variable curiosity recorded',
        description: 'Two observations use different authored control settings for comparison.'
    }),
    'calibrated-conclusion': Object.freeze({
        id: 'calibrated-conclusion', label: 'Calibrated conclusion recorded',
        description: 'A reviewed revision makes a bounded claim without an overreach finding.'
    })
});

export const recognitionDefinitions = (): readonly Omit<RecognitionItem, 'achieved'>[] => RECOGNITION_IDS.map((id) => definitions[id]);

const sameControls = (left: RunRecord, right: RunRecord, definition: CaseDefinition): boolean =>
    definition.apparatus.primaryControls.every((control) => left.controls[control.id] === right.controls[control.id]);

const hasIdenticalControls = (runs: readonly RunRecord[], definition: CaseDefinition): boolean =>
    runs.some((run, index) => runs.slice(index + 1).some((other) => sameControls(run, other, definition)));

const hasDifferentControls = (runs: readonly RunRecord[], definition: CaseDefinition): boolean =>
    runs.some((run, index) => runs.slice(index + 1).some((other) => !sameControls(run, other, definition)));

/**
 * Deterministic, non-gating inquiry recognition derived only from immutable
 * investigation evidence and reviewed revision snapshots.
 */
export const deriveRecognition = (definition: CaseDefinition, progress: RecognitionProgress): RecognitionState => {
    const reviewedSourceIds = (definition.contextualArtifacts ?? [])
        .filter(isSourceEligibleForInspection)
        .map(({ id }) => id);
    const inspected = new Set(progress.inspectedSourceIds);
    const achieved: Readonly<Record<RecognitionId, boolean>> = {
        'source-discipline': reviewedSourceIds.length > 0 && reviewedSourceIds.every((id) => inspected.has(id)),
        replication: hasIdenticalControls(progress.runs, definition),
        'variable-curiosity': hasDifferentControls(progress.runs, definition),
        'calibrated-conclusion': progress.decisionHistory.some(({ feedback }) =>
            feedback.status === 'reviewed' && feedback.issues.length === 0)
    };

    return Object.freeze({
        version: 1,
        items: Object.freeze(RECOGNITION_IDS.map((id) => Object.freeze({ ...definitions[id], achieved: achieved[id] })))
    });
};
