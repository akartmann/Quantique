import type { AppStore } from '../../core/store/createStore';
import { selectFormattedControlValue, selectPrimaryControl } from '../../core/store/selectors';
import type { PrimaryControl } from '../../domain/cases/CaseDefinition';

const controlMessage = (store: AppStore, controlId: PrimaryControl['id']): string => {
    const control = selectPrimaryControl(store.getState(), controlId);
    return `${control.label} set to ${selectFormattedControlValue(store.getState(), controlId)}.`;
};

export const dispatchControlValueFromDom = (
    store: AppStore,
    controlId: PrimaryControl['id'],
    value: number
) => store.dispatch({ type: 'apparatus.controlSet', controlId, value, origin: 'dom' });

export const mountApparatusControls = (
    root: HTMLElement,
    store: AppStore,
    controlId: PrimaryControl['id'] = 'slitSpacingMm'
): (() => void) => {
    const control = selectPrimaryControl(store.getState(), controlId);
    root.replaceChildren();

    const panel = document.createElement('section');
    panel.className = 'apparatus-controls';
    panel.setAttribute('aria-labelledby', 'apparatus-heading');

    const heading = document.createElement('h2');
    heading.id = 'apparatus-heading';
    heading.textContent = 'Laboratory controls';

    const instructions = document.createElement('p');
    instructions.id = `${control.id}-instructions`;
    instructions.textContent = `Adjust ${control.label} in ${control.unit}. Use the number field, its keyboard stepper, or the laboratory surface.`;

    const label = document.createElement('label');
    label.htmlFor = control.id;
    label.textContent = `${control.label} (${control.unit})`;

    const input = document.createElement('input');
    input.id = control.id;
    input.name = control.id;
    input.type = 'number';
    input.inputMode = 'decimal';
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = String(control.step);
    input.setAttribute('aria-describedby', `${control.id}-instructions ${control.id}-readout`);

    const readout = document.createElement('span');
    readout.id = `${control.id}-readout`;
    readout.className = 'control-readout';

    const range = document.createElement('p');
    range.className = 'control-range';
    range.textContent = `Valid range: ${control.min}–${control.max} ${control.unit}, in ${control.step} ${control.unit} steps.`;

    const status = document.createElement('p');
    status.id = 'apparatus-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.className = 'apparatus-status';

    const render = (announce = false): void => {
        const formattedValue = selectFormattedControlValue(store.getState(), controlId);
        input.value = String(store.getState().activeControlValues[controlId]);
        readout.textContent = formattedValue;
        if (announce) {
            status.textContent = controlMessage(store, controlId);
        }
    };

    const applyInputValue = (): void => {
        const result = dispatchControlValueFromDom(store, controlId, input.valueAsNumber);
        if (result.ok) {
            render(true);
        } else {
            render(false);
            status.textContent = 'Enter a finite laboratory control value.';
        }
    };

    input.addEventListener('change', applyInputValue);
    input.addEventListener('blur', applyInputValue);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            applyInputValue();
            return;
        }

        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
            return;
        }

        event.preventDefault();
        const requestedValue = store.getState().activeControlValues[controlId]
            + (event.key === 'ArrowUp' ? control.step : -control.step);
        const result = dispatchControlValueFromDom(store, controlId, requestedValue);
        if (result.ok) {
            render(true);
        }
    });

    panel.append(heading, instructions, label, input, readout, range, status);
    root.append(panel);
    render();

    const unsubscribe = store.subscribe(() => render(false));
    return () => {
        unsubscribe();
        root.replaceChildren();
    };
};
