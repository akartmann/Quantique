import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { selectDialogueBeats } from '../../src/core/store/selectors';
import { translate } from '../../src/core/i18n/translate';
import type { Locale } from '../../src/core/i18n/Locale';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import type { CasePhase } from '../../src/domain/cases/CaseProgress';

/**
 * A fixture rather than the shipped case: this is a pure projection, so the interesting inputs are the
 * degraded and empty shapes authored content is validated against ever producing. That the *authored*
 * beats resolve is asserted in `tests/integration/DialogueAndChoice.test.ts`, against `case.json`.
 */
const caseDefinition = {
    id: 'young-interference',
    version: '1.8.0',
    contextualArtifacts: [],
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: { en: 'Slit spacing', fr: 'Écartement des fentes' }, unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: { en: 'Screen distance', fr: 'Distance à l’écran' }, unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    },
    colleagues: [
        { id: 'thea-young', name: 'Dr. Thea Young', role: 'lead', portrait: { kind: 'silhouette', accentColor: '#c9a227' } },
        { id: 'marianne-cole', name: 'Marianne Cole', role: 'analyst', portrait: { kind: 'silhouette', accentColor: '#9c6b98' } }
    ],
    scenarioScript: {
        scenes: [
            { phase: 'context', sceneKey: 'Library' },
            {
                phase: 'prediction',
                sceneKey: 'Colleagues',
                dialogueBeats: [
                    { id: 'framing', speakerId: 'thea-young', text: { en: 'Say what you expect.', fr: 'Dites ce que vous attendez.' } },
                    { id: 'commit', speakerId: 'marianne-cole', text: { en: 'Commit to one now.', fr: 'Engagez-vous dès maintenant.' } }
                ]
            },
            { phase: 'experiment', sceneKey: 'Laboratory' },
            {
                phase: 'synthesis',
                sceneKey: 'TheoryBoard',
                dialogueBeats: [
                    { id: 'four-drafts', speakerId: 'marianne-cole', text: { en: 'Read the limits.', fr: 'Lisez les limites.' } }
                ]
            },
            {
                phase: 'review',
                sceneKey: 'TheoryBoard',
                dialogueBeats: [
                    { id: 'check-wording', speakerId: 'thea-young', text: { en: 'Check the wording.', fr: 'Vérifiez la formulation.' } }
                ]
            },
            { phase: 'debrief', sceneKey: 'Debrief' }
        ]
    }
} as unknown as CaseDefinition;

/**
 * The selector's input, built from the real initial state with the phase moved. Constructing an input
 * is not the same as forging an output: nothing here stands in for `selectDialogueBeats` itself.
 */
const stateAt = (phase: CasePhase, locale: Locale = 'en') =>
    ({ ...createInitialAppState(caseDefinition, locale), phase });

describe('selectDialogueBeats', () => {
    it('returns the beats of the scene mirroring the live phase, attributed and in order', () => {
        expect(selectDialogueBeats(stateAt('prediction'))).toEqual([
            { id: 'framing', speaker: 'Dr. Thea Young — Lead', text: 'Say what you expect.' },
            { id: 'commit', speaker: 'Marianne Cole — Analyst', text: 'Commit to one now.' }
        ]);
    });

    // `TheoryBoard` hosts both, so keying on the scene key rather than the phase would return the
    // wrong conversation for one of them — and always the same one.
    it('distinguishes the two phases that share one scene key', () => {
        expect(selectDialogueBeats(stateAt('synthesis')).map(({ id }) => id)).toEqual(['four-drafts']);
        expect(selectDialogueBeats(stateAt('review')).map(({ id }) => id)).toEqual(['check-wording']);
    });

    it('resolves the authored prose and the role label in the active locale', () => {
        expect(selectDialogueBeats(stateAt('prediction', 'fr'))).toEqual([
            { id: 'framing', speaker: 'Dr. Thea Young — Responsable', text: 'Dites ce que vous attendez.' },
            { id: 'commit', speaker: 'Marianne Cole — Analyste', text: 'Engagez-vous dès maintenant.' }
        ]);
    });

    it.each(['context', 'experiment', 'debrief'] as const)('returns a frozen empty list for %s, which authors none', (phase) => {
        const beats = selectDialogueBeats(stateAt(phase));

        expect(beats).toEqual([]);
        // Frozen and shared, so a caller never has to guard on `undefined` and never mutates a shared list.
        expect(Object.isFrozen(beats)).toBe(true);
        expect(selectDialogueBeats(stateAt(phase))).toBe(beats);
    });

    // Zod rejects this in authored content; the guard is for a degraded cached `case.json`. The
    // two-part template would otherwise print a trailing em dash with nothing after it.
    //
    // The label is the *speaker* fallback, not the proposal-card one: "Unattributed proposal" above a
    // line of spoken prose names the wrong kind of thing, which is what sharing one label for both
    // surfaces produced until the 1.12 review. Asserted by its rendered text rather than its key,
    // because a key assertion would pass with the wrong label wired in.
    it('falls back to the dialogue speaker label, not the proposal label, when a speaker is not in the cast', () => {
        const degraded = {
            ...caseDefinition,
            scenarioScript: {
                scenes: caseDefinition.scenarioScript.scenes.map((scene) => scene.phase === 'prediction'
                    ? { ...scene, dialogueBeats: [{ id: 'orphan', speakerId: 'arthur-bell', text: { en: 'A line.', fr: 'Une réplique.' } }] }
                    : scene)
            }
        } as unknown as CaseDefinition;

        expect(selectDialogueBeats({ ...createInitialAppState(degraded), phase: 'prediction' })).toEqual([
            { id: 'orphan', speaker: 'Unattributed speaker', text: 'A line.' }
        ]);
        // The two fallbacks must stay distinct in both locales. Sharing one is the defect this exists to
        // prevent, and it would read as a passing test the moment the speaker slot borrowed the card's.
        for (const locale of ['en', 'fr'] as const) {
            expect(translate(locale, 'colleague.unattributedSpeaker'))
                .not.toBe(translate(locale, 'colleague.unattributed'));
        }
    });

    it('resolves the French speaker fallback too', () => {
        const degraded = {
            ...caseDefinition,
            scenarioScript: {
                scenes: caseDefinition.scenarioScript.scenes.map((scene) => scene.phase === 'prediction'
                    ? { ...scene, dialogueBeats: [{ id: 'orphan', speakerId: 'arthur-bell', text: { en: 'A line.', fr: 'Une réplique.' } }] }
                    : scene)
            }
        } as unknown as CaseDefinition;

        expect(selectDialogueBeats({ ...createInitialAppState(degraded, 'fr'), phase: 'prediction' })[0].speaker)
            .toBe('Intervenante ou intervenant non identifié');
    });

    // A degraded case can be missing a locale outright. `resolveLocalizedText`'s floor is the English
    // text, never `undefined` — a Phaser `setText(undefined)` would print "undefined" to the player.
    it('falls back to the English prose when the active locale is missing from a beat', () => {
        const degraded = {
            ...caseDefinition,
            scenarioScript: {
                scenes: caseDefinition.scenarioScript.scenes.map((scene) => scene.phase === 'prediction'
                    ? { ...scene, dialogueBeats: [{ id: 'framing', speakerId: 'thea-young', text: { en: 'Say what you expect.' } }] }
                    : scene)
            }
        } as unknown as CaseDefinition;

        expect(selectDialogueBeats({ ...createInitialAppState(degraded, 'fr'), phase: 'prediction' })[0])
            .toEqual({ id: 'framing', speaker: 'Dr. Thea Young — Responsable', text: 'Say what you expect.' });
    });
});
