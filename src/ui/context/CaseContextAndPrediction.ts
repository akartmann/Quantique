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
        requestedFocusKey = direction === 1 ? 'next-lecture-page' : 'previous-lecture-page';
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
            canGoPrevious: spread.canGoPrevious,
            canGoNext: spread.canGoNext,
            onPrevious: () => moveSpread(-1),
            onNext: () => moveSpread(1),
            onClose: closeLectureRecord
        });
    };

    const renderLectureReader = (panel: HTMLElement): void => {
        if (!openLectureRecord) return;
        const { source } = openLectureRecord;
        const spread = getLectureSpread(openLectureRecord.pagination, openLectureRecord.spreadIndex);
        const reader = document.createElement('article');
        reader.className = 'contextual-text-reader';
        reader.dataset.contextPredictionFocus = 'lecture-reader';
        reader.tabIndex = -1;
        reader.setAttribute('aria-label', source.textualRendition!.readerLabel);
        reader.setAttribute('aria-describedby', 'lecture-spread-status');
        const readerHeading = document.createElement('h3');
        readerHeading.textContent = source.textualRendition!.readerLabel;
        const sourceIdentity = document.createElement('p');
        sourceIdentity.textContent = `${source.creatorOrOrigin}. ${source.caseRelationship}`;
        const readingNote = document.createElement('p');
        readingNote.className = 'contextual-reader-note';
        readingNote.textContent = 'Reading this local rendition does not record the source as inspected evidence.';
        const status = document.createElement('p');
        status.id = 'lecture-spread-status';
        status.className = 'lecture-spread-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.textContent = `Book spread ${spread.index + 1} of ${spread.total}.`;
        const reuse = document.createElement('p');
        reuse.textContent = source.textualRendition!.citation.reuseStatement;
        const citation = document.createElement('p');
        citation.textContent = `${source.textualRendition!.citation.citationText} `;
        const archive = document.createElement('a');
        archive.href = source.textualRendition!.citation.archiveUrl;
        archive.target = '_blank';
        archive.rel = 'noopener noreferrer';
        archive.textContent = 'View the cited archive facsimile (opens in a new tab).';
        citation.append(archive);
        const controls = document.createElement('div');
        controls.className = 'lecture-reader-controls';
        const previous = document.createElement('button');
        previous.type = 'button';
        previous.dataset.contextPredictionFocus = 'previous-lecture-page';
        previous.textContent = 'Previous page';
        previous.disabled = !spread.canGoPrevious;
        previous.addEventListener('click', () => moveSpread(-1));
        const next = document.createElement('button');
        next.type = 'button';
        next.dataset.contextPredictionFocus = 'next-lecture-page';
        next.textContent = 'Next page';
        next.disabled = !spread.canGoNext;
        next.addEventListener('click', () => moveSpread(1));
        const close = document.createElement('button');
        close.type = 'button';
        close.dataset.contextPredictionFocus = 'close-lecture-reader';
        close.textContent = 'Close book';
        close.addEventListener('click', closeLectureRecord);
        controls.append(previous, next, close);
        reader.append(readerHeading, sourceIdentity, readingNote, status, reuse, citation, controls);
        spread.pages.forEach((page) => {
            if (!page) return;
            const sourceSection = document.createElement('section');
            sourceSection.className = 'contextual-text-section';
            sourceSection.id = page.id;
            sourceSection.dataset.sourceSectionId = page.sourceSectionId;
            const sectionHeading = document.createElement('h4');
            sectionHeading.textContent = page.heading;
            const pageReference = document.createElement('p');
            pageReference.className = 'contextual-source-pages';
            pageReference.textContent = `Source page${page.sourcePages.length === 1 ? '' : 's'} ${page.sourcePages.join(', ')}.`;
            sourceSection.append(sectionHeading, pageReference);
            page.paragraphs.forEach((text) => {
                const paragraph = document.createElement('p');
                paragraph.textContent = text;
                sourceSection.append(paragraph);
            });
            reader.append(sourceSection);
        });
        panel.append(reader);
    };

    const render = (): void => {
        const focusKey = requestedFocusKey ?? activeFocusKey();
        requestedFocusKey = undefined;
        const state = store.getState();
        const phase = selectCasePhase(state);
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
        renderLectureReader(panel);

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
            requestedFocusKey = 'lecture-reader';
            render();
        }
    };
};
