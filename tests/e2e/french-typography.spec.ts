import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { fr } from '../../src/core/i18n/locales/fr';
import { BOOK_FONT_STACK, FRENCH_GLYPH_SAMPLE, UI_FONT_STACK } from '../../src/adapters/phaser/textStyles';
import {
    BOARD_TEXT_WRAP,
    PROPOSAL_SURFACE_WIDTH,
    SUBMIT_CONTROL_FONT_SIZE,
    SUBMIT_CONTROL_LABEL_WRAP
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
// From `apparatusGeometry`, not `ApparatusRenderer`: that renderer imports Phaser as a *value*
// (`BlendModes`), Phaser touches `window` at import time, and these specs run in Node.
import {
    ADVANCE_CONTROL_FONT_SIZE,
    ADVANCE_CONTROL_LABEL_WRAP,
    HINT_LINE_FONT_SIZE,
    HINT_SPEAKER_FONT_SIZE,
    HINT_TEXT_WRAP
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { advanceControlLabelWrap } from '../../src/adapters/phaser/ui/AdvanceControl';
import {
    RIVAL_LAB_BODY_FONT_SIZE,
    RIVAL_LAB_CONTROL_FONT_SIZE,
    RIVAL_LAB_CONTROL_LABEL_WRAP,
    RIVAL_LAB_GUIDE_FONT_SIZE,
    RIVAL_LAB_HEADING_FONT_SIZE,
    RIVAL_LAB_SPEAKER_FONT_SIZE,
    rivalLabTextWrapWidth
} from '../../src/adapters/phaser/renderers/RivalLabRenderer';
import {
    DIALOGUE_CONTROL_FONT_SIZE,
    DIALOGUE_CONTROL_LABEL_WRAP,
    DIALOGUE_COUNTER_FONT_SIZE,
    DIALOGUE_COUNTER_WRAP,
    DIALOGUE_BODY_FONT_SIZE,
    DIALOGUE_SPEAKER_FONT_SIZE,
    dialogueBodyWrapWidth,
    dialogueSpeakerWrapWidth
} from '../../src/adapters/phaser/ui/DialogueBox';
import {
    PROPOSAL_ATTRIBUTION_FONT_SIZE,
    PROPOSAL_LIMITATION_FONT_SIZE,
    PROPOSAL_MARKER_FONT_SIZE,
    PROPOSAL_MARKER_WRAP,
    PROPOSAL_BODY_FONT_SIZE,
    proposalTextWrapWidth
} from '../../src/adapters/phaser/ui/ProposalChoice';

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
 * Derived from the widgets rather than restated as literals: these bounds are a function of the
 * surface width and each widget's own gutters, and a layout change that did not update a hard-coded
 * copy here would leave the check measuring against a bound the game no longer uses.
 */
const CARD_TEXT_WRAP_WIDTH = proposalTextWrapWidth(PROPOSAL_SURFACE_WIDTH);
const DIALOGUE_BODY_WRAP_WIDTH = dialogueBodyWrapWidth(PROPOSAL_SURFACE_WIDTH);
const DIALOGUE_SPEAKER_WRAP_WIDTH = dialogueSpeakerWrapWidth(PROPOSAL_SURFACE_WIDTH);
const RIVAL_LAB_TEXT_WRAP_WIDTH = rivalLabTextWrapWidth();

/**
 * Every in-scene advance control, with the bound of the host that draws it (Story 2.7).
 *
 * Two bounds, not one: the laboratory's control fills its 304px side column, and every other host
 * uses the widget's 232px default. Both are read from the source rather than restated, so a column
 * or a widget resized without this table being updated fails here instead of clipping on screen.
 *
 * This list replaces the single `lab.advance` entry. It is the same control, six times over.
 */
const ADVANCE_CONTROLS = [
    { key: 'advance.toColleagues', bound: advanceControlLabelWrap() },
    { key: 'advance.toBench', bound: advanceControlLabelWrap() },
    { key: 'advance.toTheoryBoard', bound: ADVANCE_CONTROL_LABEL_WRAP },
    { key: 'advance.toReviewers', bound: advanceControlLabelWrap() },
    { key: 'advance.closeTheCase', bound: advanceControlLabelWrap() },
    { key: 'advance.replay', bound: advanceControlLabelWrap() }
] as const;

/**
 * Each wrapped Phaser `Text` that holds authored French copy, with the wrap bound and font size
 * declared in the renderer. Phaser word-wrap cannot break inside a word, so a single token wider
 * than its bound is the overflow that actually clips.
 */
const WRAPPED_SURFACES = [
    { key: 'lab.title', font: UI_FONT_STACK, fontSize: 24, wrapWidth: 900 },
    ...ADVANCE_CONTROLS.map(({ key, bound }) => ({
        key, font: UI_FONT_STACK, fontSize: ADVANCE_CONTROL_FONT_SIZE, wrapWidth: bound
    })),
    { key: 'lab.guide', font: UI_FONT_STACK, fontSize: 15, wrapWidth: 900 },
    { key: 'lab.result.emptyHint', font: UI_FONT_STACK, fontSize: 19, wrapWidth: 620 },
    { key: 'lab.result.recorded', font: UI_FONT_STACK, fontSize: 19, wrapWidth: 620 },
    { key: 'lab.result.stale', font: UI_FONT_STACK, fontSize: 19, wrapWidth: 620 },
    { key: 'lab.preview', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 620 },
    { key: 'lab.pattern.recorded', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 620 },
    { key: 'lab.control.readout', font: UI_FONT_STACK, fontSize: 18, wrapWidth: 330 },
    { key: 'book.caption.spread', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 770 },
    { key: 'book.caption.summary', font: UI_FONT_STACK, fontSize: 13, wrapWidth: 770 },
    { key: 'book.summary.heading', font: BOOK_FONT_STACK, fontSize: 20, wrapWidth: 770 },
    { key: 'book.sourcePage.many', font: UI_FONT_STACK, fontSize: 12, wrapWidth: 372 },
    { key: 'book.printedPage', font: BOOK_FONT_STACK, fontSize: 14, wrapWidth: 372 },
    // Colleague cast and proposals (Story 1.11). The bounds are `ColleagueRenderer`'s: the chrome
    // wraps at the full card width, everything inside a card at `TEXT_WRAP_WIDTH`, and the choice
    // marker at its own narrow right-hand column.
    // All four narrower than the surface: Story 2.5 gave the conclusion heading's row to the submit
    // control, and Story 2.7 turned that into a permanent right-hand control column on **both** boards,
    // so every heading and guide now wraps against what is left rather than running underneath it.
    { key: 'colleagues.heading', font: UI_FONT_STACK, fontSize: 25, wrapWidth: BOARD_TEXT_WRAP },
    { key: 'colleagues.guide', font: UI_FONT_STACK, fontSize: 15, wrapWidth: BOARD_TEXT_WRAP },
    { key: 'theoryBoard.heading', font: UI_FONT_STACK, fontSize: 25, wrapWidth: BOARD_TEXT_WRAP },
    { key: 'theoryBoard.guide', font: UI_FONT_STACK, fontSize: 15, wrapWidth: BOARD_TEXT_WRAP },
    { key: 'theoryBoard.submit', font: UI_FONT_STACK, fontSize: SUBMIT_CONTROL_FONT_SIZE, wrapWidth: SUBMIT_CONTROL_LABEL_WRAP },
    // Rival lab (Story 2.5). The prose wraps against the surface less the accent column; the revise
    // control is a fixed hit target, so its label is bounded by the control rather than by the surface.
    { key: 'rivalLab.heading', font: UI_FONT_STACK, fontSize: RIVAL_LAB_HEADING_FONT_SIZE, wrapWidth: RIVAL_LAB_TEXT_WRAP_WIDTH },
    { key: 'rivalLab.guide', font: UI_FONT_STACK, fontSize: RIVAL_LAB_GUIDE_FONT_SIZE, wrapWidth: RIVAL_LAB_TEXT_WRAP_WIDTH },
    { key: 'rivalLab.role', font: UI_FONT_STACK, fontSize: RIVAL_LAB_SPEAKER_FONT_SIZE, wrapWidth: RIVAL_LAB_TEXT_WRAP_WIDTH },
    { key: 'rivalLab.revise', font: UI_FONT_STACK, fontSize: RIVAL_LAB_CONTROL_FONT_SIZE, wrapWidth: RIVAL_LAB_CONTROL_LABEL_WRAP },
    // The card bound, which is the tighter of the two places an attribution line is drawn. The dialogue
    // speaker line is measured against its own narrower bound in the authored-beat test below, because
    // this table is keyed by translation key and cannot hold two bounds for one key.
    { key: 'colleague.attribution', font: UI_FONT_STACK, fontSize: PROPOSAL_ATTRIBUTION_FONT_SIZE, wrapWidth: CARD_TEXT_WRAP_WIDTH },
    { key: 'colleague.unattributed', font: UI_FONT_STACK, fontSize: PROPOSAL_ATTRIBUTION_FONT_SIZE, wrapWidth: CARD_TEXT_WRAP_WIDTH },
    // The dialogue speaker slot's own fallback, which is a different string from the card's above.
    { key: 'colleague.unattributedSpeaker', font: UI_FONT_STACK, fontSize: DIALOGUE_SPEAKER_FONT_SIZE, wrapWidth: DIALOGUE_SPEAKER_WRAP_WIDTH },
    { key: 'proposal.limitation', font: UI_FONT_STACK, fontSize: PROPOSAL_LIMITATION_FONT_SIZE, wrapWidth: CARD_TEXT_WRAP_WIDTH },
    { key: 'proposal.selected', font: UI_FONT_STACK, fontSize: PROPOSAL_MARKER_FONT_SIZE, wrapWidth: PROPOSAL_MARKER_WRAP },
    { key: 'proposal.choose', font: UI_FONT_STACK, fontSize: PROPOSAL_MARKER_FONT_SIZE, wrapWidth: PROPOSAL_MARKER_WRAP },
    // Dialogue widget chrome (Story 1.12). The advance control is a fixed hit target, so its label is
    // bounded by the control rather than by the panel; the counter has its own narrow column.
    { key: 'dialogue.advance', font: UI_FONT_STACK, fontSize: DIALOGUE_CONTROL_FONT_SIZE, wrapWidth: DIALOGUE_CONTROL_LABEL_WRAP },
    { key: 'dialogue.end', font: UI_FONT_STACK, fontSize: DIALOGUE_CONTROL_FONT_SIZE, wrapWidth: DIALOGUE_CONTROL_LABEL_WRAP },
    { key: 'dialogue.counter', font: UI_FONT_STACK, fontSize: DIALOGUE_COUNTER_FONT_SIZE, wrapWidth: DIALOGUE_COUNTER_WRAP }
] as const;

/** Book controls are a fixed hit-test width and shrink to fit down to 10px before they would clip. */
const BOOK_CONTROLS = ['book.previous', 'book.next', 'book.close', 'book.summary.show', 'book.summary.close'] as const;

/**
 * The runtime values that fill each interpolated surface. Measuring the raw `{label}` / `{value}`
 * tokens would be a guaranteed pass that says nothing: the string that actually clips is
 * `"Écartement des fentes : 0,25 mm"`, not `{label}`. Authored source names come from `case.json`
 * so this cannot drift from the content, and the measurement values carry the real U+202F separator
 * `formatMeasurement` emits in French.
 */
const caseDefinition = JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as {
    contextualArtifacts: { displayName: { fr: string } }[];
    apparatus: { primaryControls: { label: { fr: string } }[] };
    colleagues: { name: string }[];
    rivalLab: { name: string; critiques: { id: string; line: { en: string; fr: string } }[] };
    predictionProposals: { text: { en: string; fr: string } }[];
    conclusionProposals: { claim: { en: string; fr: string }; limitation: { en: string; fr: string } }[];
    scenarioScript: { scenes: { phase: string; dialogueBeats?: { id: string; text: { en: string; fr: string } }[] }[] };
};

/**
 * Whitespace Phaser may wrap at — everything except the no-break spaces. French keeps `0,25` and its
 * unit on one line with U+202F, so `"0,25 mm"` is a single unbreakable token and must be measured as
 * one; a plain `\s+` split would quietly halve it.
 */
const BREAKABLE_WHITESPACE = /[^\S\u00A0\u202F]+/;

const longestFrench = (values: readonly string[]): string =>
    values.reduce((longest, value) => (value.length > longest.length ? value : longest), '');

const SOURCE_NAME = longestFrench(caseDefinition.contextualArtifacts.map(({ displayName }) => displayName.fr));
const CONTROL_LABEL = longestFrench(caseDefinition.apparatus.primaryControls.map(({ label }) => label.fr));
const SPACING = '0,2200 mm';

const COLLEAGUE_NAME = longestFrench(caseDefinition.colleagues.map(({ name }) => name));
const ROLE_LABEL = longestFrench([
    fr['colleague.role.lead'], fr['colleague.role.builder'], fr['colleague.role.analyst'], fr['colleague.role.communicator']
]);
/**
 * The authored copy the proposal cards actually hold. Measuring only the interface keys would miss
 * the strings most likely to overflow — a French conclusion claim is the longest run of text on the
 * theory board, and it lives in `case.json`, not in `fr.ts`.
 *
 * *Every* proposal, not the longest one per set: the pass condition below is per-token width, and the
 * widest unbreakable token has no reason to live in the longest string. Sampling by character count
 * let a short proposal carrying one long token through unmeasured.
 */
const PROPOSAL_TEXTS = caseDefinition.predictionProposals.flatMap(({ text }) => [text.fr, text.en]);
const CONCLUSION_CLAIMS = caseDefinition.conclusionProposals.flatMap(({ claim }) => [claim.fr, claim.en]);
const CONCLUSION_LIMITATIONS = caseDefinition.conclusionProposals.flatMap(({ limitation }) => [limitation.fr, limitation.en]);
/** French only, for the one place a *single* representative string is wanted (see `SAMPLE_PARAMS`). */
const FRENCH_LIMITATIONS = caseDefinition.conclusionProposals.map(({ limitation }) => limitation.fr);

/**
 * Every authored dialogue beat, flattened across the scenes that author one, **in both locales**.
 *
 * Read from `case.json` for the same reason the proposal copy is: the strings most likely to overflow the
 * dialogue panel are the authored beats, and they live in the case, not in `fr.ts`.
 *
 * English as well as French, which this spec did not do before the 1.12 review. Its whole reason to
 * exist is French, but the pass condition is *per-token pixel width* and an unbreakable token overflows
 * whatever language it is written in — a URL, a hyphen-free compound, an instrument name. Measuring only
 * `text.fr` left every English beat unchecked by the entire suite, since no other spec measures text at
 * all. Width measurement does not depend on the page locale, so both fit in this one pass.
 */
const DIALOGUE_BEATS = caseDefinition.scenarioScript.scenes.flatMap(({ phase, dialogueBeats }) =>
    (dialogueBeats ?? []).flatMap(({ id, text }) => [
        { label: `${phase} beat ${id} [fr]`, text: text.fr },
        { label: `${phase} beat ${id} [en]`, text: text.en }
    ]));
/**
 * Every authored rival-lab critique, in both locales, for the same reason the dialogue beats are swept
 * that way: the pass condition is per-token pixel width, and an unbreakable token overflows in whatever
 * language it was written. These are the longest single runs of prose on any surface in the game.
 */
const RIVAL_LAB_CRITIQUES = caseDefinition.rivalLab.critiques.flatMap(({ id, line }) => [
    { label: `rival-lab critique ${id} [fr]`, text: line.fr },
    { label: `rival-lab critique ${id} [en]`, text: line.en }
]);
/**
 * Every authored colleague hint, in both locales (Story 2.6).
 *
 * Added in review: the hints shipped as the sixth authored-prose surface and the first to skip this
 * sweep, though `HINT_TEXT_WRAP` is the *narrowest* prose bound in the game — narrower than the
 * proposal cards, the dialogue panel, and the rival lab. Each of those joined the sweep with the
 * story that introduced it, and each joined it because a review found the gap.
 */
const COLLEAGUE_HINTS = caseDefinition.colleagueHints.flatMap(({ id, line }) => [
    { label: `colleague hint ${id} [fr]`, text: line.fr },
    { label: `colleague hint ${id} [en]`, text: line.en }
]);

const LONGEST_CONVERSATION = Math.max(
    1,
    ...caseDefinition.scenarioScript.scenes.map(({ dialogueBeats }) => dialogueBeats?.length ?? 0)
);

const SAMPLE_PARAMS: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
    'lab.result.recorded': { value: SPACING, wavelength: 550, mode: fr['lab.wavelengthMode.minimum'] },
    'lab.result.stale': { value: SPACING },
    'lab.preview': { slitSpacing: '0,25 mm', screenDistance: '2,50 m' },
    'lab.pattern.recorded': { spacing: SPACING },
    'lab.control.readout': { label: CONTROL_LABEL, value: '0,25 mm' },
    'book.caption.spread': { source: SOURCE_NAME, index: 19, total: 19 },
    'book.caption.summary': { source: SOURCE_NAME },
    'book.sourcePage.many': { pages: '138, 139' },
    'book.printedPage': { pages: '138, 139' },
    'colleague.attribution': { name: COLLEAGUE_NAME, role: ROLE_LABEL },
    // The widest the counter ever gets in the authored content: the last beat of the longest conversation.
    'dialogue.counter': { index: LONGEST_CONVERSATION, total: LONGEST_CONVERSATION },
    // One representative is right here: this sample only fills the interface key's own template, and
    // the per-proposal sweep over every limitation lives in the colleague-card test below.
    'proposal.limitation': { limitation: longestFrench(FRENCH_LIMITATIONS) }
};

const fillParams = (key: string): string =>
    Object.entries(SAMPLE_PARAMS[key] ?? {})
        .reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), fr[key as keyof typeof fr]);

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

    // What a fully-tofu render of this pangram would measure: every glyph replaced by the
    // missing-glyph box. Comparing against *that* is the assertion — an `x`-repeat control is not,
    // because a tofu box is roughly as wide as a 16px `x`, so a tofu run would sit comfortably
    // inside any ratio bound drawn against it.
    const [uiWidth, bookWidth, tofuWidth] = await measure(page, [
        { font: UI_FONT_STACK, fontSize: 16, text: FRENCH_GLYPH_SAMPLE },
        { font: BOOK_FONT_STACK, fontSize: 16, text: FRENCH_GLYPH_SAMPLE },
        { font: UI_FONT_STACK, fontSize: 16, text: '￿' }
    ]);

    const allTofuWidth = tofuWidth * FRENCH_GLYPH_SAMPLE.length;
    for (const width of [uiWidth, bookWidth]) {
        expect(width).toBeGreaterThan(FRENCH_GLYPH_SAMPLE.length * 3);
        // Proportional text is narrower than a column of identical boxes, and the pangram is dense
        // with narrow letters. A run that measured at or near the all-tofu width is not being drawn.
        expect(width).toBeLessThan(allTofuWidth * 0.9);
    }
});

