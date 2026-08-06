// Retiring pre-pivot DOM panel (Stories 1.11, 1.12, 2.1, 2.3, 2.5 replace it with a Phaser scene).
// Authored case text is read as canonical `.en` rather than routed through the i18n layer on purpose:
// translating a surface scheduled for deletion is throwaway work and doubles the FR copy to review.
// Each replacement scene localizes its own text as it is built. See docs/i18n-authoring.md.
import type { AppStore } from '../../core/store/createStore';
import { selectCanonicalControlValue } from '../../core/store/selectors';
import type { PrimaryControl } from '../../domain/cases/CaseDefinition';

const phoneReadOnlyQuery = '(max-width: 767px)';

export const dispatchControlValueFromDom = (
    store: AppStore,
    controlId: PrimaryControl['id'],
    value: number
) => store.dispatch({ type: 'apparatus.controlSet', controlId, value, origin: 'dom' });

const createPatternVisual = (): { figure: HTMLElement; caption: HTMLElement } => {
    const figure = document.createElement('figure');
    figure.className = 'young-phase-visual';
    figure.setAttribute('role', 'img');
    figure.setAttribute('aria-labelledby', 'young-pattern-caption');
    const apparatus = document.createElement('div');
    apparatus.className = 'young-apparatus-diagram';
    apparatus.setAttribute('aria-hidden', 'true');
    const source = document.createElement('span'); source.className = 'young-source';
    const wave = document.createElement('span'); wave.className = 'young-wave';
    const barrier = document.createElement('span'); barrier.className = 'young-barrier';
    const slitTop = document.createElement('span'); slitTop.className = 'young-slit young-slit-top';
    const slitBottom = document.createElement('span'); slitBottom.className = 'young-slit young-slit-bottom';
    const rays = document.createElement('span'); rays.className = 'young-rays';
    const screen = document.createElement('span'); screen.className = 'young-screen';
    const fringes = document.createElement('span'); fringes.className = 'young-fringes';
    apparatus.append(source, wave, barrier, slitTop, slitBottom, rays, screen, fringes);
    const legend = document.createElement('div');
    legend.className = 'young-phase-legend';
    legend.textContent = 'Source → two slits → overlapping waves → measured screen pattern';
    const caption = document.createElement('figcaption');
    caption.id = 'young-pattern-caption';
    caption.textContent = 'Run an experiment to record the numerical fringe spacing shown by this visual pattern.';
    figure.append(apparatus, legend, caption);
    return { figure, caption };
};

