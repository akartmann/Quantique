import type { Result } from '../errors/Result';
import type { CaseRecord } from '../../schemas/CaseRecordSchema';
import type { AppAction } from './AppAction';
import { createAppStateFromCaseRecord, reduceAppState, type AppState } from './AppState';

export type AppStore = Readonly<{
    getState: () => AppState;
    dispatch: (action: AppAction) => Result<void>;
    subscribe: (listener: () => void) => () => void;
    replaceWithValidatedRecord: (record: CaseRecord) => Result<void>;
    acquireExclusiveOperation: () => Result<() => void>;
}>;

export const createStore = (initialState: AppState): AppStore => {
    let state = initialState;
    const listeners = new Set<() => void>();
    let exclusiveOperation = false;

    return {
        getState: () => state,
        dispatch: (action) => {
            if (exclusiveOperation) {
                return { ok: false, error: { code: 'progress-operation-active', message: 'Please wait for the progress operation to finish.' } };
            }
            const transition = reduceAppState(state, action);
            if (!transition.ok) {
                return transition;
            }

            state = transition.value;
            listeners.forEach((listener) => listener());
            return { ok: true, value: undefined };
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        replaceWithValidatedRecord: (record) => {
            const restored = createAppStateFromCaseRecord(record, state.caseDefinition);
            if (!restored.ok) return restored;
            state = restored.value;
            listeners.forEach((listener) => listener());
            return { ok: true, value: undefined };
        },
        acquireExclusiveOperation: () => {
            if (exclusiveOperation) {
                return { ok: false, error: { code: 'progress-operation-active', message: 'Please wait for the progress operation to finish.' } };
            }
            exclusiveOperation = true;
            let released = false;
            return {
                ok: true,
                value: () => {
                    if (!released) {
                        released = true;
                        exclusiveOperation = false;
                    }
                }
            };
        }
    };
};
