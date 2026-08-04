import { describe, expect, it } from 'vitest';

import { createInitialAppState, reduceAppState } from '../../src/core/store/AppState';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

const caseDefinition = {
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    }
} as CaseDefinition;

describe('AppState', () => {
    it('keeps authored defaults separate and returns an immutable normalized transition', () => {
        const initial = createInitialAppState(caseDefinition);
        const transition = reduceAppState(initial, {
            type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.23, origin: 'dom'
        });

        expect(initial.activeControlValues.slitSpacingMm).toBe(0.25);
        expect(Object.isFrozen(initial.activeControlValues)).toBe(true);
        expect(transition).toMatchObject({ ok: true, value: { activeControlValues: { slitSpacingMm: 0.25 } } });
        if (transition.ok) {
            expect(Object.isFrozen(transition.value.activeControlValues)).toBe(true);
            expect(transition.value).not.toBe(initial);
        }
    });

    it('preserves state for a recoverable invalid action', () => {
        const initial = createInitialAppState(caseDefinition);
        const transition = reduceAppState(initial, {
            type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: Number.NaN, origin: 'phaser'
        });

        expect(transition).toMatchObject({ ok: false, error: { code: 'invalid-control-value' } });
        expect(initial.activeControlValues.slitSpacingMm).toBe(0.25);
    });
});
