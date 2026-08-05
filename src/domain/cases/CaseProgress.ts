import type { CaseDefinition } from './CaseDefinition';

/** The authoritative case phases, in adventure order. The scenario script must cover every one. */
export const CASE_PHASES = ['context', 'prediction', 'experiment', 'synthesis', 'review', 'debrief'] as const;

export type CasePhase = typeof CASE_PHASES[number];

export type CaseProgress = Readonly<{
    definition: CaseDefinition;
    phase: CasePhase;
}>;

export const createInitialCaseProgress = (definition: CaseDefinition): CaseProgress => ({
    definition,
    phase: 'context'
});