test('keeps every French string inside the wrap bound of the surface that holds it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // Placeholders are filled with the values the surface actually renders before splitting, because
    // Phaser word-wrap cannot break inside a token and the widest token is usually an interpolated
    // one — a formatted measurement or an authored French source name, never `{value}`.
    const samples = WRAPPED_SURFACES.flatMap(({ key, font, fontSize }) =>
        fillParams(key).split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ key, font, fontSize, text: token })));
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

test('keeps the authored proposal copy inside the colleague card, in both locales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // `ProposalChoice`'s in-card wrap bound, derived from the widget. The body and the limitation are
    // drawn at different sizes, so each authored string is measured at the size the card uses for it.
    const authored = [
        ...PROPOSAL_TEXTS.map((text, index) => ({ label: `prediction text ${index + 1}`, fontSize: PROPOSAL_BODY_FONT_SIZE, text })),
        ...CONCLUSION_CLAIMS.map((text, index) => ({ label: `conclusion claim ${index + 1}`, fontSize: PROPOSAL_BODY_FONT_SIZE, text })),
        ...CONCLUSION_LIMITATIONS.map((text, index) => ({ label: `conclusion limitation ${index + 1}`, fontSize: PROPOSAL_LIMITATION_FONT_SIZE, text }))
    ];
    const samples = authored.flatMap(({ label, fontSize, text }) =>
        text.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ label, font: UI_FONT_STACK, fontSize, text: token })));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index] }))
        .filter(({ width }) => width > CARD_TEXT_WRAP_WIDTH)
        .map(({ label, text, width }) => `${label}: "${text}" (${Math.round(width)}px)`);

    expect(overflowing).toEqual([]);
});

