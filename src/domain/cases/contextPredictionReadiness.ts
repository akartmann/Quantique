import { isSourceEligibleForInspection, type CaseDefinition } from './CaseDefinition';

export type ContextReadiness = Readonly<{
    status: 'ready' | 'incomplete';
    missingArtifactLabels: readonly string[];
}>;

export type PredictionReadiness = Readonly<{
    status: 'ready' | 'incomplete';
}>;

/** Evaluates the authored context requirements without depending on UI or store state. */
export const evaluateContextReadiness = (definition: CaseDefinition, inspectedSourceIds: readonly string[]): ContextReadiness => {
    const inspected = new Set(inspectedSourceIds);
    const missingArtifactLabels = definition.contextualArtifacts
        .filter((artifact) => !isSourceEligibleForInspection(artifact) || !inspected.has(artifact.id))
        .map(({ displayName }) => displayName);
    return Object.freeze({
        status: missingArtifactLabels.length ? 'incomplete' : 'ready',
        missingArtifactLabels: Object.freeze(missingArtifactLabels)
    });
};

/** A tentative prediction is meaningful only after whitespace is removed. */
export const evaluatePredictionReadiness = (definition: CaseDefinition, prediction: string): PredictionReadiness =>
    Object.freeze({ status: !definition.prediction?.required || prediction.trim().length > 0 ? 'ready' : 'incomplete' });
