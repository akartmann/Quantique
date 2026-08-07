import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { lastProposalCardProbe, submitConclusionControlCentre } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { rivalLabReviseControlCentre } from '../../src/adapters/phaser/renderers/RivalLabRenderer';
// From `apparatusGeometry`, not `ApparatusRenderer`: that renderer imports Phaser as a *value*
// (`BlendModes`), Phaser touches `window` at import time, and these specs run in Node.
import { advanceToSynthesisControlCentre } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';

/**
 * AC1 and AC3 on the canvas — the only place the route into and out of the rival lab actually happens.
 *
 * What this reaches that no unit or integration test can: that the router really activates the scene
 * (`data-active-scene`), and that the submit and revise controls have live hit areas at the
 * coordinates their renderers place them at. Both click targets are **derived** from the renderers'
 * exported geometry rather than restated as literals — the rule the 1.12 review set after a spec
 * pinned a coordinate that had silently drifted into the gap between two cards.
 *
 * Canvas *text* is deliberately not asserted here: it cannot be read from the DOM, and
 * `french-typography.spec.ts` already measures every rival-lab string against its wrap bound in both
 * locales. What the French case proves is that the surface is reached and works under a French
 * browser, with the French bundle demonstrably live.
 */

const canvas = (page: import('@playwright/test').Page) => page.locator('#game-container canvas');

const CARD = lastProposalCardProbe(768);
const SUBMIT = submitConclusionControlCentre();
const REVISE = rivalLabReviseControlCentre(768);
const ADVANCE = advanceToSynthesisControlCentre();

/** The curated record is the one localized DOM panel, so its button names are derived per locale. */
const SOURCE_NAMES = (JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { contextualArtifacts: { displayName: { en: string; fr: string } }[] })
    .contextualArtifacts.map(({ displayName }) => displayName);

const clickDesign = async (page: import('@playwright/test').Page, point: Readonly<{ x: number; y: number }>): Promise<void> => {
    const bounds = await canvas(page).boundingBox();
    if (!bounds) throw new Error('The routed Phaser surface did not render.');
    await page.mouse.click(bounds.x + (point.x / 1024) * bounds.width, bounds.y + (point.y / 768) * bounds.height);
};

const expectActiveScene = async (page: import('@playwright/test').Page, sceneKey: string): Promise<void> => {
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', sceneKey);
};

/**
 * Walks to the theory board on **thin evidence** — no comparison saved, no support selected — which
 * is the state that leaves every authored conclusion indefensible, so whichever card is clicked
 * draws a challenge.
 *
 * Two runs varying the **screen distance only**, since Story 2.6: the significant-measure gate needs
 * two distinct critical configurations to let anyone out of the laboratory, so a single run no longer
 * reaches the board at all. Varying the throw rather than the slit separation clears that gate while
 * leaving `conclusion-spacing-varies` (wants a varied `slitSpacingMm`) and `conclusion-both-settings`
 * (wants both) unmet, so every critique path stays exactly as reachable as it was.
 *
 * The advance itself now goes through the **canvas** control rather than the retired DOM panel's
 * "Continue investigation to synthesis" button. That is the affordance a player actually has, and it
 * is the one the gate and the colleague hint are wired to.
 *
 * `locale` selects the bundle for the one localized DOM panel; the rest of the retired panel set is
 * English-only by design (`docs/i18n-authoring.md`).
 */
const walkToTheoryBoardWithThinEvidence = async (
    page: import('@playwright/test').Page,
    locale: 'en' | 'fr'
): Promise<void> => {
    const labels = locale === 'fr' ? fr : en;
    await page.goto('/');
    // Proves the browser really resolved the locale under test before anything downstream depends on
    // it — the canvas resolves every string through the same store-held locale.
    await expect(page.getByRole('heading', { name: labels['boot.title'] })).toBeVisible();
    await expectActiveScene(page, 'Library');

    // The DOM record is used only to satisfy the context gate on the way to the rival lab. Since Story
    // 2.8 it opens nothing: the book belongs to the reading room, and this panel records the inspection
    // and draws nothing over the canvas. The `clickDesign(BOOK_CLOSE)` that used to follow went with
    // it — with no book to dismiss, that click would land on live canvas instead.
    for (const displayName of SOURCE_NAMES) {
        await page.getByRole('button', { name: labels['curatedRecord.inspect'].replace('{name}', displayName[locale]) }).click();
    }

    await page.getByRole('button', { name: 'Continue to prediction' }).click();
    await page.getByLabel('Tentative prediction').fill('A larger screen distance may widen the pattern.');
    await page.getByRole('button', { name: 'Record a prediction' }).click();
    await page.getByRole('button', { name: 'Continue to experimentation' }).click();
    await expectActiveScene(page, 'Laboratory');

    await page.getByRole('button', { name: 'Run experiment' }).click();
    // The significant-measure gate refuses here, and the canvas answers with a colleague hint rather
    // than moving the player. Asserting the refusal keeps the walk honest: without it, a gate that
    // silently stopped working would still leave this helper passing.
    await clickDesign(page, ADVANCE);
    await expectActiveScene(page, 'Laboratory');

    const screenDistance = page.getByLabel('Screen distance (m)');
    await screenDistance.focus();
    await screenDistance.press('ArrowUp');
    await page.getByRole('button', { name: 'Run experiment' }).click();

    await clickDesign(page, ADVANCE);
    await expectActiveScene(page, 'TheoryBoard');
};

/** Choosing and submitting are separate acts by design: choosing is freely revisable and draws nothing. */
const chooseAndSubmit = async (page: import('@playwright/test').Page): Promise<void> => {
    await clickDesign(page, CARD);
    await clickDesign(page, SUBMIT);
};

test('routes to the rival lab on an unsupported conclusion and back again on revising', async ({ page }) => {
    await walkToTheoryBoardWithThinEvidence(page, 'en');

    await chooseAndSubmit(page);

    await expectActiveScene(page, 'RivalLab');

    await clickDesign(page, REVISE);

    // Back to the phase's own scene, which never moved: the critique is a beat, not a setback, and the
    // investigation is exactly where the player left it.
    await expectActiveScene(page, 'TheoryBoard');
    await expect(page.getByRole('region', { name: 'Theory board' })).toBeVisible();
});

test('leaves the board alone until the conclusion is actually submitted', async ({ page }) => {
    await walkToTheoryBoardWithThinEvidence(page, 'en');

    // Choosing on its own draws nothing — otherwise the choice would stop being freely revisable.
    await clickDesign(page, CARD);

    await expectActiveScene(page, 'TheoryBoard');
});

test.describe('French', () => {
    test.use({ locale: 'fr-FR' });

    test('reaches the rival lab and returns to the board under a French browser', async ({ page }) => {
        await walkToTheoryBoardWithThinEvidence(page, 'fr');

        await chooseAndSubmit(page);

        await expectActiveScene(page, 'RivalLab');

        await clickDesign(page, REVISE);

        await expectActiveScene(page, 'TheoryBoard');
    });
});
