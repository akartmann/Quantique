import type { PrimaryControl } from '../../domain/cases/CaseDefinition';
import type { RunRecord } from '../../domain/evidence/RunRecord';

export type ApparatusControlSetAction = Readonly<{
    type: 'apparatus.controlSet';
    controlId: PrimaryControl['id'];
    value: number;
    origin: 'dom' | 'phaser';
}>;

export type RunRecordAction = Readonly<{
    type: 'run.record';
    record: RunRecord;
}>;

export type ComparisonRunSelectAction = Readonly<{
    type: 'comparison.runSelected';
    runId: string;
}>;

export type ComparisonRunUnselectAction = Readonly<{
    type: 'comparison.runUnselected';
    runId: string;
}>;

export type ComparisonNoteSaveAction = Readonly<{
    type: 'comparison.noteSaved';
    note: string;
}>;

export type SourceInspectedAction = Readonly<{
    type: 'source.inspected';
    sourceId: string;
}>;

export type AppAction = ApparatusControlSetAction
    | RunRecordAction
    | ComparisonRunSelectAction
    | ComparisonRunUnselectAction
    | ComparisonNoteSaveAction
    | SourceInspectedAction;
