import type { Scene } from 'phaser';

import type { PhaserStoreAdapter } from '../PhaserStoreAdapter';
import type { AppState } from '../../../core/store/AppState';
import { selectFormattedControlValue, selectPrimaryControl } from '../../../core/store/selectors';

export class ApparatusRenderer {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private readout?: Phaser.GameObjects.Text;

    public constructor(
        private readonly scene: Scene,
        private readonly storeAdapter: PhaserStoreAdapter
    ) {}

    public create(): void {
        const title = this.scene.add.text(40, 40, 'Young laboratory surface', {
            color: '#f7f4ef', fontFamily: 'system-ui', fontSize: '28px'
        });
        this.readout = this.scene.add.text(40, 100, '', {
            color: '#f7f4ef', fontFamily: 'system-ui', fontSize: '24px'
        });
        const decrease = this.createButton(300, '−', -1);
        const increase = this.createButton(420, '+', 1);

        this.objects.push(title, this.readout, decrease, increase);
    }

    public render(state: AppState): void {
        if (this.readout) {
            this.readout.setText(`Slit spacing: ${selectFormattedControlValue(state, 'slitSpacingMm')}`);
        }
    }

    public destroy(): void {
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.readout = undefined;
    }

    private createButton(x: number, label: string, direction: -1 | 1): Phaser.GameObjects.Text {
        const button = this.scene.add.text(x, 160, label, {
            backgroundColor: '#f4d35e', color: '#10252c', fontFamily: 'system-ui', fontSize: '32px', padding: { x: 24, y: 12 }
        }).setInteractive({ useHandCursor: true });

        button.on('pointerup', () => {
            const state = this.storeAdapter.getState();
            const control = selectPrimaryControl(state, 'slitSpacingMm');
            this.storeAdapter.setControlValue(control.id, state.activeControlValues[control.id] + (direction * control.step));
        });
        return button;
    }
}
