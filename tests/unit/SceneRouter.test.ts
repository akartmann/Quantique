import { describe, expect, it } from 'vitest';

import { resolveSceneKey } from '../../src/adapters/phaser/SceneRouter';
import { CASE_PHASES } from '../../src/domain/cases/CaseProgress';
import type { ScenarioScript } from '../../src/domain/cases/ScenarioScript';

const youngScript: ScenarioScript = {
    scenes: [
        { phase: 'context', sceneKey: 'Library' },
        { phase: 'prediction', sceneKey: 'Colleagues' },
        { phase: 'experiment', sceneKey: 'Laboratory' },
        { phase: 'synthesis', sceneKey: 'TheoryBoard' },
        { phase: 'review', sceneKey: 'TheoryBoard' },
        { phase: 'debrief', sceneKey: 'Debrief' }
    ]
};

describe('resolveSceneKey', () => {
    it.each([
        ['context', 'Library'],
        ['prediction', 'Colleagues'],
        ['experiment', 'Laboratory'],
        ['synthesis', 'TheoryBoard'],
        ['review', 'TheoryBoard'],
        ['debrief', 'Debrief']
    ] as const)('maps the %s phase to the authored %s scene', (phase, sceneKey) => {
        expect(resolveSceneKey(youngScript, phase)).toBe(sceneKey);
    });

    it('resolves every case phase, so the authored map is total', () => {
        expect(CASE_PHASES.map((phase) => resolveSceneKey(youngScript, phase))).toHaveLength(CASE_PHASES.length);
    });

    it('reads the scene from the script rather than a hardcoded map', () => {
        const alternativeScript: ScenarioScript = {
            scenes: youngScript.scenes.map((scene) => scene.phase === 'synthesis' ? { ...scene, sceneKey: 'Laboratory' } : scene)
        };

        expect(resolveSceneKey(alternativeScript, 'synthesis')).toBe('Laboratory');
    });

    it('reports an uncovered phase instead of silently routing nowhere', () => {
        const incompleteScript = { scenes: youngScript.scenes.filter(({ phase }) => phase !== 'debrief') };

        expect(() => resolveSceneKey(incompleteScript, 'debrief')).toThrow(/debrief/);
    });
});
