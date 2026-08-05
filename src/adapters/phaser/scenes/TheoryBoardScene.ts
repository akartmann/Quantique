import type { AppStore } from '../../../core/store/createStore';
import { PhasePlaceholderScene } from './PhasePlaceholderScene';

/**
 * Hosts both synthesis (locked conclusion + colleague hints) and review (conclusion choice).
 * Content arrives with the Story 1.6 rework / 2.3.
 */
export class TheoryBoardScene extends PhasePlaceholderScene {
    public constructor(store: AppStore) {
        super('TheoryBoard', store);
    }
}