test('keeps the authored dialogue inside the panel that holds it, in both locales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // *Every* beat in *both* locales, not the longest French one: the pass condition is per-token width,
    // the widest unbreakable token has no reason to live in the longest string, and an over-wide token
    // clips whatever language it is in. The speaker line is measured at its own bound, which is narrower
    // than the card's because the counter and the advance control share its row.
    const authored = [
        ...DIALOGUE_BEATS.map(({ label, text }) => ({
            label, fontSize: DIALOGUE_BODY_FONT_SIZE, wrapWidth: DIALOGUE_BODY_WRAP_WIDTH, text
        })),
        {
            label: 'dialogue speaker',
            fontSize: DIALOGUE_SPEAKER_FONT_SIZE,
            wrapWidth: DIALOGUE_SPEAKER_WRAP_WIDTH,
            text: fillParams('colleague.attribution')
        }
    ];
    const samples = authored.flatMap(({ label, fontSize, wrapWidth, text }) =>
        text.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ label, font: UI_FONT_STACK, fontSize, wrapWidth, text: token })));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index] }))
        .filter(({ width, wrapWidth }) => width > wrapWidth)
        .map(({ label, text, width, wrapWidth }) => `${label}: "${text}" (${Math.round(width)}px > ${wrapWidth}px)`);

    expect(overflowing).toEqual([]);
    // A guard on the sweep itself: an empty list would make the assertion above vacuous, which is how
    // a spec starts passing because the content it measures stopped being found.
    expect(DIALOGUE_BEATS.length).toBeGreaterThan(0);
});

