import { isSourceEligibleForInspection, type CaseDefinition } from './CaseDefinition';

export type ContextReadiness = Readonly<{
    status: 'ready' | 'incomplete';
    /** Canonical English names, kept so no persisted or compared value depends on the active language. */
    missingArtifactLabels: readonly string[];
    /** The same artifacts by stable id, so the presentation can resolve localized names. */
    missingArtifactIds: readonly string[];
}>;

export type PredictionReadiness = Readonly<{
    status: 'ready' | 'incomplete';
}>;

/** Evaluates the authored context requirements without depending on UI or store state. */
export const evaluateContextReadiness = (definition: CaseDefinition, inspectedSourceIds: readonly string[]): ContextReadiness => {
    const inspected = new Set(inspectedSourceIds);
    const missing = definition.contextualArtifacts
        .filter((artifact) => !isSourceEligibleForInspection(artifact) || !inspected.has(artifact.id));
    // `.en` on purpose: the domain reads the canonical locale, never the active one.
    return Object.freeze({
        status: missing.length ? 'incomplete' : 'ready',
        missingArtifactLabels: Object.freeze(missing.map(({ displayName }) => displayName.en)),
        missingArtifactIds: Object.freeze(missing.map(({ id }) => id))
    });
};

/** A tentative prediction is meaningful only after whitespace is removed. */
export const evaluatePredictionReadiness = (definition: CaseDefinition, prediction: string): PredictionReadiness =>
    Object.freeze({ status: !definition.prediction?.required || prediction.trim().length > 0 ? 'ready' : 'incomplete' });
