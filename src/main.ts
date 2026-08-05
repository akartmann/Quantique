import { registerOfflineCache } from './adapters/OfflineCache';
import { loadCaseDefinition } from './adapters/content/loadCaseDefinition';
import { CaseRecordRepository } from './adapters/persistence/caseRecordRepository';
import { createAppStateFromCaseRecord, createInitialAppState } from './core/store/AppState';
import { createStore } from './core/store/createStore';
import StartGame from './game/main';
import { mountApparatusControls } from './ui/apparatus/ApparatusControls';
import { createBootShell, setBootShellStatus } from './ui/BootShell';
import { mountNotebookPanel } from './ui/notebook/NotebookPanel';
import { mountCuratedRecord } from './ui/sources/CuratedRecord';
import { mountCaseContextAndPrediction } from './ui/context/CaseContextAndPrediction';
import { mountTheoryBoard } from './ui/theory/TheoryBoard';
import { mountConsultationPanel } from './ui/review/ConsultationPanel';
import { mountConclusionReviewPanel } from './ui/review/ConclusionReviewPanel';
import { mountDecisionHistoryPanel } from './ui/review/DecisionHistoryPanel';
import { mountCaseProgressPanel } from './ui/persistence/CaseProgressPanel';
import { mountCaseRecordPrintView } from './ui/print/CaseRecordPrintView';
import { mountInquiryRecognitionPanel } from './ui/recognition/InquiryRecognitionPanel';
import { mountHistoricalDebriefPanel } from './ui/debrief/HistoricalDebriefPanel';
import { mountValidationSessionDisclosure } from './ui/ValidationSessionDisclosure';

const initializeLaboratory = async (): Promise<void> => {
    const validationMode = new URLSearchParams(window.location.search).get('mode') === 'validation';
    const bootShell = document.querySelector<HTMLElement>('#boot-shell');
    const validationDisclosureRoot = document.querySelector<HTMLElement>('#validation-session-disclosure');
    const curatedRecordRoot = document.querySelector<HTMLElement>('#curated-record');
    const contextPredictionRoot = document.querySelector<HTMLElement>('#case-context-prediction');
    const controlsRoot = document.querySelector<HTMLElement>('#apparatus-controls');
    const notebookRoot = document.querySelector<HTMLElement>('#measurement-notebook');
    const theoryBoardRoot = document.querySelector<HTMLElement>('#theory-board');
    const consultationRoot = document.querySelector<HTMLElement>('#consultation-panel');
    const conclusionReviewRoot = document.querySelector<HTMLElement>('#conclusion-review');
    const decisionHistoryRoot = document.querySelector<HTMLElement>('#decision-history');
    const progressRoot = document.querySelector<HTMLElement>('#case-progress');
    const printRoot = document.querySelector<HTMLElement>('#print-record');
    const recognitionRoot = document.querySelector<HTMLElement>('#inquiry-recognition');
    const debriefRoot = document.querySelector<HTMLElement>('#historical-debrief');

    if (!bootShell || !validationDisclosureRoot || !curatedRecordRoot || !contextPredictionRoot || !controlsRoot || !notebookRoot || !theoryBoardRoot || !consultationRoot || !conclusionReviewRoot || !decisionHistoryRoot || !progressRoot || !printRoot || !recognitionRoot || !debriefRoot) {
        return;
    }

    createBootShell(bootShell);
    void registerOfflineCache();

    const caseResult = await loadCaseDefinition('young-interference');
    if (!caseResult.ok) {
        setBootShellStatus(bootShell, 'Laboratory content is unavailable. Please try again when it is available.');
        return;
    }

    let repository: CaseRecordRepository | undefined;
    let initialState = createInitialAppState(caseResult.value);
    if (!validationMode) {
        repository = new CaseRecordRepository();
        const saved = await repository.load(caseResult.value.id);
        const restored = saved.ok && saved.value
            ? createAppStateFromCaseRecord(saved.value, caseResult.value)
            : undefined;
        initialState = restored?.ok ? restored.value : initialState;
        if (saved.ok && saved.value && !restored?.ok) {
            setBootShellStatus(bootShell, 'Saved progress could not be used. A fresh investigation is ready.');
        } else if (!saved.ok) {
            setBootShellStatus(bootShell, 'Saved progress is unavailable right now. The investigation is ready to continue.');
        }
    }
    const store = createStore(initialState);
    if (validationMode) mountValidationSessionDisclosure(validationDisclosureRoot);
    mountCuratedRecord(curatedRecordRoot, store);
    mountCaseContextAndPrediction(contextPredictionRoot, store);
    mountApparatusControls(controlsRoot, store);
    mountNotebookPanel(notebookRoot, store);
    mountTheoryBoard(theoryBoardRoot, store);
    mountConsultationPanel(consultationRoot, store);
    mountConclusionReviewPanel(conclusionReviewRoot, store);
    mountDecisionHistoryPanel(decisionHistoryRoot, store);
    mountInquiryRecognitionPanel(recognitionRoot, store);
    mountHistoricalDebriefPanel(debriefRoot, store);
    if (repository) {
        mountCaseProgressPanel(progressRoot, store, repository);
        mountCaseRecordPrintView(printRoot, store);
    }
    StartGame('game-container', store);
};

document.addEventListener('DOMContentLoaded', () => {
    void initializeLaboratory();
});
