import type { AppStore } from '../../core/store/createStore';
import type { PrimaryControl } from '../../domain/cases/CaseDefinition';

export type PhaserStoreAdapter = Readonly<{
    getState: AppStore['getState'];
    setControlValue: (controlId: PrimaryControl['id'], value: number) => ReturnType<AppStore['dispatch']>;
    subscribe: AppStore['subscribe'];
}>;

export const createPhaserStoreAdapter = (store: AppStore): PhaserStoreAdapter => ({
    getState: store.getState,
    setControlValue: (controlId, value) => store.dispatch({
        type: 'apparatus.controlSet',
        controlId,
        value,
        origin: 'phaser'
    }),
    subscribe: store.subscribe
});
