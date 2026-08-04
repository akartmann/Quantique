import type { Result } from '../errors/Result';
import { normalizeControlValue } from '../../domain/apparatus/ApparatusControl';
import type { CaseDefinition, PrimaryControl } from '../../domain/cases/CaseDefinition';
import type { AppAction } from './AppAction';

export type AppState = Readonly<{
    caseDefinition: CaseDefinition;
    activeControlValues: Readonly<Record<PrimaryControl['id'], number>>;
}>;

const freezeState = (state: AppState): AppState => Object.freeze({
    ...state,
    activeControlValues: Object.freeze({ ...state.activeControlValues })
});

export const createInitialAppState = (caseDefinition: CaseDefinition): AppState => freezeState({
    caseDefinition,
    activeControlValues: Object.fromEntries(
        caseDefinition.apparatus.primaryControls.map((control) => [control.id, control.defaultValue])
    ) as Record<PrimaryControl['id'], number>
});

export const reduceAppState = (state: AppState, action: AppAction): Result<AppState> => {
    const control = state.caseDefinition.apparatus.primaryControls.find(({ id }) => id === action.controlId);
    if (!control) {
        return {
            ok: false,
            error: { code: 'unknown-apparatus-control', message: 'That laboratory control is unavailable.' }
        };
    }

    const normalized = normalizeControlValue(control, action.value);
    if (!normalized.ok) {
        return normalized;
    }

    return {
        ok: true,
        value: freezeState({
            ...state,
            activeControlValues: { ...state.activeControlValues, [control.id]: normalized.value }
        })
    };
};
