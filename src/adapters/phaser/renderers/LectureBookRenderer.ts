import type { Scene } from 'phaser';

import { bookTextStyle, uiTextStyle } from '../textStyles';
import type { Locale } from '../../../core/i18n/Locale';
import { createTranslator, type Translator } from '../../../core/i18n/translate';
import type { LocalizedTextualRendition, RenditionLocale } from '../../../domain/cases/CaseDefinition';

export type LectureBookPagePresentation = Readonly<{
    id: string;
    heading: string;
    paragraphs: readonly string[];
    sourcePages: readonly number[];
}>;

/** A visual projection only: semantic UI owns the current spread and all focus behaviour. */
export type LectureBookPresentation = Readonly<{
    title: string;
    sourceLabel: string;
    /** The language these pages are actually in, and whether they transcribe the source or translate it. */
    renditionLocale: RenditionLocale;
    renditionKind: LocalizedTextualRendition['kind'];
    index: number;
    total: number;
    pages: readonly [LectureBookPagePresentation, LectureBookPagePresentation?];
    /** Optional authored one-page overview surfaced via the on-book "Show summary" control. */
    summary?: readonly string[];
    canGoPrevious: boolean;
    canGoNext: boolean;
    onPrevious: () => void;
    onNext: () => void;
    onClose: () => void;
}>;

// `LectureBookController` used to live here: a `{ show, hide }` handle the retired `LectureBookScene`
// passed up to `src/main.ts`, so a DOM panel could drive an overlay scene it could not otherwise
// reach. Story 2.8 retired both ends of that wire — the book is opened by the scene that owns it,
// through `ReferenceBookPresenter`, which calls `show`/`hide` on this renderer directly. The handle
// was left dead by that change, and a dead public API is an invitation to wire the old path back up.

const PAPER = 0xf7f0dd;
const INK = '#28343a';
const PAPER_CENTER_Y = 428;
const PAPER_WIDTH = 890;
const PAPER_HEIGHT = 570;
const PAGE_LEFT_X = [101, 550] as const;
const PAGE_TEXT_WIDTH = 372;
const BODY_TOP_Y = 222;
const BODY_MAX_HEIGHT = 382;
const MAX_BODY_FONT_SIZE = 13;
const MIN_BODY_FONT_SIZE = 8;
const CONTROL_Y = 678;
/**
 * The control row's three x positions, named once.
 *
 * Each was a literal written twice — once in `drawSpread` and once in `activateControl`'s hit test —
 * so the button a player sees and the button a click resolves to were two independent numbers that
 * happened to agree. Same defect as the width triple AC7 is about, one row over.
 */
const CONTROL_PREVIOUS_X = 188;
const CONTROL_CLOSE_X = 512;
const CONTROL_NEXT_X = 836;
const SUMMARY_TOGGLE_X = 848;
const SUMMARY_TOGGLE_Y = 55;
const SUMMARY_TEXT_WIDTH = 760;
const SUMMARY_MAX_HEIGHT = 420;
const CENTER_X = 512;

/**
 * The design-space centre of the book's own close control.
 *
 * Exported so a browser spec can dismiss the overlay without restating the coordinate — the book
 * covers the whole canvas while it is open and legitimately suppresses every control underneath, so
 * closing it is a step in almost every canvas walk. `rival-lab.spec.ts` carried it as a literal;
 * Story 2.7 needed a second copy of it and exported this instead, which is the project's rule ("never
 * assert a magic number that a test shares with source unless both read one exported constant").
 */
export const bookCloseControlCentre = (): Readonly<{ x: number; y: number }> => ({ x: CONTROL_CLOSE_X, y: CONTROL_Y });

/**
 * The page-turn controls, for a spec that needs to prove the book is genuinely open rather than that a
 * click was merely swallowed. Story 2.8's canvas walk pages the book before closing it.
 */
