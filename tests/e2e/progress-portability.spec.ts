import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('exports only portable progress and recovers from invalid or incompatible imports', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Record prepared observation' }).click();

    const printable = page.getByRole('article', { name: 'Printable investigation record' });
    await expect(printable.getByRole('heading', { name: 'Apparatus settings' })).toBeVisible();
    await expect(printable.getByRole('heading', { name: 'Recorded observations' })).toBeVisible();
    await expect(printable.getByText('Prepared observation: 1 relative units.')).toBeVisible();
    await expect(printable.getByRole('heading', { name: 'Conclusion and limitation' })).toBeVisible();

    const progress = page.getByRole('region', { name: 'Save, export, import, and print' });
    const downloadPromise = page.waitForEvent('download');
    await progress.getByRole('button', { name: 'Export progress' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('young-interference-progress-v1.json');
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error('The exported record should be available to the test runner.');
    const exported = JSON.parse(await readFile(downloadPath, 'utf8')) as Record<string, unknown>;
    expect(exported).toMatchObject({ schemaVersion: 1, caseId: 'young-interference', runs: [{ id: expect.any(String) }] });
    expect(exported).not.toHaveProperty('caseDefinition');

    const input = progress.getByLabel('Import a progress record');
    await input.setInputFiles({ name: 'valid-progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await expect(progress.getByRole('status', { name: 'Progress status' })).toHaveText('Progress imported and saved on this device.');
    await expect(page.getByText('Inspection recorded')).toBeVisible();

    await input.setInputFiles({ name: 'invalid-progress.json', mimeType: 'application/json', buffer: Buffer.from('{') });
    await expect(progress.getByRole('status', { name: 'Progress status' })).toHaveText('This progress record could not be used. Your current work is unchanged.');
    await expect(input).toBeFocused();
    await expect(page.getByText('Inspection recorded')).toBeVisible();

    await input.setInputFiles({ name: 'other-version.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...exported, caseDefinitionVersion: '2.0.0' })) });
    await expect(progress.getByRole('status', { name: 'Progress status' })).toHaveText('This progress record could not be used. Your current work is unchanged.');
    await expect(page.getByRole('region', { name: 'Measurement notebook' }).getByText('Observed result')).toHaveCount(1);
});