test('keeps the authored rival-lab critiques inside the surface that holds them, in both locales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // The critique body has no `maxLines` — truncating the objection is the one thing that surface must
    // not do — so what can still go wrong is a single token wider than the wrap bound, which Phaser
    // cannot break. The speaker line is measured at its own size against the same bound.
    const authored = [
        ...RIVAL_LAB_CRITIQUES.map(({ label, text }) => ({ label, fontSize: RIVAL_LAB_BODY_FONT_SIZE, text })),
        {
            label: 'rival-lab speaker',
            fontSize: RIVAL_LAB_SPEAKER_FONT_SIZE,
            text: fr['colleague.attribution']
                .replaceAll('{name}', caseDefinition.rivalLab.name)
                .replaceAll('{role}', fr['rivalLab.role'])
        }
    ];
    const samples = authored.flatMap(({ label, fontSize, text }) =>
        text.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ label, font: UI_FONT_STACK, fontSize, text: token })));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index] }))
        .filter(({ width }) => width > RIVAL_LAB_TEXT_WRAP_WIDTH)
        .map(({ label, text, width }) => `${label}: "${text}" (${Math.round(width)}px > ${RIVAL_LAB_TEXT_WRAP_WIDTH}px)`);

    expect(overflowing).toEqual([]);
    // A guard on the sweep: an empty list would make the assertion above vacuously true.
    expect(RIVAL_LAB_CRITIQUES.length).toBeGreaterThan(0);
});