export const bookNextControlCentre = (): Readonly<{ x: number; y: number }> => ({ x: CONTROL_NEXT_X, y: CONTROL_Y });
export const bookPreviousControlCentre = (): Readonly<{ x: number; y: number }> => ({ x: CONTROL_PREVIOUS_X, y: CONTROL_Y });
/** The on-book summary toggle, in its own corner rather than on the control row. */
export const bookSummaryToggleCentre = (): Readonly<{ x: number; y: number }> => ({ x: SUMMARY_TOGGLE_X, y: SUMMARY_TOGGLE_Y });

/**
 * How long the book stays painted after it is asked to close.
 *
 * `isOverlayVisible` stays true for this whole window — **deliberately**, so a click during the fade
 * cannot fall through to the surface still visible underneath it. The scene underneath therefore stays
 * suppressed for the same window, and there is no DOM signal for the moment it lifts.
 *
 * Exported because a browser spec has to wait it out between two canvas acts, and the alternative is a
 * literal in the spec that would silently stop covering the fade the day this number changed. Under
 * `prefers-reduced-motion: reduce` the overlay is destroyed immediately and the wait is only slack.
 */
export const BOOK_CLOSE_FADE_MS = 180;

/**
 * The open and page-turn animations, for the same reason and with the same consequence.
 *
 * Both **disable the book's own interaction surface for their whole duration** — see `animateOpen` and
 * `animateTurn` — so a click landing inside either window does not reach a book control. It is not
 * lost to the scene underneath either: the scene was suppressed before the open tween started and
 * stays suppressed until the close fade finishes, so the click simply does nothing.
 *
 * That is correct behaviour and a player never notices it. A browser spec does: it clicks faster than
 * a person, and without waiting these out its second click silently vanishes and the failure reads as
 * a dead control. Exported so the spec waits on the real numbers rather than on copies of them.
 */
export const BOOK_OPEN_MS = 260;
export const BOOK_TURN_MS = 170;

/**
 * The book's control geometry — **one constant, read by everything that depends on it** (Story 2.8,
 * AC7).
 *
 * These were three numbers that happened to agree: `drawControl` painted a literal `150 × 42`, the
 * label's shrink-to-fit measured against a private `CONTROL_WIDTH - 16`, `activateControl` hit-tested
 * a private `CONTROL_WIDTH / 2`, and `french-typography.spec.ts` carried a fourth copy as
 * `CONTROL_INNER_WIDTH = 134`. The 2.7 review found three tests substituting a different width for the
 * one the board actually drew, for exactly this reason — a private constant leaves a spec no honest
 * way to read it — and `deferred-work.md` has carried the item since 1.1b. Exporting it is the fix;
 * adding a fifth copy would not have been.
 */
export const BOOK_CONTROL_WIDTH = 150;
export const BOOK_CONTROL_HEIGHT = 42;
/** Between the control's edge and its label, on each side. */
export const BOOK_CONTROL_PADDING = 8;
export const BOOK_CONTROL_FONT_SIZE = 15;
/** The smallest the shrink-to-fit will go before it lets a label run wide rather than illegible. */
export const BOOK_CONTROL_MIN_FONT_SIZE = 10;

/**
 * The bound a control label has to fit inside, derived rather than restated.
 *
 * This is what the French whole-string typography check measures against. A label that wraps to two
 * lines inside a fixed-height rectangle clips, which is the defect class the per-token sweep provably
 * cannot catch — so the spec reads this function and the renderer shrinks against it.
 */
export const bookControlLabelWrap = (): number => BOOK_CONTROL_WIDTH - (2 * BOOK_CONTROL_PADDING);

export class LectureBookRenderer {
    private overlay?: Phaser.GameObjects.Container;
    private pages?: Phaser.GameObjects.Container;
    private blocker?: Phaser.GameObjects.Rectangle;
    private interactionSurface?: Phaser.GameObjects.Zone;
    private title?: Phaser.GameObjects.Text;
    private source?: Phaser.GameObjects.Text;
    private originalLanguageNote?: Phaser.GameObjects.Text;
    private currentPresentation?: LectureBookPresentation;
    private isClosing = false;
    private summaryOpen = false;

