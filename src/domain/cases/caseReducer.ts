import type { Result } from '../../core/errors/Result';
import type { CasePhase, CaseProgress } from './CaseProgress';

const NEXT_CASE_PHASE: Readonly<Record<CasePhase, CasePhase | undefined>> = {
    context: 'prediction',
    prediction: 'experiment',
    experiment: 'synthesis',
    synthesis: 'review',
    review: 'debrief',
    debrief: undefined
};

export const advanceCasePhase = (progress: CaseProgress, nextPhase: CasePhase): Result<CaseProgress> => {
    if (NEXT_CASE_PHASE[progress.phase] !== nextPhase) {
        return {
            ok: false,
            error: {
                code: 'invalid-case-transition',
                message: `Cannot advance from ${progress.phase} to ${nextPhase}.`
            }
        };
    }

    return { ok: true, value: { definition: progress.definition, phase: nextPhase } };
};

export const resetCaseProgress = (progress: CaseProgress): CaseProgress => ({
    definition: progress.definition,
    phase: 'context'
});
