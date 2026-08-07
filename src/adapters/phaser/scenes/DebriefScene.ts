import type { AppStore } from '../../../core/store/createStore';
import { PhasePlaceholderScene } from './PhasePlaceholderScene';

/**
 * Historical debrief and optional replay. The debrief itself arrives with Story 2.11.
 *
 * Until then it is the routing shell, which since Story 2.7 carries the advance affordance — the
 * post-debrief replay was reachable only from a retired DOM panel, and this is the last phase, so
 * without it a finished player has nowhere to go on the canvas at all.
 *
 * **It is the last subclass of that shell.** Story 2.8 gave the library a real reading room; 2.11
 * gives this one a real debrief, and deletes `PhasePlaceholderScene` with it.
 */
export class DebriefScene extends PhasePlaceholderScene {
    public constructor(store: AppStore) {
        super('Debrief', store);
    }
}
