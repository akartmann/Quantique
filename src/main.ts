import { registerOfflineCache } from './adapters/OfflineCache';
import { createSceneRouter } from './adapters/phaser/SceneRouter';
import { loadCaseDefinition } from './adapters/content/loadCaseDefinition';
import { CaseRecordRepository } from './adapters/persistence/caseRecordRepository';
import { attachAutosave, createCaseRecordOperations } from './adapters/persistence/caseRecordOperations';
import { readCompletedCampaignCaseIds } from './adapters/persistence/completedCampaignCases';
import { resolveBrowserLocale } from './core/i18n/resolveBrowserLocale';
import { createTranslator, translateError } from './core/i18n/translate';
import { createAppStateFromCaseRecord, createInitialAppState } from './core/store/AppState';
import { createStore } from './core/store/createStore';
import StartGame from './game/main';
import { createBootShell, getBootFailureMessage, setBootShellStatus } from './ui/BootShell';
import { mountCaseRecordPrintView } from './ui/print/CaseRecordPrintView';
import { mountValidationSessionDisclosure } from './ui/ValidationSessionDisclosure';
import { resolveCaseId } from './adapters/content/resolveCaseId';

/**
 * The four roots this application still needs, and what each is for.
 *
 * Story 2.12 deleted eleven others with the panels that mounted into them. What is left is the boot
 * frame, the facilitator disclosure, ADR-007's printable record — the sole non-Phaser *surface*, which
 * dispatches nothing — and the canvas the game runs on.
 *
 * **Four, not five.** Story 3.3 added a `#source-rights-ledger` root for a `?ledger=1` reviewer route;
 * the code review removed it, because `project-context.md` §Engine holds `src/ui/` to exactly three
 * modules and the document to exactly three elements outside `#game-container`, "each either transient
 * or unseen". The ledger is now a generated markdown artifact (`npm run audit:ledger`) rather than a
 * mounted surface, which is also how Epic 3's "when a reviewer opens its ledger" is satisfied without a
 * route. See `src/domain/sources/ledgerReport.ts`.
 */
const REQUIRED_ROOTS = ['#boot-shell', '#validation-session-disclosure', '#print-record', '#game-container'] as const;

/**
 * Says so, loudly, when the document is not the one this build expects.
 *
 * **The guard this replaces returned silently** (2.4 review, carried in `deferred-work.md` since). It
 * was fifteen `querySelector` results in one `if`, and a missing root left the page sitting on
 * `index.html`'s pre-hydration English placeholder markup — which looks like a slow load rather than a
 * broken build, forever. There is no fallback surface behind it any more, so silence would now mean a
 * blank investigation with nothing to say about itself.
 *
 * Both halves of AC2's "fails loudly": a message the player can read, and one dev-log line naming the
 * roots. The message goes through `#boot-status` when that element exists — it is `role="status"` and
 * the only region guaranteed to be in the document — and falls back to replacing the body's text when
 * even the boot shell is missing, because a message written into an element that is not there is the
 * same silence in a different shape.
 *
 * The message stays localized even for a malformed document: browser-locale resolution is independent
 * of these roots, and an English-only failure is still a player-facing surface (Story 2.12, AC10).
 */
const reportMissingRoots = (missing: readonly string[], locale: ReturnType<typeof resolveBrowserLocale>): void => {
    const message = getBootFailureMessage(locale);
    const status = document.querySelector<HTMLElement>('#boot-status');
    if (status) status.textContent = message;
    else document.body.textContent = message;
    if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error(`[boot] The document is missing required roots: ${missing.join(', ')}`);
    }
};