    public constructor(
        private readonly scene: Scene,
        private readonly onOverlayVisibilityChange: (visible: boolean) => void,
        /** Read at redraw time rather than captured: this overlay never re-runs `create()`. */
        private readonly getLocale: () => Locale = () => 'en'
    ) {}

    private translator(): Translator {
        return createTranslator(this.getLocale());
    }

    /**
     * Whether the book is on screen, closing fade included. `hide` disables the book's own input
     * immediately but keeps the overlay painted for the fade, so anything underneath must stay
     * suppressed until `destroyOverlay` — this stays true for that whole window.
     */
    public get isOverlayVisible(): boolean {
        return Boolean(this.overlay);
    }

    public show(presentation: LectureBookPresentation): void {
        const wasOpen = Boolean(this.overlay);
        const wasClosing = this.isClosing;
        const changedSpread = this.currentPresentation?.index !== presentation.index;
        const changedSource = this.currentPresentation?.sourceLabel !== presentation.sourceLabel;
        this.currentPresentation = presentation;
        if (!this.overlay) this.createOverlay();
        const overlay = this.overlay;
        if (!overlay) return;
        this.interactionSurface?.setInteractive({ useHandCursor: true });
        // Opening again during the close tween keeps the existing book rather than letting a stale completion remove it.
        this.scene.tweens.killTweensOf(overlay);
        this.isClosing = false;
        if (wasClosing) overlay.setAlpha(1).setScale(1);
        // A fresh book, a page turn, or a switch to another source returns to the spread;
        // incidental same-source re-publishes keep the summary open.
        if (!wasOpen || changedSpread || changedSource) this.summaryOpen = false;
        if (this.summaryOpen && presentation.summary?.length) this.drawSummary(presentation);
        else { this.summaryOpen = false; this.drawSpread(presentation); }
        if (!wasOpen) this.animateOpen();
        else if (changedSpread) this.animateTurn();
    }

    public hide(): void {
        if (!this.overlay) return;
        const overlay = this.overlay;
        this.currentPresentation = undefined;
        this.isClosing = true;
        this.interactionSurface?.disableInteractive();
        this.scene.tweens.killTweensOf(overlay);
        if (this.prefersReducedMotion()) {
            this.destroyOverlay();
            return;
        }
        this.scene.tweens.add({
            targets: overlay,
            alpha: 0,
            scaleX: 0.84,
            scaleY: 0.84,
            duration: BOOK_CLOSE_FADE_MS,
            ease: 'Sine.easeIn',
            onComplete: () => this.destroyOverlay()
        });
    }

    public destroy(): void {
        this.scene.tweens.killTweensOf([this.overlay, this.pages].filter(Boolean));
        this.destroyOverlay();
        this.currentPresentation = undefined;
    }

