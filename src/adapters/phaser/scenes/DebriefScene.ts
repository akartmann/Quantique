import type { AppStore } from '../../../core/store/createStore';
import { PhasePlaceholderScene } from './PhasePlaceholderScene';

/** Historical debrief and optional replay. Content arrives with Story 2.3. */
export class DebriefScene extends PhasePlaceholderScene {
    public constructor(store: AppStore) {
        super('Debrief', store);
    }
}
