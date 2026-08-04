import type { PrimaryControl } from '../../domain/cases/CaseDefinition';
import type { AppState } from './AppState';

const decimalPlaces = (value: number): number => value.toString().split('.')[1]?.length ?? 0;

export const selectPrimaryControl = (state: AppState, controlId: PrimaryControl['id']): PrimaryControl => {
    const control = state.caseDefinition.apparatus.primaryControls.find(({ id }) => id === controlId);
    if (!control) {
        throw new Error(`Unknown authored control: ${controlId}`);
    }
    return control;
};

export const selectControlValue = (state: AppState, controlId: PrimaryControl['id']): number =>
    state.activeControlValues[controlId];

export const selectFormattedControlValue = (state: AppState, controlId: PrimaryControl['id']): string => {
    const control = selectPrimaryControl(state, controlId);
    return `${selectControlValue(state, controlId).toFixed(decimalPlaces(control.step))} ${control.unit}`;
};