const initializeLaboratory = async (): Promise<void> => {
    const search = new URLSearchParams(window.location.search);
    const validationMode = search.get('mode') === 'validation';
    // This does not depend on any document root, so even a loud boot failure speaks the browser language.
    const locale = resolveBrowserLocale();
    const roots = Object.fromEntries(
        REQUIRED_ROOTS.map((selector) => [selector, document.querySelector<HTMLElement>(selector)])
    ) as Record<typeof REQUIRED_ROOTS[number], HTMLElement | null>;
    const missing = REQUIRED_ROOTS.filter((selector) => roots[selector] === null);
    if (missing.length > 0) {
        reportMissingRoots(missing, locale);
        return;
    }
    const bootShell = roots['#boot-shell']!;
    const validationDisclosureRoot = roots['#validation-session-disclosure']!;
    const printRoot = roots['#print-record']!;
    const gameContainer = roots['#game-container']!;

    // Resolved from the browser's own language preferences, synchronously and before any `await`, so
    // the language is settled before anything this function renders and nothing about it ever needs to
    // be stored or restored. Note what this does *not* claim: `index.html` ships English placeholder
    // markup by design, so the genuine first paint can be English on a slow machine — hydration below
    // is what puts the frame in the resolved language. The facilitator locale check in
    // `docs/validation/young-validation-plan.md` is written against the settled screen for that reason.
    const bootFrame = createBootShell(bootShell, locale);
    // Mounted here rather than after the content load: AC4 requires the facilitator disclosure on
    // every render of the validation route, and a `loadCaseDefinition` failure returns below — which
    // previously left a moderated session looking live with no privacy statement at all. The mode
    // flag is read at the top of this function, before any repository exists, so moving the mount
    // earlier does not touch the isolation ordering.
    if (validationMode) mountValidationSessionDisclosure(validationDisclosureRoot, locale);
    void registerOfflineCache();

    // The campaign entry is progress-dependent (Story 4.1, AC6), so the repository is built before the
    // case id is resolved rather than after the definition loads. The validation route still builds no
    // repository — it is not campaign-gated and `resolveCaseId` pins it to Young — so the moderated
    // session reads no saved progress, which is the isolation Story 2.12's AC3 requires.
    const repository = validationMode ? undefined : new CaseRecordRepository();
    const caseId = resolveCaseId(search, repository ? await readCompletedCampaignCaseIds(repository) : []);

    const caseResult = await loadCaseDefinition(caseId);
    if (!caseResult.ok) {
        // Localized by the stable error code, not by re-raising the dev-facing message (NFR18).
        setBootShellStatus(translateError(locale, caseResult.error));
        return;
    }

    let initialState = createInitialAppState(caseResult.value, locale);
    if (repository) {
        const saved = await repository.load(caseResult.value.id);
        const restored = saved.ok && saved.value
            // The live session's language, never the record's: importing an investigation exported
            // on a French machine must not change this player's interface language.
            ? createAppStateFromCaseRecord(saved.value, caseResult.value, locale)
            : undefined;
        initialState = restored?.ok ? restored.value : initialState;
        const t = createTranslator(locale);
        if (saved.ok && saved.value && !restored?.ok) {
            setBootShellStatus(t('boot.status.savedProgressUnusable'));
        } else if (!saved.ok) {
            setBootShellStatus(t('boot.status.savedProgressUnavailable'));
        }
    }
    const store = createStore(initialState);
    // Everything the deleted `CaseProgressPanel` owned, behind the gate that already governed it: the
    // validation route builds no repository, so it wires no autosave, offers no export or import, and
    // mounts no printable record (Story 2.12, AC3).
    let recordOperations;
    if (repository) {
        // The autosave. Relocated verbatim from the panel, `pendingWrite` chain included — that chain is
        // what stops two writes racing on one key. Its failure surface is the boot shell's own status
        // region, which is where the two other persistence messages above already speak (NFR12): the
        // save can fail in any phase, and a canvas surface would need a store field to hear about it,
        // which this story's scope boundary rules out.
        const t = createTranslator(locale);
        attachAutosave(store, repository, () => setBootShellStatus(t('boot.status.saveFailed')));
        recordOperations = createCaseRecordOperations(store, repository);
        mountCaseRecordPrintView(printRoot, store);
    }
    const game = StartGame('game-container', store, recordOperations);

    /**
     * The entry gate is an input gate, not just a curtain.
     *
     * Covering the canvas with the boot frame is not enough on its own: Phaser binds its pointer
     * listeners above the document rather than to the canvas element, so a click on the frame's
     * background is hit-tested against the surface underneath it and reaches whatever is there. Before
     * this, clicking the middle of the splash took a reference off the reading room's shelf — invisibly,
     * and it was recorded. Verified by probe rather than assumed, because DOM occlusion looks like it
     * ought to be sufficient and silently is not.
     *
     * The game is still *constructed* on load. `Scale.FIT` measures the container to letterbox the design
     * surface, and a container that is hidden or unsized when the game starts measures as nothing;
     * disabling input costs the same and leaves the scale correct from the first frame.
     */
    game.input.enabled = false;
    void bootFrame.entered.then(() => { game.input.enabled = true; });
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
