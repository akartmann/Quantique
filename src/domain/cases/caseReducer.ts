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

const REVISIT_CASE_PHASE: Readonly<Partial<Record<CasePhase, CasePhase>>> = {
    experiment: 'prediction',
    synthesis: 'experiment',
    review: 'experiment'
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

/**
 * Revisits the immediately preceding authored workspace without rewinding player progress.
 *
 * The three permitted routes are intentionally narrower than the forward phase sequence: context
 * remains the investigation's start, and no revisit may bypass the rival-lab revision flow or the
 * debrief. The store owns the request and the router projects the resulting phase.
 */
export const retreatCasePhase = (progress: CaseProgress, previousPhase: CasePhase): Result<CaseProgress> => {
    if (REVISIT_CASE_PHASE[progress.phase] !== previousPhase) {
        return {
            ok: false,
            error: {
                code: 'invalid-case-retreat',
                message: `Cannot revisit ${previousPhase} from ${progress.phase}.`
            }
        };
    }

    return { ok: true, value: { definition: progress.definition, phase: previousPhase } };
};

export const resetCaseProgress = (progress: CaseProgress): CaseProgress => ({
    definition: progress.definition,
    phase: 'context'
});
