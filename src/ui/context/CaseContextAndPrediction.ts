import type { AppStore } from '../../core/store/createStore';
import type { ContextualArtifact, LocalizedTextualRendition } from '../../domain/cases/CaseDefinition';
import type { LectureBookPresentation } from '../../game/main';
import {
    selectCasePhase,
    selectContextualReadiness,
    selectMissingContextArtifactLabels,
    selectSavedPrediction
} from '../../core/store/selectors';
import { getLectureSpread, paginateLectureRendition, type LecturePagination } from '../sources/lecturePagination';

const phaseCopy = (phase: string): string => {
    switch (phase) {
        case 'context': return 'Inspect both reviewed contextual artifacts before moving to the prediction step.';
        case 'prediction': return 'Record a tentative, revisable prediction before beginning the experiment.';
        case 'experiment': return 'Your contextual record and prediction are saved. Continue with the bounded laboratory.';
        default: return `Your contextual record is retained as the investigation continues through ${phase}.`;
    }
};

type OpenLectureRecord = Readonly<{
    source: ContextualArtifact;
    rendition: LocalizedTextualRendition;
    pagination: LecturePagination;
    spreadIndex: number;
}>;

/** Semantic owner of lecture navigation and focus; Phaser is sent a presentation-only projection. */
export type CaseContextAndPredictionController = Readonly<{
    destroy: () => void;
    openLectureRecord: (source: ContextualArtifact, returnFocus: () => void) => void;
}>;

export type CaseContextAndPredictionOptions = Readonly<{
    onLectureBookPresentationChange: (presentation: LectureBookPresentation | undefined) => void;
}>;

