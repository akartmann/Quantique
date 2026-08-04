import { expect, test } from '@playwright/test';

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
        const definition = await response.json() as { contextualArtifacts: Array<{ rightsStatus: string }> };
        definition.contextualArtifacts[1].rightsStatus = 'incomplete';
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
