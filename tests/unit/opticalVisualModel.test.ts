import { describe, expect, it } from 'vitest';

import { interferenceIntensity, rgbToInt, wavelengthToRgb } from '../../src/domain/apparatus/opticalVisualModel';

const dominantChannel = (nm: number): 'r' | 'g' | 'b' => {
    const { r, g, b } = wavelengthToRgb(nm);
    if (r >= g && r >= b) return 'r';
    if (g >= r && g >= b) return 'g';
    return 'b';
};

describe('wavelengthToRgb', () => {
    it('maps the three laboratory wavelengths to blue, green, and red regions', () => {
        expect(dominantChannel(450)).toBe('b');
        expect(dominantChannel(550)).toBe('g');
        expect(dominantChannel(650)).toBe('r');
    });

    it('shifts hue from blue-dominant to red-dominant across the range', () => {
        const blue = wavelengthToRgb(450);
        const red = wavelengthToRgb(650);
        expect(blue.b).toBeGreaterThan(red.b);
        expect(red.r).toBeGreaterThan(blue.r);
    });

    it('increases the red channel and decreases the blue channel monotonically from 450 nm upward', () => {
        // Below ~440 nm the violet region legitimately regains a red component, so monotonicity
        // is asserted across the laboratory's range (450 nm and up), not the full visible band.
        const samples = [450, 500, 550, 600, 650, 700].map(wavelengthToRgb);
        for (let i = 1; i < samples.length; i += 1) {
            expect(samples[i].r).toBeGreaterThanOrEqual(samples[i - 1].r);
            expect(samples[i].b).toBeLessThanOrEqual(samples[i - 1].b);
        }
    });

    it('clamps out-of-range wavelengths to the nearest visible bound rather than returning black', () => {
        expect(wavelengthToRgb(200)).toEqual(wavelengthToRgb(380));
        expect(wavelengthToRgb(2000)).toEqual(wavelengthToRgb(780));
        const belowRange = wavelengthToRgb(200);
        expect(belowRange.r + belowRange.g + belowRange.b).toBeGreaterThan(0);
    });

    it('produces channel values within 0–255 that pack into a 24-bit colour', () => {
        for (const nm of [380, 450, 510, 550, 650, 780]) {
            const rgb = wavelengthToRgb(nm);
            for (const channel of [rgb.r, rgb.g, rgb.b]) {
                expect(channel).toBeGreaterThanOrEqual(0);
                expect(channel).toBeLessThanOrEqual(255);
            }
            const packed = rgbToInt(rgb);
            expect(packed).toBeGreaterThanOrEqual(0);
            expect(packed).toBeLessThanOrEqual(0xffffff);
        }
    });
});

describe('interferenceIntensity', () => {
    it('is exactly the maximum brightness at the pattern centre', () => {
        expect(interferenceIntensity(0, 20, 120)).toBe(1);
    });

    it('stays within [0, 1] across the sampled screen', () => {
        for (let offset = -120; offset <= 120; offset += 1) {
            const value = interferenceIntensity(offset, 20, 120);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        }
    });

    it('places local maxima at integer multiples of the fringe spacing', () => {
        const spacing = 20;
        const envelope = 400; // wide envelope so the two-slit term dominates
        const atFringe = interferenceIntensity(spacing, spacing, envelope);
        const betweenFringes = interferenceIntensity(spacing / 2, spacing, envelope);
        expect(atFringe).toBeGreaterThan(betweenFringes);
        expect(betweenFringes).toBeLessThan(0.05);
    });

    it('makes the central maximum brighter than outer maxima via the diffraction envelope', () => {
        const spacing = 20;
        const envelope = 60;
        const centre = interferenceIntensity(0, spacing, envelope);
        const thirdOrder = interferenceIntensity(spacing * 3, spacing, envelope);
        expect(centre).toBeGreaterThan(thirdOrder);
    });

    it('returns 0 for non-physical spacing or envelope inputs instead of NaN', () => {
        expect(interferenceIntensity(5, 0, 120)).toBe(0);
        expect(interferenceIntensity(5, -20, 120)).toBe(0);
        expect(interferenceIntensity(5, 20, 0)).toBe(0);
        expect(interferenceIntensity(Number.NaN, 20, 120)).toBe(0);
    });
});