    private createOverlay(): void {
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;
        // The dimmer is passive: apparatus input is gated through onOverlayVisibilityChange,
        // leaving the visible book controls as the only interactive Phaser objects.
        this.blocker = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x07161a, 0.88);
        const paper = this.scene.add.rectangle(width / 2, PAPER_CENTER_Y, PAPER_WIDTH, PAPER_HEIGHT, PAPER).setStrokeStyle(5, 0xc1a973);
        const spine = this.scene.add.rectangle(width / 2, PAPER_CENTER_Y, 8, PAPER_HEIGHT - 34, 0xb79a65);
        // Wrapped, not clipped: a French reader label or spread caption runs longer than its
        // English counterpart and would otherwise overrun the paper edge.
        this.title = this.scene.add.text(width / 2, 55, '', bookTextStyle({
            color: INK, fontSize: '21px', fontStyle: 'bold', align: 'center', wordWrap: { width: PAPER_WIDTH - 120 }
        })).setOrigin(0.5);
        this.source = this.scene.add.text(width / 2, 85, '', uiTextStyle({
            color: '#53626a', fontSize: '13px', align: 'center', wordWrap: { width: PAPER_WIDTH - 120 }
        })).setOrigin(0.5);
        this.originalLanguageNote = this.scene.add.text(width / 2, 108, '', uiTextStyle({
            color: '#7c6a45', fontSize: '12px', fontStyle: 'italic', align: 'center', wordWrap: { width: PAPER_WIDTH - 120 }
        })).setOrigin(0.5);
        this.pages = this.scene.add.container(0, 0);
        this.overlay = this.scene.add.container(0, 0, [this.blocker, paper, spine, this.title, this.source, this.originalLanguageNote, this.pages]);
        this.overlay.setDepth(10_000);
        this.overlay.setSize(width, height);
        // This direct Scene zone has an unambiguous top-left coordinate system. It routes
        // only visible book-button bounds, avoiding Container origin and child-input ordering.
        this.interactionSurface = this.scene.add.zone(width / 2, height / 2, width, height)
            .setDepth(10_001)
            .setInteractive({ useHandCursor: true });
        this.interactionSurface.on('pointerup', (_pointer: Phaser.Input.Pointer, localX: number, localY: number, event?: Phaser.Types.Input.EventData) => {
            event?.stopPropagation();
            this.activateControl(localX, localY);
        });
        this.onOverlayVisibilityChange(true);
    }

    private drawSpread(presentation: LectureBookPresentation): void {
        if (!this.pages || !this.overlay) return;
        const t = this.translator();
        this.title?.setText(presentation.title);
        this.source?.setText(t('book.caption.spread', {
            source: presentation.sourceLabel,
            index: presentation.index + 1,
            total: presentation.total
        }));
        this.pages.removeAll(true);
        presentation.pages.forEach((page, pageIndex) => {
            if (page) this.drawPage(page, pageIndex, t);
        });
        // The reader is never left guessing what these pages are: a translated rendition says so.
        // Only on the spread — the summary beside it is authored copy, so the note would misdescribe
        // it. The schema pins the transcription of record to `en` and requires one rendition per
        // shipped locale, which is what makes `book.translatedRendition`'s "English original"
        // wording true for every rendition that can reach this line.
        this.originalLanguageNote?.setText(presentation.renditionKind === 'translation' ? t('book.translatedRendition') : '');
        this.drawControl(CONTROL_PREVIOUS_X, CONTROL_Y, t('book.previous'), presentation.canGoPrevious);
        this.drawControl(CONTROL_CLOSE_X, CONTROL_Y, t('book.close'), true);
        this.drawControl(CONTROL_NEXT_X, CONTROL_Y, t('book.next'), presentation.canGoNext);
        if (presentation.summary?.length) this.drawControl(SUMMARY_TOGGLE_X, SUMMARY_TOGGLE_Y, t('book.summary.show'), true);
    }

    private drawSummary(presentation: LectureBookPresentation): void {
        if (!this.pages) return;
        const t = this.translator();
        this.title?.setText(presentation.title);
        this.source?.setText(t('book.caption.summary', { source: presentation.sourceLabel }));
        this.originalLanguageNote?.setText('');
        this.pages.removeAll(true);
        // A clean single panel over the paper so the book's centre spine does not cross the summary text.
        const panel = this.scene.add.rectangle(CENTER_X, PAPER_CENTER_Y, PAPER_WIDTH - 40, PAPER_HEIGHT - 30, PAPER);
        this.pages.add(panel);
        const heading = this.scene.add.text(CENTER_X, 166, t('book.summary.heading'), bookTextStyle({
            color: INK, fontSize: '20px', fontStyle: 'bold'
        })).setOrigin(0.5, 0);
        const body = this.scene.add.text(CENTER_X, 214, (presentation.summary ?? []).join('\n\n'), bookTextStyle({
            color: INK, fontSize: '15px', align: 'left', wordWrap: { width: SUMMARY_TEXT_WIDTH }
        })).setOrigin(0.5, 0);
        this.fitSummaryText(body);
        this.pages.add([heading, body]);
        this.drawControl(CONTROL_CLOSE_X, CONTROL_Y, t('book.summary.close'), true);
    }

    private fitSummaryText(text: Phaser.GameObjects.Text): void {
        for (let fontSize = 15; fontSize >= 9; fontSize -= 1) {
            text.setFontSize(fontSize);
            text.setLineSpacing(Math.max(2, Math.round(fontSize * 0.35)));
            if (text.height <= SUMMARY_MAX_HEIGHT) return;
        }
        // Defensive: an unusually long authored summary is clipped rather than spilling over the Close control.
        text.setCrop(0, 0, text.width, SUMMARY_MAX_HEIGHT);
    }

    private drawPage(page: LectureBookPagePresentation, pageIndex: number, t: Translator): void {
        const left = PAGE_LEFT_X[pageIndex];
        const pages = page.sourcePages.join(', ');
        const heading = this.scene.add.text(left, 166, page.heading, bookTextStyle({
            color: INK, fontSize: '18px', fontStyle: 'bold', wordWrap: { width: PAGE_TEXT_WIDTH }
        }));
        const reference = this.scene.add.text(left, 195, t(page.sourcePages.length === 1 ? 'book.sourcePage.one' : 'book.sourcePage.many', { pages }), uiTextStyle({
            color: '#53626a', fontSize: '12px', fontStyle: 'bold', wordWrap: { width: PAGE_TEXT_WIDTH }
        }));
        // The body is the authored rendition for the active locale — the English transcription of
        // record, or the French translation of it. A translated spread carries the
        // `book.translatedRendition` notice above, because a translation is a new sourced artifact:
        // the citation and archive URL still point at the English original (NFR11, FR26, FR27), and
        // the French translation has not been reviewed by a translator or a historian of science.
        const text = this.scene.add.text(left, BODY_TOP_Y, page.paragraphs.join('\n\n'), bookTextStyle({
            color: INK, fontSize: `${MAX_BODY_FONT_SIZE}px`, wordWrap: { width: PAGE_TEXT_WIDTH }
        }));
        this.fitBodyText(text);
        const pageNumber = this.scene.add.text(left + (PAGE_TEXT_WIDTH / 2), 635, t('book.printedPage', { pages }), bookTextStyle({
            color: '#53626a', fontSize: '14px'
        })).setOrigin(0.5);
        this.pages?.add([heading, reference, text, pageNumber]);
    }

    /** Calculates a bounded fitting size only when the authored leaf is redrawn. */
    private fitBodyText(text: Phaser.GameObjects.Text): void {
        for (let fontSize = MAX_BODY_FONT_SIZE; fontSize >= MIN_BODY_FONT_SIZE; fontSize -= 1) {
            text.setFontSize(fontSize);
            text.setLineSpacing(Math.max(1, Math.round(fontSize * 0.2)));
            if (text.height <= BODY_MAX_HEIGHT) return;
        }
    }

    private drawControl(x: number, y: number, label: string, enabled: boolean): void {
        const background = this.scene.add
            .rectangle(x, y, BOOK_CONTROL_WIDTH, BOOK_CONTROL_HEIGHT, enabled ? 0xe7c866 : 0x9aa7a6, enabled ? 1 : 0.55)
            .setStrokeStyle(2, 0x4c5d60);
        // Shrink-to-fit rather than overflow: French control labels run longer than their English
        // counterparts and the button width is fixed by the hit-test geometry below.
        const text = this.scene.add.text(x, y, label, uiTextStyle({
            color: '#10252c', fontSize: `${BOOK_CONTROL_FONT_SIZE}px`, fontStyle: 'bold', align: 'center'
        })).setOrigin(0.5);
        // Starts one step *below* the authored size on purpose. The text is already rendered at
        // `BOOK_CONTROL_FONT_SIZE`, so a first iteration at that size measures the label and then sets
        // the size it already had — a wasted measure and reflow on every control on every redraw, for
        // no possible change. The `text.width` the condition reads is still the measurement at the
        // authored size, so the shrink decision itself is identical.
        for (
            let fontSize = BOOK_CONTROL_FONT_SIZE - 1;
            fontSize >= BOOK_CONTROL_MIN_FONT_SIZE && text.width > bookControlLabelWrap();
            fontSize -= 1
        ) {
            text.setFontSize(fontSize);
        }
        this.pages?.add([background, text]);
    }

    private activateControl(localX: number, localY: number): void {
        const presentation = this.currentPresentation;
        if (!presentation) return;
        const isWithin = (x: number): boolean => Math.abs(localX - x) <= BOOK_CONTROL_WIDTH / 2;
        const onRow = (y: number): boolean => Math.abs(localY - y) <= BOOK_CONTROL_HEIGHT / 2;

        if (this.summaryOpen) {
            if (onRow(CONTROL_Y) && isWithin(CONTROL_CLOSE_X)) {
                this.summaryOpen = false;
                this.drawSpread(presentation);
            }
            return;
        }

        if (presentation.summary?.length && onRow(SUMMARY_TOGGLE_Y) && isWithin(SUMMARY_TOGGLE_X)) {
            this.summaryOpen = true;
            this.drawSummary(presentation);
            return;
        }

        if (!onRow(CONTROL_Y)) return;
        if (isWithin(CONTROL_PREVIOUS_X) && presentation.canGoPrevious) presentation.onPrevious();
        else if (isWithin(CONTROL_CLOSE_X)) presentation.onClose();
        else if (isWithin(CONTROL_NEXT_X) && presentation.canGoNext) presentation.onNext();
    }

    private animateOpen(): void {
        if (!this.overlay) return;
        this.interactionSurface?.disableInteractive();
        if (this.prefersReducedMotion()) {
            this.overlay.setAlpha(1).setScale(1);
            this.interactionSurface?.setInteractive({ useHandCursor: true });
            return;
        }
        this.overlay.setAlpha(0).setScale(0.84);
        this.scene.tweens.add({
            targets: this.overlay,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: BOOK_OPEN_MS,
            ease: 'Back.easeOut',
            onComplete: () => this.interactionSurface?.setInteractive({ useHandCursor: true })
        });
    }

    private animateTurn(): void {
        if (!this.pages || this.prefersReducedMotion()) return;
        this.interactionSurface?.disableInteractive();
        this.scene.tweens.killTweensOf(this.pages);
        this.pages.setAlpha(0.2).setX(28).setScale(0.97, 1);
        this.scene.tweens.add({
            targets: this.pages,
            alpha: 1,
            x: 0,
            scaleX: 1,
            duration: BOOK_TURN_MS,
            ease: 'Sine.easeOut',
            onComplete: () => this.interactionSurface?.setInteractive({ useHandCursor: true })
        });
    }

    private destroyOverlay(): void {
        if (!this.overlay) return;
        this.scene.tweens.killTweensOf([this.overlay, this.pages].filter(Boolean));
        this.overlay.destroy(true);
        this.interactionSurface?.destroy();
        this.overlay = undefined;
        this.pages = undefined;
        this.blocker = undefined;
        this.interactionSurface = undefined;
        this.title = undefined;
        this.source = undefined;
        this.originalLanguageNote = undefined;
        this.isClosing = false;
        this.summaryOpen = false;
        this.onOverlayVisibilityChange(false);
    }

    private prefersReducedMotion(): boolean {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
}
