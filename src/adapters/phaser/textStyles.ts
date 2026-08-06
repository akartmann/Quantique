/**
 * Shared Phaser text styling.
 *
 * `Phaser.GameObjects.Text` renders through the canvas 2D text API, so glyph coverage is the
 * browser's font resolution rather than anything Phaser owns: a CSS-style family stack ending in a
 * generic family is the correct mechanism, and no font loader is required.
 *
 * **No downloaded webfont, deliberately.** The families below resolve, on every supported desktop
 * browser and OS, to fonts carrying the full French repertoire — Latin-1 accents, `œ`/`Œ`, and the
 * guillemets `«`/`»`. A font download would add a blocking request against NFR2's cached
 * five-second first interaction and another asset the offline gate has to cover, for coverage the
 * platform already provides. `tests/e2e/french-typography.spec.ts` verifies this rather than
 * assuming it.
 */

/** Every stack ends in a generic family so the browser always has a covering fallback. */
export const UI_FONT_STACK = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const BOOK_FONT_STACK = 'Georgia, "Times New Roman", Times, serif';
export const MONO_FONT_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * A French pangram plus the full diacritic set the interface can render. Exercised by the AC4
 * render check: a tofu run measures visibly differently from correctly resolved glyphs.
 */
export const FRENCH_GLYPH_SAMPLE =
    '« Voilà l’œuvre d’un cœur naïf : à Noël, où l’on fêtait ça. » é è ê ë à â ç î ï ô û ù œ Œ';

/** Capped at 2: beyond that the texture cost outweighs any visible gain on high-DPI displays. */
export const textResolution = (): number => Math.min(window.devicePixelRatio || 1, 2);

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

const withStack = (fontFamily: string) => (style: TextStyle = {}): TextStyle => ({
    fontFamily,
    resolution: textResolution(),
    ...style
});

/** Interface chrome: labels, readouts, controls. */
export const uiTextStyle = withStack(UI_FONT_STACK);

/** Archival book body and headings. */
export const bookTextStyle = withStack(BOOK_FONT_STACK);

/** Development markers only — never player-facing copy. */
export const monoTextStyle = withStack(MONO_FONT_STACK);
