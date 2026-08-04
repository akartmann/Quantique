import type { Result } from '../errors/Result';
import type { AppAction } from './AppAction';
import { reduceAppState, type AppState } from './AppState';

export type AppStore = Readonly<{
    getState: () => AppState;
    dispatch: (action: AppAction) => Result<void>;
    subscribe: (listener: () => void) => () => void;
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
        }
    };
};
