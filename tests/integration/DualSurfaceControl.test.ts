import { describe, expect, it } from 'vitest';

import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectFormattedControlValue } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { dispatchControlValueFromDom } from '../../src/ui/apparatus/ApparatusControls';

const caseDefinition: CaseDefinition = {
    id: 'young-interference',
    version: '1.0.0',
    openingDispute: 'A dispute',
    contextualArtifacts: [
        {
            id: 'record', displayName: 'Record', creatorOrOrigin: 'Archive', sourceType: 'lecture-record',
            provenance: { category: 'primary-material', reference: 'record' }, rightsStatus: 'reviewed', caseRelationship: 'Context.'
        },
        {
            id: 'reference', displayName: 'Reference', creatorOrOrigin: 'Archive', sourceType: 'published-book',
            provenance: { category: 'primary-material', reference: 'reference' }, rightsStatus: 'reviewed', caseRelationship: 'Context.'
        }
    ],
    prediction: { required: true },
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    },
    experiment: {
        modelVersion: 'young-double-slit-v1',
        wavelengthNm: 550,
        assumptions: [],
        confound: { id: 'confound', description: 'A confound', discoverableBy: 'replication' },
        resetPath: { recoveryRoute: 'replication', description: 'Recover.' }
    },
    requirements: { minimumRuns: 2, minimumSources: 2 },
    flow: { openingDispute: true, curatedRecord: true, labSetup: true, minimumExperimentCycles: 2, maximumExperimentCycles: 4, theoryBoardReview: true, historicalDebrief: true, optionalReplay: true },
    debrief: { summary: 'Compare evidence.', sourceRefs: ['record'] },
    assets: { manifestVersion: '1.0.0', entries: [] }
};

describe('dual-surface apparatus control', () => {
    it('leaves the same authoritative state and formatted readout after DOM and Phaser intents', () => {
        const initialState = createInitialAppState(caseDefinition);
        const domStore = createStore(initialState);
        const phaserStore = createStore(initialState);

        expect(dispatchControlValueFromDom(domStore, 'slitSpacingMm', 0.23)).toEqual({ ok: true, value: undefined });
        expect(createPhaserStoreAdapter(phaserStore).setControlValue('slitSpacingMm', 0.23)).toEqual({ ok: true, value: undefined });

        expect(domStore.getState()).toEqual(phaserStore.getState());
        expect(selectFormattedControlValue(domStore.getState(), 'slitSpacingMm')).toBe('0.25 mm');
        expect(selectFormattedControlValue(phaserStore.getState(), 'slitSpacingMm')).toBe('0.25 mm');
    });
});
