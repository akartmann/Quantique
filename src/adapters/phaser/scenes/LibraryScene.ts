import type { AppStore } from '../../../core/store/createStore';
import { PhasePlaceholderScene } from './PhasePlaceholderScene';

/**
 * Reference reading during the context phase. The reading room arrives with Story 2.8.
 *
 * Until then it is the routing shell, which since Story 2.7 carries the advance affordance —
 * `context → prediction` was reachable only from a retired DOM panel, and the shell is where the
 * player is standing when they need it.
 */
export class LibraryScene extends PhasePlaceholderScene {
    public constructor(store: AppStore, isOverlayVisible: () => boolean = () => false) {
        super('Library', store, isOverlayVisible);
    }
}
