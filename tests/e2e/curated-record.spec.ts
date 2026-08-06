import { expect, test } from '@playwright/test';

const clickBookControl = async (
    page: import('@playwright/test').Page,
    designX: number,
    designY: number
): Promise<void> => {
    const canvas = page.locator('#game-container canvas');
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('The laboratory surface did not render.');
    await page.mouse.click(bounds.x + (designX / 1024) * bounds.width, bounds.y + (designY / 768) * bounds.height);
};

test('inspects both Young contextual sources through the semantic Curated Record', async ({ page }) => {
    await page.goto('/');

    const record = page.getByRole('region', { name: 'Curated Record' });
    await expect(record.getByRole('heading', { name: 'Curated Record' })).toBeVisible();
    await expect(record.getByText('Creator or originating context')).toHaveCount(2);
    await expect(record.getByText('Source type')).toHaveCount(2);
    await expect(record.getByText('Provenance reference')).toHaveCount(2);
    await expect(record.getByText('young-1801-lecture')).toBeVisible();
    await expect(record.getByText('Provenance: Primary material')).toHaveCount(2);
    await expect(record.getByText('Primary-source marker')).toHaveCount(2);
    await expect(record.getByText('Rights status: Reviewed')).toHaveCount(2);
    await expect(record.getByText('Case relationship')).toHaveCount(2);

    const youngLecture = record.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' });
    await youngLecture.focus();
    await page.keyboard.press('Enter');
    await expect(youngLecture).toBeFocused();
    await expect(record.getByRole('status', { name: 'Curated Record status' })).toHaveText(
        'Thomas Young’s 1801 lecture record is recorded as inspected evidence.'
    );

    const opticks = record.getByRole('button', { name: 'Inspect Opticks reference' });
    await opticks.click();
    await expect(opticks).toBeFocused();
    await expect(record.getByRole('status', { name: 'Curated Record status' })).toHaveText(
        'Opticks reference is recorded as inspected evidence.'
    );
    await expect(record.getByText('Inspection recorded')).toHaveCount(2);
});

test('a single inspect control records a readable source as evidence and opens the local book', async ({ page }) => {
    await page.goto('/');

    const record = page.getByRole('region', { name: 'Curated Record' });
    const context = page.getByRole('region', { name: 'Young context and prediction' });

    // There is no separate reader button — one control does both.
    await expect(record.getByRole('button', { name: 'Read the lecture record' })).toHaveCount(0);

    const youngLecture = record.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' });
    await youngLecture.focus();
    await page.keyboard.press('Enter');

    // Recorded as inspected evidence...
    await expect(youngLecture).toBeFocused();
    await expect(record.getByText('Inspection recorded')).toHaveCount(1);
    await expect(record.getByRole('status', { name: 'Curated Record status' })).toHaveText(
        'Thomas Young’s 1801 lecture record is recorded as inspected evidence.'
    );

    // ...and the book opens, with only a compact attribution block in HTML (no paginated document).
    const attribution = context.getByRole('group', { name: 'Read the lecture record — source attribution' });
    await expect(attribution).toBeVisible();
    await expect(attribution.getByRole('link', { name: 'View the cited archive facsimile (opens in a new tab).' })).toHaveAttribute(
        'href',
        'https://wellcomecollection.org/works/u5dr8rgg'
    );
    await expect(attribution).toContainText('Public Domain Mark');
    await expect(context.locator('.contextual-text-reader')).toHaveCount(0);
    await expect(context.locator('.contextual-text-section')).toHaveCount(0);
    await expect(page.locator('#game-container canvas')).toBeVisible();

    // Re-clicking keeps a single inspection record and reopens the book.
    await youngLecture.click();
    await expect(record.getByText('Inspection recorded')).toHaveCount(1);
    await expect(record.getByRole('status', { name: 'Curated Record status' })).toHaveText(
        'Thomas Young’s 1801 lecture record is already recorded as inspected evidence.'
    );

    // Closing the book from its own control returns focus to the inspect trigger.
    await page.waitForTimeout(300);
    await clickBookControl(page, 512, 678);
    await expect(attribution).toHaveCount(0);
    await expect(youngLecture).toBeFocused();
});

