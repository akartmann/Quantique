import type { AppStore } from '../../../core/store/createStore';
import { PhasePlaceholderScene } from './PhasePlaceholderScene';

/** Prediction proposals from the colleague cast. Content arrives with Story 1.11. */
export class ColleaguesScene extends PhasePlaceholderScene {
    public constructor(store: AppStore) {
        super('Colleagues', store);
    }
}
