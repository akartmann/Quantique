// Retiring pre-pivot DOM panel (Stories 1.11, 1.12, 2.1, 2.3, 2.5 replace it with a Phaser scene).
// Authored case text is read as canonical `.en` rather than routed through the i18n layer on purpose:
// translating a surface scheduled for deletion is throwaway work and doubles the FR copy to review.
// Each replacement scene localizes its own text as it is built. See docs/i18n-authoring.md.
import type { AppStore } from '../../core/store/createStore';
import { selectCompletionSnapshot, selectReplayState, selectSourceById } from '../../core/store/selectors';

/** Renders authored historical context from immutable content and the completed evidence snapshot. */
export const mountHistoricalDebriefPanel = (root: HTMLElement, store: AppStore): (() => void) => {
    let message = '';
    let focusKey: string | undefined;
    const render = (): void => {
        const active = document.activeElement;
        const restore = focusKey ?? (active instanceof HTMLElement && root.contains(active) ? active.dataset.debriefFocus : undefined);
        focusKey = undefined;
        const state = store.getState();
        const completion = selectCompletionSnapshot(state);
        const panel = document.createElement('section');
        panel.className = 'historical-debrief-panel';
        panel.setAttribute('aria-label', 'Historical debrief');
        const heading = document.createElement('h2'); heading.textContent = 'Historical debrief';
        const status = document.createElement('p');
        status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-label', 'Historical debrief status');
        status.textContent = message;
        panel.append(heading, status);
        if (state.phase === 'review') {
            const guidance = document.createElement('p'); guidance.textContent = 'Save a reviewed, evidence-bounded revision to open the historical debrief.';
            const open = document.createElement('button'); open.type = 'button'; open.dataset.debriefFocus = 'open'; open.textContent = 'Open historical debrief';
            open.addEventListener('click', () => {
                focusKey = 'open';
                const result = store.dispatch({ type: 'case.debriefCompleted', timestamp: new Date().toISOString() });
                message = result.ok ? 'The completed evidence record is now available with the historical debrief.' : result.error.message;
                render();
            });
            panel.append(guidance, open);
        }
        if (completion) {
            const decision = document.createElement('section');
            const decisionHeading = document.createElement('h3'); decisionHeading.textContent = 'Completed evidence-bounded conclusion';
            const decisionText = document.createElement('p'); decisionText.textContent = `${completion.finalDecision.conclusion} Limitation: ${completion.finalDecision.limitation}`;
            decision.append(decisionHeading, decisionText);
            const debrief = state.caseDefinition.debrief;
            const historical = document.createElement('section');
            const historicalHeading = document.createElement('h3'); historicalHeading.textContent = debrief.historicalComparison.title.en;
            const historicalText = document.createElement('p'); historicalText.textContent = debrief.historicalComparison.text.en;
            const sources = document.createElement('ul');
            debrief.historicalComparison.sourceIds.forEach((sourceId) => {
                const item = document.createElement('li'); item.textContent = selectSourceById(state, sourceId)?.displayName.en ?? 'Authored source unavailable.'; sources.append(item);
            });
            historical.append(historicalHeading, historicalText, sources);
            const theory = document.createElement('details');
            const summary = document.createElement('summary'); summary.textContent = debrief.deeperTheory.title.en;
            const theoryText = document.createElement('p'); theoryText.textContent = debrief.deeperTheory.text.en;
            theory.append(summary, theoryText);
            const recognition = document.createElement('section');
            const recognitionHeading = document.createElement('h3'); recognitionHeading.textContent = 'Inquiry recognition at completion';
            const recognitionList = document.createElement('ul');
            completion.recognition.items.filter((item) => item.achieved).forEach((item) => recognitionList.append(Object.assign(document.createElement('li'), { textContent: item.label })));
            if (!recognitionList.children.length) recognitionList.append(Object.assign(document.createElement('li'), { textContent: 'Inquiry actions remain recorded without a score.' }));
            recognition.append(recognitionHeading, recognitionList);
            panel.append(decision, historical, theory, recognition);
            if (state.phase === 'debrief') {
                const replay = document.createElement('button'); replay.type = 'button'; replay.dataset.debriefFocus = 'replay'; replay.textContent = debrief.replayLabel.en;
                replay.addEventListener('click', () => {
                    focusKey = 'replay';
                    const result = store.dispatch({ type: 'case.replayStarted' });
                    message = result.ok ? 'Counterfactual replay started. The recorded historical result is unchanged.' : result.error.message;
                    render();
                });
                panel.append(replay);
            }
        }
        if (selectReplayState(state).isCounterfactual) {
            const label = document.createElement('p'); label.className = 'counterfactual-replay-label'; label.textContent = 'Counterfactual replay — not the recorded historical result';
            panel.append(label);
        }
        root.replaceChildren(panel);
        if (restore) root.querySelector<HTMLElement>(`[data-debrief-focus="${restore}"]`)?.focus();
    };
    const unsubscribe = store.subscribe(render);
    render();
    return () => { unsubscribe(); root.replaceChildren(); };
};