export const mountCaseContextAndPrediction = (
    root: HTMLElement,
    store: AppStore,
    options: CaseContextAndPredictionOptions
): CaseContextAndPredictionController => {
    let statusMessage = '';
    let draftPrediction = '';
    let lastSavedPrediction = '';
    let requestedFocusKey: string | undefined;
    let openLectureRecord: OpenLectureRecord | undefined;
    let returnFocusToSourceCard: (() => void) | undefined;
    let lastRenderedPhase: string | undefined;

    const activeFocusKey = (): string | undefined => {
        const activeElement = document.activeElement;
        return activeElement instanceof HTMLElement && root.contains(activeElement)
            ? activeElement.dataset.contextPredictionFocus
            : undefined;
    };

    const closeLectureRecord = (): void => {
        if (!openLectureRecord) return;
        openLectureRecord = undefined;
        const returnFocus = returnFocusToSourceCard;
        returnFocusToSourceCard = undefined;
        render();
        returnFocus?.();
    };

    const moveSpread = (direction: -1 | 1): void => {
        if (!openLectureRecord) return;
        const spread = getLectureSpread(openLectureRecord.pagination, openLectureRecord.spreadIndex + direction);
        if (spread.index === openLectureRecord.spreadIndex) return;
        openLectureRecord = { ...openLectureRecord, spreadIndex: spread.index };
        render();
    };

    const publishLectureBook = (): void => {
        if (!openLectureRecord) {
            options.onLectureBookPresentationChange(undefined);
            return;
        }
        const spread = getLectureSpread(openLectureRecord.pagination, openLectureRecord.spreadIndex);
        options.onLectureBookPresentationChange({
            title: openLectureRecord.source.textualRendition!.readerLabel,
            sourceLabel: openLectureRecord.source.displayName,
            index: spread.index,
            total: spread.total,
            pages: spread.pages,
            summary: openLectureRecord.source.textualRendition!.summary,
            canGoPrevious: spread.canGoPrevious,
            canGoNext: spread.canGoNext,
            onPrevious: () => moveSpread(-1),
            onNext: () => moveSpread(1),
            onClose: closeLectureRecord
        });
    };

    // The Phaser book is the reader; HTML keeps only a compact, accessible attribution block
    // (reuse statement, citation, and the external archive-facsimile link).
    const renderSourceAttribution = (panel: HTMLElement): void => {
        if (!openLectureRecord) return;
        const rendition = openLectureRecord.source.textualRendition!;
        const attribution = document.createElement('div');
        attribution.className = 'contextual-source-attribution';
        attribution.setAttribute('role', 'group');
        attribution.setAttribute('aria-label', `${rendition.readerLabel} — source attribution`);
        const reuse = document.createElement('p');
        reuse.className = 'contextual-reuse-statement';
        reuse.textContent = rendition.citation.reuseStatement;
        const citation = document.createElement('p');
        citation.className = 'contextual-citation';
        citation.textContent = `${rendition.citation.citationText} `;
        const archive = document.createElement('a');
        archive.href = rendition.citation.archiveUrl;
        archive.target = '_blank';
        archive.rel = 'noopener noreferrer';
        archive.textContent = 'View the cited archive facsimile (opens in a new tab).';
        citation.append(archive);
        attribution.append(reuse, citation);
        panel.append(attribution);
    };

    const render = (): void => {
        const focusKey = requestedFocusKey ?? activeFocusKey();
        requestedFocusKey = undefined;
        const state = store.getState();
        const phase = selectCasePhase(state);
        if (openLectureRecord && phase === 'experiment' && lastRenderedPhase !== 'experiment') {
            // Dismiss the book only as experimentation begins, so a lingering reader never covers the
            // laboratory. Re-opening a reference later (e.g. re-inspecting a source) stays allowed.
            openLectureRecord = undefined;
            returnFocusToSourceCard = undefined;
        }
        lastRenderedPhase = phase;
        const readiness = selectContextualReadiness(state);
        const missingLabels = selectMissingContextArtifactLabels(state);
        const savedPrediction = selectSavedPrediction(state);
        if (savedPrediction !== lastSavedPrediction) {
            draftPrediction = savedPrediction;
            lastSavedPrediction = savedPrediction;
        }

        const panel = document.createElement('section');
        panel.className = 'case-context-prediction';
        panel.setAttribute('aria-label', 'Young context and prediction');
        panel.dataset.contextPredictionFocus = 'panel';
        panel.tabIndex = -1;
        const heading = document.createElement('h2');
        heading.textContent = 'Young context and prediction';
        const dispute = document.createElement('p');
        dispute.textContent = state.caseDefinition.openingDispute;
        const guidance = document.createElement('p');
        guidance.textContent = phaseCopy(phase);
        const sourceSummary = document.createElement('p');
        const requiredSourceCount = state.caseDefinition.contextualArtifacts.length;
        sourceSummary.className = 'context-readiness-summary';
        sourceSummary.textContent = readiness.status === 'ready'
            ? `${requiredSourceCount} of ${requiredSourceCount} reviewed contextual artifacts inspected.`
            : `${requiredSourceCount - missingLabels.length} of ${requiredSourceCount} reviewed contextual artifacts inspected. Still needed: ${missingLabels.join(', ')}.`;
        const status = document.createElement('p');
        status.className = 'context-prediction-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-label', 'Context and prediction status');
        status.textContent = statusMessage;
        panel.append(heading, dispute, guidance, sourceSummary, status);
        renderSourceAttribution(panel);

        const predictionLabel = document.createElement('label');
        predictionLabel.htmlFor = 'case-prediction';
        predictionLabel.textContent = 'Tentative prediction';
        const prediction = document.createElement('textarea');
        prediction.id = 'case-prediction';
        prediction.dataset.contextPredictionFocus = 'prediction';
        prediction.value = draftPrediction;
        prediction.addEventListener('input', () => { draftPrediction = prediction.value; });
        const record = document.createElement('button');
        record.type = 'button';
        record.dataset.contextPredictionFocus = 'record';
        record.textContent = 'Record a prediction';
        record.addEventListener('click', () => {
            requestedFocusKey = 'record';
            const transition = store.dispatch({ type: 'prediction.recorded', prediction: draftPrediction });
            statusMessage = transition.ok
                ? 'Your tentative prediction is recorded and can be revised.'
                : transition.error.message;
            if (transition.ok) draftPrediction = selectSavedPrediction(store.getState());
            render();
        });
        panel.append(predictionLabel, prediction, record);

        if (phase === 'context' || phase === 'prediction') {
            const continueButton = document.createElement('button');
            continueButton.type = 'button';
            continueButton.dataset.contextPredictionFocus = 'continue';
            continueButton.textContent = phase === 'context' ? 'Continue to prediction' : 'Continue to experimentation';
            continueButton.addEventListener('click', () => {
                requestedFocusKey = phase === 'prediction' ? 'panel' : 'continue';
                const transition = store.dispatch({ type: 'case.phaseAdvance', nextPhase: phase === 'context' ? 'prediction' : 'experiment' });
                statusMessage = transition.ok
                    ? phase === 'context'
                        ? 'Context is complete. Record or revise your tentative prediction.'
                        : 'Prediction recorded. The experiment is ready to begin.'
                    : transition.error.message;
                render();
            });
            panel.append(continueButton);
        }

        root.replaceChildren(panel);
        publishLectureBook();
        if (focusKey) root.querySelector<HTMLElement>('[data-context-prediction-focus="' + focusKey + '"]')?.focus();
    };

    const unsubscribe = store.subscribe(render);
    render();
    return {
        destroy: () => {
            unsubscribe();
            options.onLectureBookPresentationChange(undefined);
            root.replaceChildren();
        },
        openLectureRecord: (source, returnFocus) => {
            const rendition = source.textualRendition?.renditions.find(({ locale }) => locale === 'en');
            if (!rendition) return;
            openLectureRecord = { source, rendition, pagination: paginateLectureRendition(rendition), spreadIndex: 0 };
            returnFocusToSourceCard = returnFocus;
            render();
        }
    };
};
