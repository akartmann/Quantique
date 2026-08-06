import { expect, test } from '@playwright/test';

import { fr } from '../../src/core/i18n/locales/fr';
import { BOOK_FONT_STACK, FRENCH_GLYPH_SAMPLE, UI_FONT_STACK } from '../../src/adapters/phaser/textStyles';

/**
 * AC4: French renders without missing glyphs or clipping at 1280×720.
 *
 * Measured rather than snapshotted. A screenshot baseline is brittle across CI font rendering, while
 * `CanvasRenderingContext2D.measureText` exercises exactly the text pipeline `Phaser.GameObjects.Text`
 * uses — Phaser draws through the canvas 2D API, so glyph resolution is the browser's, not Phaser's.
 */

// NFR1's viewport target (the 1024×768 canvas is mapped into it by Scale.FIT), and a French browser
// — which is the only way the interface language is chosen.
test.use({ viewport: { width: 1280, height: 720 }, locale: 'fr-FR' });

/** Every French-specific glyph the interface can render, plus the guillemets and the œ ligature. */
const FRENCH_GLYPHS = [...'éèêëàâçîïôûùÿœŒÉÈÊÀÂÇÎÏÔÛÙ«»’—'];

/**
 * Each wrapped Phaser `Text` that holds authored French copy, with the wrap bound and font size
 * declared in the renderer. Phaser word-wrap cannot break inside a word, so a single token wider
 * than its bound is the overflow that actually clips.
 */
const WRAPPED_SURFACES = [
    { key: 'lab.title', font: UI_FONT_STACK, fontSize: 24, wrapWidth: 900 },
    { key: 'lab.guide', font: UI_FONT_STACK, fontSize: 15, wrapWidth: 900 },
    { key: 'lab.result.emptyHint', font: UI_FONT_STACK, fontSize: 19, wrapWidth: 620 },
    { key: 'lab.result.recorded', font: UI_FONT_STACK, fontSize: 19, wrapWidth: 620 },
    { key: 'lab.result.stale', font: UI_FONT_STACK, fontSize: 19, wrapWidth: 620 },
    { key: 'lab.preview', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 620 },
    { key: 'lab.pattern.recorded', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 620 },
    { key: 'lab.guidance', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 620 },
    { key: 'lab.control.readout', font: UI_FONT_STACK, fontSize: 18, wrapWidth: 330 },
    { key: 'book.caption.spread', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 770 },
    { key: 'book.caption.summary', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 770 },
    { key: 'book.summary.heading', font: BOOK_FONT_STACK, fontSize: 20, wrapWidth: 770 },
    { key: 'book.sourcePage.many', font: UI_FONT_STACK, fontSize: 12, wrapWidth: 372 },
    { key: 'book.printedPage', font: BOOK_FONT_STACK, fontSize: 14, wrapWidth: 372 },
    { key: 'book.originalLanguage', font: UI_FONT_STACK, fontSize: 12, wrapWidth: 770 }
] as const;

/** Book controls are a fixed hit-test width and shrink to fit down to 10px before they would clip. */
const BOOK_CONTROLS = ['book.previous', 'book.next', 'book.close', 'book.summary.show', 'book.summary.close'] as const;

type Measurement = Readonly<{ font: string; fontSize: number; text: string }>;

const measure = (page: import('@playwright/test').Page, samples: readonly Measurement[]): Promise<number[]> =>
    page.evaluate((toMeasure) => {
        const context = document.createElement('canvas').getContext('2d');
        if (!context) throw new Error('Canvas 2D is unavailable.');
        return toMeasure.map(({ font, fontSize, text }) => {
            context.font = `${fontSize}px ${font}`;
            return context.measureText(text).width;
        });
    }, samples as unknown as Measurement[]);

test('renders the full French glyph set without tofu at 1280×720', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // U+FFFF is a permanent non-character: it always resolves to the missing-glyph box. A French
    // glyph that measures the same width is being rendered as that same box.
    const [tofuWidth, ...glyphWidths] = await measure(page, [
        { font: UI_FONT_STACK, fontSize: 24, text: '￿' },
        ...FRENCH_GLYPHS.map((glyph) => ({ font: UI_FONT_STACK, fontSize: 24, text: glyph }))
    ]);

    const missing = FRENCH_GLYPHS.filter((_, index) => {
        const width = glyphWidths[index];
        return width === 0 || width === tofuWidth;
    });
    expect(missing).toEqual([]);
});

