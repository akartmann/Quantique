import type { AppStore } from '../../../core/store/createStore';
import { PhasePlaceholderScene } from './PhasePlaceholderScene';

/**
 * Historical debrief and optional replay. The debrief itself arrives with Story 2.11.
 *
 * Until then it is the routing shell, which since Story 2.7 carries the advance affordance — the
 * post-debrief replay was reachable only from a retired DOM panel, and this is the last phase, so
 * without it a finished player has nowhere to go on the canvas at all.
 */
export class DebriefScene extends PhasePlaceholderScene {
    public constructor(store: AppStore, isOverlayVisible: () => boolean = () => false) {
        super('Debrief', store, isOverlayVisible);
    }
}
