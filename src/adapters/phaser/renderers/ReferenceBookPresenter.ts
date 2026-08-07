import type { Scene } from 'phaser';

import type { Locale } from '../../../core/i18n/Locale';
import { resolveLocalizedText, resolveLocalizedTextList, resolveRendition } from '../../../core/i18n/resolveLocalizedText';
import type { ContextualArtifact, LocalizedTextualRendition } from '../../../domain/cases/CaseDefinition';
import { getLectureSpread, paginateLectureRendition, type LecturePagination } from '../../../domain/cases/lecturePagination';
import { LectureBookRenderer } from './LectureBookRenderer';

/**
 * The reference book, owned by the scene the player is standing in (Story 2.8).
 *
 * ## Why this exists, and what it replaces
 *
 * The book used to be an always-running `LectureBookScene` registered above every routed scene, driven
 * from a retired DOM panel, suppressing input by calling `laboratoryScene.setApparatusInputEnabled(...)`
 * across a scene boundary. That reach-in is the coupling `project-context.md` names as a story-owned
 * deferral, and AC6 closes it. What replaces it is one presenter per scene that can host a book —
 * `LibraryScene` and `LaboratoryScene` — so there is no un-routed scene and no scene reaching into
 * another. Everything cross-cutting (the artifacts, the locale, what has been inspected) comes from
 * the store; the owning scene suppresses its *own* input from its *own* presenter.
 *
 * ## What is ephemeral, and why it is not in the store
 *
 * Which spread is open is widget-local and lives here, exactly as `DialogueBox`'s beat index does and
 * for the reason that widget's own docstring gives: reading, paging, and closing never inspect
 * evidence or alter progression, so a page number in `AppState` would be persisted, exported,
 * re-validated, and reset on replay — for a value that means nothing five seconds later. The
 * inspection *record* is store state and is dispatched by the scene; the page you are on is not.
 *
 * ## Locale
 *
 * `getLocale` is a **live read supplied by the owning scene**, never a captured value and never an
 * optional parameter with an English default — the project rule exists because a defaulted locale
 * turns a forgotten call site from a compile error into a French player silently reading English.
 * Every string the book shows is locale-derived (the chrome, the reader label, the source label, the
 * summary, the translated-rendition notice), so {@link render} re-publishes the whole presentation and
 * a scene calls it from its store subscription.
 *
 * The *rendition* is re-resolved on every publish too, so a locale change mid-read moves the reader to
 * that language's rendition rather than leaving them on the one they opened. The schema pins the two
 * page-for-page, so the spread index carries across the switch unchanged.
 */
export class ReferenceBookPresenter {
    private renderer?: LectureBookRenderer;
    private artifact?: ContextualArtifact;
    private rendition?: LocalizedTextualRendition;
    private pagination?: LecturePagination;
    private spreadIndex = 0;

    /**
     * @param getLocale Read on every publish and on every chrome redraw inside the book. Required,
     * with no default, for the reason stated above.
     * @param onVisibilityChange Fired when the book appears and when its closing fade finishes. The
     * owning scene suppresses its own input from this — an *intra*-scene call, never a reach into
     * another scene.
     */
    public constructor(
        private readonly scene: Scene,
        private readonly getLocale: () => Locale,
        private readonly onVisibilityChange: (visible: boolean) => void
    ) {}

    public create(): void {
        this.renderer = new LectureBookRenderer(this.scene, this.onVisibilityChange, this.getLocale);
    }

    /**
     * Whether the book is on screen, **closing fade included**.
     *
     * `LectureBookRenderer.hide()` disables the book's own input immediately but keeps the overlay
     * painted for the 180ms fade, deliberately — so a scene underneath must stay suppressed for that
     * whole window, not merely until the close was requested.
     */
    public get isOpen(): boolean {
        return this.renderer?.isOverlayVisible ?? false;
    }

    /** The artifact currently open, so a caller can tell a re-open from a switch to another one. */
    public get openArtifactId(): string | undefined {
        return this.artifact?.id;
    }

    /**
     * Opens an artifact at its first spread.
     *
     * Returns `false` when the artifact carries no rendition to read. Nothing is opened and nothing
     * changes; the caller decides what to say about it, because "this one cannot be read" is
     * player-facing copy and a renderer does not author it.
     */
    public open(artifact: ContextualArtifact): boolean {
        if (!artifact.textualRendition) return false;
        this.artifact = artifact;
        this.spreadIndex = 0;
        this.publish();
        return true;
    }

    public close(): void {
        this.artifact = undefined;
        this.rendition = undefined;
        this.pagination = undefined;
        this.spreadIndex = 0;
        this.renderer?.hide();
    }

    /**
     * Re-publishes the open book for the live locale.
     *
     * A no-op when nothing is open, so a scene can call it unconditionally from its store subscription
     * rather than guarding at every call site.
     */
    public render(): void {
        if (!this.artifact) return;
        this.publish();
    }

    public destroy(): void {
        this.renderer?.destroy();
        this.renderer = undefined;
        this.artifact = undefined;
        this.rendition = undefined;
        this.pagination = undefined;
        this.spreadIndex = 0;
    }

    private moveSpread(direction: -1 | 1): void {
        if (!this.pagination) return;
        const spread = getLectureSpread(this.pagination, this.spreadIndex + direction);
        if (spread.index === this.spreadIndex) return;
        this.spreadIndex = spread.index;
        this.publish();
    }

    private publish(): void {
        const artifact = this.artifact;
        const textualRendition = artifact?.textualRendition;
        if (!artifact || !textualRendition || !this.renderer) return;
        const locale = this.getLocale();
        this.rendition = resolveRendition(textualRendition, locale);
        this.pagination = paginateLectureRendition(this.rendition);
        const spread = getLectureSpread(this.pagination, this.spreadIndex);
        // Read back from the spread rather than trusted: `getLectureSpread` clamps, and a rendition
        // with fewer spreads than the one just closed would otherwise leave a stale index behind.
        this.spreadIndex = spread.index;

        this.renderer.show({
            title: resolveLocalizedText(textualRendition.readerLabel, locale),
            sourceLabel: resolveLocalizedText(artifact.displayName, locale),
            renditionLocale: this.rendition.locale,
            renditionKind: this.rendition.kind,
            index: spread.index,
            total: spread.total,
            pages: spread.pages,
            summary: textualRendition.summary && resolveLocalizedTextList(textualRendition.summary, locale),
            canGoPrevious: spread.canGoPrevious,
            canGoNext: spread.canGoNext,
            onPrevious: () => this.moveSpread(-1),
            onNext: () => this.moveSpread(1),
            onClose: () => this.close()
        });
    }
}