export const mountApparatusControls = (root: HTMLElement, store: AppStore): (() => void) => {
    root.replaceChildren();
    const panel = document.createElement('section');
    panel.className = 'apparatus-controls';
    panel.setAttribute('aria-labelledby', 'apparatus-heading');
    const heading = document.createElement('h2'); heading.id = 'apparatus-heading'; heading.textContent = 'Young experiment setup';
    const introduction = document.createElement('p');
    introduction.textContent = 'Set the bounded apparatus values, then run the deterministic model. The laboratory surface mirrors these same controls.';
    const status = document.createElement('p');
    status.id = 'apparatus-status';
    status.className = 'apparatus-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const controls = new Map<PrimaryControl['id'], HTMLInputElement>();
    const readouts = new Map<PrimaryControl['id'], HTMLElement>();
    const instructions = new Map<PrimaryControl['id'], HTMLElement>();
    const controlGroup = document.createElement('div'); controlGroup.className = 'apparatus-control-grid';

    store.getState().caseDefinition.apparatus.primaryControls.forEach((control) => {
        const group = document.createElement('div'); group.className = 'apparatus-control';
        const label = document.createElement('label'); label.htmlFor = control.id; label.textContent = `${control.label.en} (${control.unit})`;
        const input = document.createElement('input');
        input.id = control.id; input.name = control.id; input.type = 'number'; input.inputMode = 'decimal';
        input.min = String(control.min); input.max = String(control.max); input.step = String(control.step);
        const instruction = document.createElement('p'); instruction.id = `${control.id}-instructions`;
        const range = document.createElement('p'); range.className = 'control-range';
        range.textContent = `Valid range: ${control.min}–${control.max} ${control.unit}, in ${control.step} ${control.unit} steps.`;
        const readout = document.createElement('output'); readout.id = `${control.id}-readout`; readout.className = 'control-readout';
        input.setAttribute('aria-describedby', `${instruction.id} ${range.id || `${control.id}-range`} ${readout.id}`);
        range.id = `${control.id}-range`;
        const applyValue = (): void => {
            const result = dispatchControlValueFromDom(store, control.id, input.valueAsNumber);
            status.textContent = result.ok
                ? `${control.label.en} set to ${selectCanonicalControlValue(store.getState(), control.id)}.`
                : 'Enter a finite laboratory control value. Your existing work is unchanged.';
        };
        input.addEventListener('change', applyValue);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); applyValue(); return; }
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            const result = dispatchControlValueFromDom(store, control.id, store.getState().activeControlValues[control.id] + (event.key === 'ArrowUp' ? control.step : -control.step));
            status.textContent = result.ok
                ? `${control.label.en} set to ${selectCanonicalControlValue(store.getState(), control.id)}.`
                : result.error.message;
        });
        controls.set(control.id, input); readouts.set(control.id, readout); instructions.set(control.id, instruction);
        group.append(label, input, readout, range, instruction); controlGroup.append(group);
    });

    const wavelengthLabel = document.createElement('label'); wavelengthLabel.htmlFor = 'wavelength-comparison'; wavelengthLabel.textContent = 'Optional wavelength comparison (nm)';
    const wavelength = document.createElement('select'); wavelength.id = 'wavelength-comparison'; wavelength.name = 'wavelength-comparison';
    [450, 550, 650].forEach((value) => {
        const option = document.createElement('option'); option.value = String(value); option.textContent = `${value} nm${value === 550 ? ' — fixed minimum path' : ' — advanced comparison'}`; wavelength.append(option);
    });
    const wavelengthGuidance = document.createElement('p'); wavelengthGuidance.id = 'wavelength-comparison-guidance';
    wavelength.setAttribute('aria-describedby', wavelengthGuidance.id);
    wavelength.addEventListener('change', () => {
        const value = Number(wavelength.value) as 450 | 550 | 650;
        const transition = store.dispatch({ type: 'apparatus.wavelengthSet', wavelengthNm: value });
        status.textContent = transition.ok ? `Wavelength set to ${value} nm.` : transition.error.message;
    });

    const actionRow = document.createElement('div'); actionRow.className = 'apparatus-actions';
    const run = document.createElement('button'); run.type = 'button'; run.textContent = 'Run experiment';
    const runGuidance = document.createElement('p'); runGuidance.className = 'apparatus-run-guidance';
    run.addEventListener('click', () => {
        const transition = store.dispatch({ type: 'experiment.run', id: crypto.randomUUID(), timestamp: new Date().toISOString() });
        status.textContent = transition.ok
            ? `Experiment recorded: ${store.getState().runs[store.getState().runs.length - 1]?.result.value} mm fringe spacing.`
            : transition.error.message;
    });
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset apparatus';
    reset.addEventListener('click', () => {
        const transition = store.dispatch({ type: 'apparatus.reset' });
        status.textContent = transition.ok ? 'Apparatus restored to its authored defaults. Saved observations remain available.' : transition.error.message;
    });
    actionRow.append(run, reset);
    const model = document.createElement('p'); model.className = 'young-model-assumptions';
    model.textContent = `Model: adjacent fringe spacing = wavelength × screen distance ÷ slit spacing. Assumptions: ${store.getState().caseDefinition.experiment.assumptions.en.join(' ')}`;
    const visual = createPatternVisual();
    let lastAnimatedRunId: string | undefined;

    panel.append(heading, introduction, controlGroup, wavelengthLabel, wavelength, wavelengthGuidance, actionRow, runGuidance, status, model, visual.figure);
    root.append(panel);
    const phoneMediaQuery = window.matchMedia(phoneReadOnlyQuery);

    const render = (): void => {
        const state = store.getState();
        const isPhoneReadOnly = phoneMediaQuery.matches;
        if (isPhoneReadOnly && !status.textContent) status.textContent = 'Laboratory controls are read-only on phones.';
        if (!isPhoneReadOnly && status.textContent === 'Laboratory controls are read-only on phones.') status.textContent = '';
        state.caseDefinition.apparatus.primaryControls.forEach((control) => {
            const input = controls.get(control.id)!;
            input.value = String(state.activeControlValues[control.id]);
            input.disabled = isPhoneReadOnly;
            readouts.get(control.id)!.textContent = selectCanonicalControlValue(state, control.id);
            instructions.get(control.id)!.textContent = isPhoneReadOnly
                ? `${control.label.en} is read-only on phones. Use a tablet or desktop browser to adjust the laboratory.`
                : `Use the number field, its keyboard stepper, or the laboratory surface to adjust ${control.label.en}.`;
        });
        const completedMinimumRuns = state.runs.filter((record) => record.modelInputs?.wavelengthMode === 'minimum' && record.modelInputs.wavelengthNm === 550).length;
        const unlocked = completedMinimumRuns >= state.caseDefinition.requirements.minimumRuns;
        wavelength.value = String(state.selectedWavelengthNm);
        wavelength.disabled = isPhoneReadOnly || (!unlocked && state.selectedWavelengthNm === 550);
        wavelengthGuidance.textContent = unlocked
            ? 'Optional comparison unlocked after two fixed 550 nm runs. It never changes saved minimum-path observations.'
            : `Optional comparison unlocks after ${state.caseDefinition.requirements.minimumRuns - completedMinimumRuns} more saved fixed-550-nm run${state.caseDefinition.requirements.minimumRuns - completedMinimumRuns === 1 ? '' : 's'}.`;
        const runUnavailable = state.phase !== 'experiment';
        run.disabled = isPhoneReadOnly;
        run.setAttribute('aria-disabled', String(runUnavailable || isPhoneReadOnly));
        run.classList.toggle('is-unavailable', runUnavailable || isPhoneReadOnly);
        runGuidance.textContent = isPhoneReadOnly
            ? 'Laboratory actions are read-only on phones.'
            : state.phase === 'experiment'
                ? 'Ready: Run experiment records the current setup immediately in your notebook and pattern visual.'
                : 'Run experiment unlocks after you inspect both sources, save a prediction, and continue to experimentation.';
        reset.disabled = isPhoneReadOnly;
        const latest = state.runs[state.runs.length - 1];
        if (latest?.id && latest.id !== lastAnimatedRunId) {
            visual.figure.classList.remove('is-running');
            void visual.figure.offsetWidth;
            visual.figure.classList.add('is-running');
            lastAnimatedRunId = latest.id;
        }
        visual.caption.textContent = latest?.modelInputs
            ? `Latest recorded pattern: ${latest.result.value} ${latest.result.unit} fringe spacing at ${latest.modelInputs.wavelengthNm} nm, with ${latest.modelInputs.screenDistanceM} m screen distance and ${latest.modelInputs.slitSpacingMm} mm slit spacing.`
            : 'Run an experiment to record the numerical fringe spacing shown by this visual pattern.';
    };
    visual.figure.addEventListener('animationend', () => visual.figure.classList.remove('is-running'));
    const updatePhoneMode = (): void => render();
    phoneMediaQuery.addEventListener('change', updatePhoneMode);
    const unsubscribe = store.subscribe(render);
    render();
    return () => { unsubscribe(); phoneMediaQuery.removeEventListener('change', updatePhoneMode); root.replaceChildren(); };
};