test('renders the French pangram at a plausible width in both font stacks', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    const [uiWidth, bookWidth, asciiWidth] = await measure(page, [
        { font: UI_FONT_STACK, fontSize: 16, text: FRENCH_GLYPH_SAMPLE },
        { font: BOOK_FONT_STACK, fontSize: 16, text: FRENCH_GLYPH_SAMPLE },
        // A same-length ASCII control. A tofu run measures as a column of identical boxes, which is
        // visibly wider and far more uniform than proportional text.
        { font: UI_FONT_STACK, fontSize: 16, text: 'x'.repeat(FRENCH_GLYPH_SAMPLE.length) }
    ]);

    for (const width of [uiWidth, bookWidth]) {
        expect(width).toBeGreaterThan(FRENCH_GLYPH_SAMPLE.length * 3);
        expect(width).toBeLessThan(asciiWidth * 1.4);
    }
});

test('keeps every French string inside the wrap bound of the surface that holds it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // Interpolation placeholders stand in for runtime values; measuring the widest *token* is what
    // matters, because Phaser word-wrap cannot break inside one.
    const samples = WRAPPED_SURFACES.flatMap(({ key, font, fontSize }) =>
        fr[key].split(/\s+/).filter(Boolean).map((token) => ({ key, font, fontSize, text: token })));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index] }))
        .filter((sample) => {
            const bound = WRAPPED_SURFACES.find(({ key }) => key === sample.key)!.wrapWidth;
            return sample.width > bound;
        })
        .map(({ key, text, width }) => `${key}: "${text}" (${Math.round(width)}px)`);

    expect(overflowing).toEqual([]);
});

test('fits every French book control inside its fixed button width', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // The renderer shrinks a control label from 15px down to 10px before it would clip.
    const MIN_CONTROL_FONT_SIZE = 10;
    const CONTROL_INNER_WIDTH = 134;
    const widths = await measure(page, BOOK_CONTROLS.map((key) => ({
        font: UI_FONT_STACK, fontSize: MIN_CONTROL_FONT_SIZE, text: fr[key]
    })));

    const overflowing = BOOK_CONTROLS
        .map((key, index) => ({ key, width: widths[index] }))
        .filter(({ width }) => width > CONTROL_INNER_WIDTH)
        .map(({ key, width }) => `${key} (${Math.round(width)}px)`);

    expect(overflowing).toEqual([]);
});

test('lays the French boot frame and Curated Record out without horizontal overflow', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();
    await expect(page.getByRole('button', { name: fr['boot.enter'] })).toBeVisible();
    const curatedRecord = page.getByRole('region', { name: fr['curatedRecord.heading'] });
    await expect(curatedRecord.getByRole('heading', { name: fr['curatedRecord.heading'] })).toBeVisible();
    await expect(curatedRecord.getByText(fr['source.marker.primary-material'])).toHaveCount(2);

    const overflows = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows).toBe(false);
});

test('opens the reference book in French and states that its pages are a translation', async ({ page }) => {
    await page.goto('/');

    const record = page.getByRole('region', { name: fr['curatedRecord.heading'] });
    await record.getByRole('button', { name: 'Examiner Référence à l’Opticks' }).click();

    // The DOM attribution block is the readable proof that the book projection resolved in French:
    // `publishLectureBook` builds the book's title, source label, summary and pages from that locale.
    const attribution = page.getByRole('region', { name: 'Young context and prediction' })
        .getByRole('group', { name: 'Lire la référence à l’Opticks — source attribution' });
    await expect(attribution).toBeVisible();
    // Rewritten for the French reader: these pages are a translation, not the transcription.
    await expect(attribution).toContainText('Traduction française réalisée pour ce jeu');
    await expect(attribution).toContainText('la source de référence demeure le texte anglais original');
    // The bibliographic citation of record stays canonical and still points at the English source.
    await expect(attribution.getByRole('link', { name: /archive facsimile/ }))
        .toHaveAttribute('href', 'https://archive.org/details/opticksortreatis1730newt');
    await expect(page.locator('#game-container canvas')).toBeVisible();
});
