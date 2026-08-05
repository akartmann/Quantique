import type { AppStore } from '../../../core/store/createStore';
import { PhasePlaceholderScene } from './PhasePlaceholderScene';

/** Reference reading during the context phase. Content arrives with Story 2.1 (reuses LectureBookRenderer). */
export class LibraryScene extends PhasePlaceholderScene {
    public constructor(store: AppStore) {
        super('Library', store);
    }
}