test('reveals and dismisses the reference summary from the book view', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/');

    const record = page.getByRole('region', { name: 'Curated Record' });
    const context = page.getByRole('region', { name: 'Young context and prediction' });
    const attribution = context.getByRole('group', { name: 'Read the Opticks reference — source attribution' });

    await record.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await expect(attribution).toBeVisible();

    // Let the open animation finish so the book controls are interactive, then toggle the
    // Phaser summary overlay. If "Show summary" did not open, the 512/678 click would close the
    // book (Close book) instead of the summary — so the final assertion also proves it opened.
    await page.waitForTimeout(400);
    await clickBookControl(page, 848, 55); // Show summary
    await page.waitForTimeout(200);
    await clickBookControl(page, 512, 678); // Close summary — book stays open
    await page.waitForTimeout(200);

    await expect(attribution).toBeVisible();
    expect(errors).toEqual([]);
});

test('opens the readable book and closes it under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const record = page.getByRole('region', { name: 'Curated Record' });
    const context = page.getByRole('region', { name: 'Young context and prediction' });

    await record.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    const attribution = context.getByRole('group', { name: 'Read the lecture record — source attribution' });
    await expect(attribution).toBeVisible();

    await clickBookControl(page, 512, 678);
    await expect(attribution).toHaveCount(0);
});

test('uses the authored reader label from the case definition as the book identity', async ({ page }) => {
    await page.route('**/cases/young-interference/case.json', async (route) => {
        const response = await route.fetch();
        const definition = await response.json() as { contextualArtifacts: Array<{ textualRendition?: { readerLabel: { en: string; fr: string } } }> };
        // Both locales: the case contract requires every localizable string to carry `en` and `fr`,
        // and a missing one is rejected by Zod before the definition reaches the app.
        definition.contextualArtifacts[0].textualRendition!.readerLabel = {
            en: 'Open the local primary source',
            fr: 'Ouvrir la source primaire locale'
        };
        await route.fulfill({ response, json: definition });
    });
    await page.goto('/');

    await page.getByRole('region', { name: 'Curated Record' })
        .getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();

    await expect(
        page.getByRole('region', { name: 'Young context and prediction' })
            .getByRole('group', { name: 'Open the local primary source — source attribution' })
    ).toBeVisible();
});

test('auto-closes on entering the experiment phase yet reopens an already-inspected book without re-recording', async ({ page }) => {
    await page.goto('/');

    const record = page.getByRole('region', { name: 'Curated Record' });
    const context = page.getByRole('region', { name: 'Young context and prediction' });
    const youngAttribution = context.getByRole('group', { name: 'Read the lecture record — source attribution' });

    await record.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await record.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await expect(record.getByText('Inspection recorded')).toHaveCount(2);

    // Advance through the gate; entering the experiment phase dismisses the lingering book.
    await context.getByRole('button', { name: 'Continue to prediction' }).click();
    await context.getByLabel('Tentative prediction').fill('A stable, evenly spaced pattern should appear.');
    await context.getByRole('button', { name: 'Record a prediction' }).click();
    await context.getByRole('button', { name: 'Continue to experimentation' }).click();
    await expect(context.getByRole('group', { name: /source attribution/ })).toHaveCount(0);

    // Re-inspecting an already-recorded readable source still opens the book, without a new record.
    await record.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await expect(youngAttribution).toBeVisible();
    await expect(record.getByText('Inspection recorded')).toHaveCount(2);
});

test('snapshots inspected source labels into a new notebook observation', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Record prepared observation' }).click();

    const notebook = page.getByRole('region', { name: 'Measurement notebook' });
    await expect(notebook.getByText('Thomas Young’s 1801 lecture record')).toBeVisible();
});

test('keeps inspected evidence and gives neutral recovery for an ineligible source', async ({ page }) => {
    await page.route('**/cases/young-interference/case.json', async (route) => {
        const response = await route.fetch();
        const definition = await response.json() as { contextualArtifacts: Array<{ rightsStatus: string; textualRendition?: unknown }> };
        // An unreviewed source is ineligible and non-readable; the schema forbids a rendition on it.
        definition.contextualArtifacts[1].rightsStatus = 'incomplete';
        delete definition.contextualArtifacts[1].textualRendition;
        await route.fulfill({ response, json: definition });
    });
    await page.goto('/');

    const record = page.getByRole('region', { name: 'Curated Record' });
    await record.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    const opticks = record.getByRole('button', { name: 'Inspect Opticks reference' });
    await opticks.click();

    await expect(opticks).toBeFocused();
    await expect(record.getByRole('status', { name: 'Curated Record status' })).toHaveText(
        'This source cannot be inspected as verified evidence right now. Try another contextual source.'
    );
    await expect(record.getByText('Inspection recorded')).toHaveCount(1);
});
