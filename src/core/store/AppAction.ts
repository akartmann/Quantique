import type { PrimaryControl } from '../../domain/cases/CaseDefinition';

export type ApparatusControlSetAction = Readonly<{
    type: 'apparatus.controlSet';
    controlId: PrimaryControl['id'];
    value: number;
    origin: 'dom' | 'phaser';
}>;

export type AppAction = ApparatusControlSetAction;
