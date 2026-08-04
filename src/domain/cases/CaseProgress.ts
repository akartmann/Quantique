import type { CaseDefinition } from './CaseDefinition';

export type CasePhase = 'context' | 'prediction' | 'experiment' | 'synthesis' | 'review' | 'debrief';

export type CaseProgress = Readonly<{
    definition: CaseDefinition;
    phase: CasePhase;
}>;

export const createInitialCaseProgress = (definition: CaseDefinition): CaseProgress => ({
    definition,
    phase: 'context'
});
