import type { Scene } from 'phaser';

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
    index: number;
    total: number;
    pages: readonly [LectureBookPagePresentation, LectureBookPagePresentation?];
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

export class LectureBookRenderer {
    private overlay?: Phaser.GameObjects.Container;
    private pages?: Phaser.GameObjects.Container;
    private blocker?: Phaser.GameObjects.Rectangle;
    private interactionSurface?: Phaser.GameObjects.Zone;
    private title?: Phaser.GameObjects.Text;
    private source?: Phaser.GameObjects.Text;
    private currentPresentation?: LectureBookPresentation;
    private isClosing = false;
    private readonly resolution = Math.min(window.devicePixelRatio || 1, 2);

    public constructor(
        private readonly scene: Scene,
        private readonly onOverlayVisibilityChange: (visible: boolean) => void
    ) {}

    public readonly controller: LectureBookController = {
        show: (presentation) => this.show(presentation),
        hide: () => this.hide()
    };

    public show(presentation: LectureBookPresentation): void {
        const wasOpen = Boolean(this.overlay);
        const wasClosing = this.isClosing;
        const changedSpread = this.currentPresentation?.index !== presentation.index;
        this.currentPresentation = presentation;
        if (!this.overlay) this.createOverlay();
        const overlay = this.overlay;
        if (!overlay) return;
        this.interactionSurface?.setInteractive({ useHandCursor: true });
        // Opening again during the close tween keeps the existing book rather than letting a stale completion remove it.
        this.scene.tweens.killTweensOf(overlay);
        this.isClosing = false;
        if (wasClosing) overlay.setAlpha(1).setScale(1);
        this.drawSpread(presentation);
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
        this.title = this.scene.add.text(width / 2, 55, '', {
            color: INK, fontFamily: 'Georgia, serif', fontSize: '21px', fontStyle: 'bold', resolution: this.resolution
        }).setOrigin(0.5);
        this.source = this.scene.add.text(width / 2, 85, '', {
            color: '#53626a', fontFamily: 'system-ui', fontSize: '13px', resolution: this.resolution
        }).setOrigin(0.5);
        this.pages = this.scene.add.container(0, 0);
        this.overlay = this.scene.add.container(0, 0, [this.blocker, paper, spine, this.title, this.source, this.pages]);
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
        this.title?.setText(presentation.title);
        this.source?.setText(`${presentation.sourceLabel} · spread ${presentation.index + 1} of ${presentation.total}`);
        this.pages.removeAll(true);
        presentation.pages.forEach((page, pageIndex) => {
            if (page) this.drawPage(page, pageIndex);
        });
        this.drawControl(188, CONTROL_Y, '‹ Previous', presentation.canGoPrevious);
        this.drawControl(512, CONTROL_Y, 'Close book', true);
        this.drawControl(836, CONTROL_Y, 'Next ›', presentation.canGoNext);
    }

    private drawPage(page: LectureBookPagePresentation, pageIndex: number): void {
        const left = PAGE_LEFT_X[pageIndex];
        const heading = this.scene.add.text(left, 166, page.heading, {
            color: INK, fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'bold', resolution: this.resolution,
            wordWrap: { width: PAGE_TEXT_WIDTH }
        });
        const reference = this.scene.add.text(left, 195, `Source page${page.sourcePages.length === 1 ? '' : 's'} ${page.sourcePages.join(', ')}.`, {
            color: '#53626a', fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold', resolution: this.resolution
        });
        const text = this.scene.add.text(left, BODY_TOP_Y, page.paragraphs.join('\n\n'), {
            color: INK, fontFamily: 'Georgia, serif', fontSize: `${MAX_BODY_FONT_SIZE}px`, resolution: this.resolution,
            wordWrap: { width: PAGE_TEXT_WIDTH }
        });
        this.fitBodyText(text);
        const pageNumber = this.scene.add.text(left + (PAGE_TEXT_WIDTH / 2), 635, `Printed page ${page.sourcePages.join(', ')}.`, {
            color: '#53626a', fontFamily: 'Georgia, serif', fontSize: '14px', resolution: this.resolution
        }).setOrigin(0.5);
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
        const text = this.scene.add.text(x, y, label, {
            color: '#10252c', fontFamily: 'system-ui', fontSize: '15px', fontStyle: 'bold', resolution: this.resolution
        }).setOrigin(0.5);
        this.pages?.add([background, text]);
    }

    private activateControl(localX: number, localY: number): void {
        const presentation = this.currentPresentation;
        if (!presentation || Math.abs(localY - CONTROL_Y) > CONTROL_HEIGHT / 2) return;
        const isWithin = (x: number): boolean => Math.abs(localX - x) <= CONTROL_WIDTH / 2;
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
        this.isClosing = false;
        this.onOverlayVisibilityChange(false);
    }

    private prefersReducedMotion(): boolean {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
}
