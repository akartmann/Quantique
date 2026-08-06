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

export type LectureBookController = Readonly<{
    show: (presentation: LectureBookPresentation) => void;
    hide: () => void;
}>;

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
const CONTROL_WIDTH = 150;
const CONTROL_HEIGHT = 42;
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
export const bookCloseControlCentre = (): Readonly<{ x: number; y: number }> => ({ x: CENTER_X, y: CONTROL_Y });

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

    public readonly controller: LectureBookController = {
        show: (presentation) => this.show(presentation),
        hide: () => this.hide()
    };

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
            duration: 180,
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
        this.drawControl(188, CONTROL_Y, t('book.previous'), presentation.canGoPrevious);
        this.drawControl(512, CONTROL_Y, t('book.close'), true);
        this.drawControl(836, CONTROL_Y, t('book.next'), presentation.canGoNext);
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
        this.drawControl(512, CONTROL_Y, t('book.summary.close'), true);
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
        const background = this.scene.add.rectangle(x, y, 150, 42, enabled ? 0xe7c866 : 0x9aa7a6, enabled ? 1 : 0.55)
            .setStrokeStyle(2, 0x4c5d60);
        // Shrink-to-fit rather than overflow: French control labels run longer than their English
        // counterparts and the button width is fixed by the hit-test geometry below.
        const text = this.scene.add.text(x, y, label, uiTextStyle({
            color: '#10252c', fontSize: '15px', fontStyle: 'bold', align: 'center'
        })).setOrigin(0.5);
        for (let fontSize = 15; fontSize >= 10 && text.width > CONTROL_WIDTH - 16; fontSize -= 1) {
            text.setFontSize(fontSize);
        }
        this.pages?.add([background, text]);
    }

    private activateControl(localX: number, localY: number): void {
        const presentation = this.currentPresentation;
        if (!presentation) return;
        const isWithin = (x: number): boolean => Math.abs(localX - x) <= CONTROL_WIDTH / 2;
        const onRow = (y: number): boolean => Math.abs(localY - y) <= CONTROL_HEIGHT / 2;

        if (this.summaryOpen) {
            if (onRow(CONTROL_Y) && isWithin(512)) {
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
        if (isWithin(188) && presentation.canGoPrevious) presentation.onPrevious();
        else if (isWithin(512)) presentation.onClose();
        else if (isWithin(836) && presentation.canGoNext) presentation.onNext();
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
            duration: 260,
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
            duration: 170,
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