test('keeps the authored colleague hints inside the laboratory hint panel, in both locales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // The hint panel grows upward from the canvas floor and has no `maxLines`, so height is handled.
    // What is not is a single token wider than `HINT_TEXT_WRAP`, which Phaser cannot break and which
    // would run out of the panel's right edge. The attributed speaker line shares the bound at its
    // own smaller size.
    const authored = [
        ...COLLEAGUE_HINTS.map(({ label, text }) => ({ label, fontSize: HINT_LINE_FONT_SIZE, text })),
        ...caseDefinition.colleagues.map(({ id, name, role }) => ({
            label: `hint speaker ${id}`,
            fontSize: HINT_SPEAKER_FONT_SIZE,
            text: fr['colleague.attribution']
                .replaceAll('{name}', name)
                .replaceAll('{role}', fr[`colleague.role.${role}`])
        }))
    ];
    const samples = authored.flatMap(({ label, fontSize, text }) =>
        text.split(BREAKABLE_WHITESPACE).filter(Boolean).map((token) => ({ label, font: UI_FONT_STACK, fontSize, text: token })));
    const widths = await measure(page, samples);

    const overflowing = samples
        .map((sample, index) => ({ ...sample, width: widths[index] }))
        .filter(({ width }) => width > HINT_TEXT_WRAP)
        .map(({ label, text, width }) => `${label}: "${text}" (${Math.round(width)}px > ${HINT_TEXT_WRAP}px)`);

    expect(overflowing).toEqual([]);
    expect(COLLEAGUE_HINTS.length).toBeGreaterThan(0);
});

