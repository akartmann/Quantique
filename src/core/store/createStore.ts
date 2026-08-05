import type { Result } from '../errors/Result';
import type { AppAction } from './AppAction';
import { reduceAppState, type AppState } from './AppState';

export type AppStore = Readonly<{
    getState: () => AppState;
    dispatch: (action: AppAction) => Result<void>;
    subscribe: (listener: () => void) => () => void;
    replaceWithValidatedState: (nextState: AppState) => Result<void>;
}>;

export const createStore = (initialState: AppState): AppStore => {
    let state = initialState;
    const listeners = new Set<() => void>();

    return {
        getState: () => state,
        dispatch: (action) => {
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
        replaceWithValidatedState: (nextState) => {
            if (!Object.isFrozen(nextState)) {
                return { ok: false, error: { code: 'invalid-restored-state', message: 'This progress record could not be used. Your current work is unchanged.' } };
            }
            state = nextState;
            listeners.forEach((listener) => listener());
            return { ok: true, value: undefined };
        }
    };
};
