import { registerOfflineCache } from './adapters/OfflineCache';
import { createSceneRouter } from './adapters/phaser/SceneRouter';
import { loadCaseDefinition } from './adapters/content/loadCaseDefinition';
import { CaseRecordRepository } from './adapters/persistence/caseRecordRepository';
import { resolveBrowserLocale } from './core/i18n/resolveBrowserLocale';
import { createTranslator, translateError } from './core/i18n/translate';
import { createAppStateFromCaseRecord, createInitialAppState } from './core/store/AppState';
import { createStore } from './core/store/createStore';
import StartGame, { type LectureBookController, type LectureBookPresentation } from './game/main';
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
    const gameContainer = document.querySelector<HTMLElement>('#game-container');

    if (!bootShell || !validationDisclosureRoot || !curatedRecordRoot || !contextPredictionRoot || !controlsRoot || !notebookRoot || !theoryBoardRoot || !consultationRoot || !conclusionReviewRoot || !decisionHistoryRoot || !progressRoot || !printRoot || !recognitionRoot || !debriefRoot || !gameContainer) {
        return;
    }

    // Resolved from the browser's own language preferences, synchronously and before anything
    // renders, so the first paint is already in the right language — there is no English-to-French
    // flash and nothing about the language ever needs to be stored or restored.
    const locale = resolveBrowserLocale();
    createBootShell(bootShell, locale);
    void registerOfflineCache();

    const caseResult = await loadCaseDefinition('young-interference');
    if (!caseResult.ok) {
        // Localized by the stable error code, not by re-raising the dev-facing message (NFR18).
        setBootShellStatus(bootShell, translateError(locale, caseResult.error));
        return;
    }

    let repository: CaseRecordRepository | undefined;
    let initialState = createInitialAppState(caseResult.value, locale);
    if (!validationMode) {
        repository = new CaseRecordRepository();
        const saved = await repository.load(caseResult.value.id);
        const restored = saved.ok && saved.value
            // The live session's language, never the record's: importing an investigation exported
            // on a French machine must not change this player's interface language.
            ? createAppStateFromCaseRecord(saved.value, caseResult.value, locale)
            : undefined;
        initialState = restored?.ok ? restored.value : initialState;
        const t = createTranslator(locale);
        if (saved.ok && saved.value && !restored?.ok) {
            setBootShellStatus(bootShell, t('boot.status.savedProgressUnusable'));
        } else if (!saved.ok) {
            setBootShellStatus(bootShell, t('boot.status.savedProgressUnavailable'));
        }
    }
    const store = createStore(initialState);
    if (validationMode) mountValidationSessionDisclosure(validationDisclosureRoot);
    let lectureBookController: LectureBookController | undefined;
    let pendingLectureBookPresentation: LectureBookPresentation | undefined;
    const projectLectureBook = (presentation: LectureBookPresentation | undefined): void => {
        pendingLectureBookPresentation = presentation;
        if (presentation) lectureBookController?.show(presentation);
        else lectureBookController?.hide();
    };
    const contextAndPrediction = mountCaseContextAndPrediction(contextPredictionRoot, store, {
        onLectureBookPresentationChange: projectLectureBook
    });
    let curatedRecord: ReturnType<typeof mountCuratedRecord> | undefined;
    curatedRecord = mountCuratedRecord(curatedRecordRoot, store, {
        onReadLectureRecord: (source) => {
            contextAndPrediction.openLectureRecord(source, () => curatedRecord?.focusReaderTrigger(source.id));
        }
    });
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
    const game = StartGame('game-container', store, (controller) => {
        lectureBookController = controller;
        if (pendingLectureBookPresentation) controller.show(pendingLectureBookPresentation);
    });
    // The routed Phaser game is the surface whose active scene mirrors the authoritative phase.
    //
    // Constructed on Phaser's ready event, not inline: before the scene manager boots, `start` only
    // flags a key for auto-start and `stop` is a silent no-op, so a phase change in that window would
    // leave two scenes flagged and boot both. Waiting also guarantees the scene instances exist, so
    // an activation listener can be attached to them.
    game.events.once('ready', () => {
        const sceneRouter = createSceneRouter(
            {
                start: (sceneKey) => game.scene.start(sceneKey, {}),
                stop: (sceneKey) => game.scene.stop(sceneKey),
                isActive: (sceneKey) => game.scene.isActive(sceneKey),
                onceCreated: (sceneKey, listener) => game.scene.getScene(sceneKey)?.events.once('create', listener)
            },
            store,
            caseResult.value.scenarioScript,
            // A stable hook so the active scene is observable without reaching into Phaser internals.
            (sceneKey) => gameContainer.setAttribute('data-active-scene', sceneKey)
        );

        // Without this the subscription outlives the game it drives, and a post-destroy phase change
        // would call start/stop on a torn-down scene manager from inside the store's notify loop.
        game.events.once('destroy', () => sceneRouter.dispose());
    });
};

document.addEventListener('DOMContentLoaded', () => {
    void initializeLaboratory();
});
