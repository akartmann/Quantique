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

export class LectureBookRenderer {
    private overlay?: Phaser.GameObjects.Container;
    private pages?: Phaser.GameObjects.Container;
    private blocker?: Phaser.GameObjects.Rectangle;
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
        this.blocker = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x07161a, 0.88)
            .setInteractive({ useHandCursor: false });
        // The blocker is deliberately interactive even where the book has no visible paper.
        this.blocker.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
            event?.stopPropagation();
        });
        const paper = this.scene.add.rectangle(width / 2, height / 2, 850, 610, PAPER).setStrokeStyle(5, 0xc1a973);
        const spine = this.scene.add.rectangle(width / 2, height / 2, 8, 576, 0xb79a65);
        this.title = this.scene.add.text(width / 2, 116, '', {
            color: INK, fontFamily: 'Georgia, serif', fontSize: '21px', fontStyle: 'bold', resolution: this.resolution
        }).setOrigin(0.5);
        this.source = this.scene.add.text(width / 2, 143, '', {
            color: '#53626a', fontFamily: 'system-ui', fontSize: '13px', resolution: this.resolution
        }).setOrigin(0.5);
        this.pages = this.scene.add.container(0, 0);
        this.overlay = this.scene.add.container(0, 0, [this.blocker, paper, spine, this.title, this.source, this.pages]);
        this.overlay.setDepth(10_000);
        this.overlay.setSize(width, height);
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
        this.drawControl(183, 682, '‹ Previous', presentation.canGoPrevious, presentation.onPrevious);
        this.drawControl(512, 682, 'Close book', true, presentation.onClose);
        this.drawControl(724, 682, 'Next ›', presentation.canGoNext, presentation.onNext);
    }

    private drawPage(page: LectureBookPagePresentation, pageIndex: number): void {
        const left = pageIndex === 0 ? 118 : 525;
        const heading = this.scene.add.text(left, 178, page.heading, {
            color: INK, fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'bold', resolution: this.resolution,
            wordWrap: { width: 354 }
        });
        const reference = this.scene.add.text(left, 207, `Source page${page.sourcePages.length === 1 ? '' : 's'} ${page.sourcePages.join(', ')}.`, {
            color: '#53626a', fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold', resolution: this.resolution
        });
        const text = this.scene.add.text(left, 234, page.paragraphs.join('\n\n'), {
            color: INK, fontFamily: 'Georgia, serif', fontSize: '13px', lineSpacing: 3, resolution: this.resolution,
            wordWrap: { width: 354 }
        });
        const pageNumber = this.scene.add.text(left + 170, 642, pageIndex === 0 ? '—' : '—', {
            color: '#53626a', fontFamily: 'Georgia, serif', fontSize: '14px', resolution: this.resolution
        }).setOrigin(0.5);
        this.pages?.add([heading, reference, text, pageNumber]);
    }

    private drawControl(x: number, y: number, label: string, enabled: boolean, callback: () => void): void {
        const background = this.scene.add.rectangle(x, y, 150, 42, enabled ? 0xe7c866 : 0x9aa7a6, enabled ? 1 : 0.55)
            .setStrokeStyle(2, 0x4c5d60);
        const text = this.scene.add.text(x, y, label, {
            color: '#10252c', fontFamily: 'system-ui', fontSize: '15px', fontStyle: 'bold', resolution: this.resolution
        }).setOrigin(0.5);
        if (enabled) {
            background.setInteractive({ useHandCursor: true });
            background.on('pointerup', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
                event?.stopPropagation();
                callback();
            });
        }
        this.pages?.add([background, text]);
    }

    private animateOpen(): void {
        if (!this.overlay) return;
        if (this.prefersReducedMotion()) {
            this.overlay.setAlpha(1).setScale(1);
            return;
        }
        this.overlay.setAlpha(0).setScale(0.84);
        this.scene.tweens.add({ targets: this.overlay, alpha: 1, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
    }

    private animateTurn(): void {
        if (!this.pages || this.prefersReducedMotion()) return;
        this.scene.tweens.killTweensOf(this.pages);
        this.pages.setAlpha(0.2).setX(28).setScale(0.97, 1);
        this.scene.tweens.add({ targets: this.pages, alpha: 1, x: 0, scaleX: 1, duration: 170, ease: 'Sine.easeOut' });
    }

    private destroyOverlay(): void {
        if (!this.overlay) return;
        this.scene.tweens.killTweensOf([this.overlay, this.pages].filter(Boolean));
        this.overlay.destroy(true);
        this.overlay = undefined;
        this.pages = undefined;
        this.blocker = undefined;
        this.title = undefined;
        this.source = undefined;
        this.isClosing = false;
        this.onOverlayVisibilityChange(false);
    }

    private prefersReducedMotion(): boolean {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
}