test('fits every French fixed-height control label on one line', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: fr['boot.title'] })).toBeVisible();

    // The per-token sweep above cannot catch this. Its pass condition is "no single token is wider
    // than the wrap bound", which a 37-character two-word label satisfies comfortably — and then wraps
    // to two lines inside a 40px-high rectangle and clips. Completion Note 10 claimed the token sweep
    // pinned `lab.advance` against exactly that; it does not (review, 2026-08-06).
    //
    // These controls are a fixed height by design — they are hit targets, not prose — so the label has
    // to fit on one line at its authored size. That is a whole-string measurement, and it is the same
    // gap `deferred-work.md` already tracked for `theoryBoard.submit` and `rivalLab.revise`, closed for
    // every fixed-height control there is rather than for the newest one only.
    const FIXED_HEIGHT_CONTROLS = [
        // Story 2.7's six advance controls, each against its own host's bound. Story 2.6 shipped one of
        // these claiming the per-token sweep pinned it; it did not, and this is where that is actually
        // checked — six times over now, which is the obligation the generalization carries with it.
        ...ADVANCE_CONTROLS.map(({ key, bound }) => ({ key, fontSize: ADVANCE_CONTROL_FONT_SIZE, bound })),
        { key: 'theoryBoard.submit', fontSize: SUBMIT_CONTROL_FONT_SIZE, bound: SUBMIT_CONTROL_LABEL_WRAP },
        { key: 'rivalLab.revise', fontSize: RIVAL_LAB_CONTROL_FONT_SIZE, bound: RIVAL_LAB_CONTROL_LABEL_WRAP },
        { key: 'dialogue.advance', fontSize: DIALOGUE_CONTROL_FONT_SIZE, bound: DIALOGUE_CONTROL_LABEL_WRAP }
    ] as const;

    const widths = await measure(page, FIXED_HEIGHT_CONTROLS.map(({ key, fontSize }) => ({
        font: UI_FONT_STACK, fontSize, text: fr[key]
    })));

    const wrapping = FIXED_HEIGHT_CONTROLS
        .map((control, index) => ({ ...control, width: widths[index]! }))
        .filter(({ width, bound }) => width > bound)
        .map(({ key, width, bound }) => `${key}: "${fr[key]}" (${Math.round(width)}px > ${bound}px)`);

    expect(wrapping).toEqual([]);
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
