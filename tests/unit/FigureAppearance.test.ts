import { describe, expect, it } from 'vitest';

import {
    garmentTones,
    resolveFigureAppearance,
    shade,
    tint
} from '../../src/adapters/phaser/renderers/figureAppearance';
import type { ColleagueRole } from '../../src/domain/cases/ColleagueCast';

/**
 * The appearance resolver — the half of the character design that can be asserted without a browser
 * (Story 2.9, design revision of 2026-08-07).
 *
 * Everything here is a pure function over a closed vocabulary, which is the whole reason the palette
 * and the defaults were pulled out of `CharacterStage` in the first place: that file imports Phaser,
 * Phaser touches `window` at import time, and Vitest runs in Node. What is under test is that a case
 * authoring nothing still gets four people who differ, that authored values win, and that the four
 * tones one garment is drawn in are ordered the way cloth is lit.
 */

const luminance = (color: number): number =>
    (0.2126 * ((color >> 16) & 0xff)) + (0.7152 * ((color >> 8) & 0xff)) + (0.0722 * (color & 0xff));

describe('resolveFigureAppearance', () => {
    /**
     * The claim that makes the authored block optional rather than required.
     *
     * A case may ship a cast with no `figure` at all — every case written before this vocabulary
     * existed did — and the four roles still have to produce four readable people. The poses are the
     * part a role can honestly imply; build, hair and face are not, and the next test pins that.
     */
    it('gives each role a pose of its own when a case authors nothing', () => {
        const roles: readonly ColleagueRole[] = ['lead', 'builder', 'analyst', 'communicator'];
        const poses = roles.map((role) => resolveFigureAppearance(role).pose);

        expect(poses).toEqual(['raising-instrument', 'holding-paper', 'holding-paper', 'presenting']);
    });

    /**
     * What a role must **not** imply.
     *
     * There is nothing about being an analyst that implies a gown, and inferring a figure's
     * presentation from their role — or, worse, from their name — is how a named character gets drawn
     * wrong. An unauthored figure is suited with cropped hair and a bare face, whatever their job.
     */
    it('never infers build, hair or face from a role', () => {
        const roles: readonly ColleagueRole[] = ['lead', 'builder', 'analyst', 'communicator'];

        roles.forEach((role) => {
            const appearance = resolveFigureAppearance(role);
            expect(appearance.build).toBe('suited');
            expect(appearance.hair).toBe('cropped');
            expect(appearance.spectacles).toBe(false);
            expect(appearance.moustache).toBe(false);
        });
    });

    it('lets an authored figure override every default, including the role-derived pose', () => {
        const appearance = resolveFigureAppearance('analyst', {
            build: 'gowned',
            pose: 'raising-instrument',
            hair: 'upswept',
            hairColor: 'auburn',
            skinTone: 'brown',
            spectacles: true,
            moustache: false
        });

        expect(appearance.build).toBe('gowned');
        expect(appearance.pose).toBe('raising-instrument');
        expect(appearance.hair).toBe('upswept');
        expect(appearance.spectacles).toBe(true);
        expect(appearance.hairColor).toBe(resolveFigureAppearance('lead', { hairColor: 'auburn' }).hairColor);
    });

    /** A partial block is honoured field by field: authoring a moustache does not reset the pose. */
    it('fills only the fields a partial figure leaves out', () => {
        const appearance = resolveFigureAppearance('communicator', { moustache: true });

        expect(appearance.moustache).toBe(true);
        expect(appearance.pose).toBe('presenting');
        expect(appearance.build).toBe('suited');
    });

    /**
     * The rival is resolved through `'rival'`, which is deliberately **not** a `ColleagueRole`.
     *
     * He holds no role on the team and nothing may treat him as a member of it (AC4). Folded arms is
     * the default that falls out of that: the one posture on the stage that reads as judgement rather
     * than work, and one no colleague's role produces.
     */
    it('stands the rival with his arms folded, a pose no role yields', () => {
        const roles: readonly ColleagueRole[] = ['lead', 'builder', 'analyst', 'communicator'];

        expect(resolveFigureAppearance('rival').pose).toBe('arms-folded');
        expect(roles.map((role) => resolveFigureAppearance(role).pose)).not.toContain('arms-folded');
    });

    /** Four tones apart, so a stage of four never has two heads the same colour by accident. */
    it('maps the hair and skin ramps to four distinct tones each', () => {
        const hair = (['dark', 'auburn', 'fair', 'grey'] as const)
            .map((hairColor) => resolveFigureAppearance('lead', { hairColor }).hairColor);
        const skin = (['light', 'tan', 'brown', 'deep'] as const)
            .map((skinTone) => resolveFigureAppearance('lead', { skinTone }).skinTone);

        expect(new Set(hair).size).toBe(4);
        expect(new Set(skin).size).toBe(4);
    });
});

describe('garmentTones', () => {
    /**
     * The ordering that makes a garment read as cloth rather than as a cut-out.
     *
     * Trousers below the coat, the coat below its lit edge, the lit edge below the linen. Asserted as
     * an ordering rather than as four literals because the point is the *relationship*: a future
     * adjustment to any one constant is free, and an adjustment that puts the highlight under the
     * shadow is a defect this catches.
     */
    it('orders the four tones from trousers to linen', () => {
        const tones = garmentTones(0x4f8a8b);

        expect(luminance(tones.deep)).toBeLessThan(luminance(tones.base));
        expect(luminance(tones.base)).toBeLessThan(luminance(tones.highlight));
        expect(luminance(tones.highlight)).toBeLessThan(luminance(tones.linen));
    });

    /** Every authored accent gets that ordering, not just the four this case happens to ship. */
    it.each([0x000000, 0xffffff, 0xc9a227, 0x9c6b98, 0x8c3b3b, 0x0000ff])(
        'holds the ordering for #%s',
        (accent) => {
            const tones = garmentTones(accent);
            expect(luminance(tones.deep)).toBeLessThanOrEqual(luminance(tones.base));
            expect(luminance(tones.base)).toBeLessThanOrEqual(luminance(tones.highlight));
            expect(luminance(tones.highlight)).toBeLessThanOrEqual(luminance(tones.linen));
        }
    );

    /**
     * Channels are mixed and clamped, never added.
     *
     * `colour + 0x101010` is the version of this that looks correct on four authored accents and turns
     * the fifth bright green, because a channel already near 0xff carries into the one above it. Pure
     * white tinted further is still a colour, and pure black shaded further is still black.
     */
    it('clamps rather than wrapping at the ends of each channel', () => {
        expect(tint(0xffffff, 1)).toBeLessThanOrEqual(0xffffff);
        expect(shade(0x000000, 1)).toBeGreaterThanOrEqual(0);
        // The green channel of `#00ff00` pushed to its ceiling must not spill into red.
        expect((tint(0x00ff00, 1) >> 16) & 0xff).toBeLessThanOrEqual(0xff);
    });
});
