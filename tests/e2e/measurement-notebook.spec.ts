import { expect, test } from '@playwright/test';

test('records semantic observations, compares two runs, and retains their pair note', async ({ page }) => {
    await page.goto('/');

    const recordObservation = page.getByRole('button', { name: 'Record prepared observation' });
    await recordObservation.click();
    await expect(recordObservation).toBeFocused();
    await expect(page.getByRole('status', { name: 'Measurement notebook status' })).toHaveText('Observation 1 recorded.');
    await recordObservation.click();
    await expect(page.getByRole('status', { name: 'Measurement notebook status' })).toHaveText('Observation 2 recorded.');
    await recordObservation.click();
    await expect(page.getByRole('status', { name: 'Measurement notebook status' })).toHaveText('Observation 3 recorded.');

    const notebook = page.getByRole('region', { name: 'Measurement notebook' });
    await expect(notebook.getByText('Observed result')).toHaveCount(3);
    await expect(notebook.getByText('Experiment model version')).toHaveCount(3);
    await expect(notebook.getByText('Slit spacing')).toHaveCount(3);
    await expect(notebook.getByText('Screen distance')).toHaveCount(3);
    await expect(notebook.getByText('Linked evidence')).toHaveCount(3);

    const firstSelection = page.getByRole('checkbox', { name: 'Select Observation 1 for comparison' });
    await firstSelection.check();
    await expect(firstSelection).toBeFocused();
    await page.getByRole('checkbox', { name: 'Select Observation 2 for comparison' }).check();
    await page.getByRole('checkbox', { name: 'Select Observation 3 for comparison' }).check();
    await expect(page.getByRole('status', { name: 'Measurement notebook status' })).toHaveText(
        'Choose two different saved observations to compare. Your existing observations are unchanged.'
    );
    await expect(notebook.getByText('Observed result')).toHaveCount(3);
    await expect(page.getByRole('region', { name: 'Run comparison' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Observation 1' }).last()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Observation 2' }).last()).toBeVisible();

    const note = page.getByLabel('Comparison note');
    await note.fill('The prepared observations agree.');
    const saveNote = page.getByRole('button', { name: 'Save comparison note' });
    await saveNote.click();
    await expect(saveNote).toBeFocused();
    await expect(note).toHaveValue('The prepared observations agree.');
    await expect(page.getByRole('status', { name: 'Measurement notebook status' })).toHaveText('Comparison note saved.');
});

test('keeps existing observations and gives neutral recovery copy when recording fails', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(crypto, 'randomUUID', {
            configurable: true,
            value: () => 'duplicate-observation-id'
        });
    });
    await page.goto('/');

    const recordObservation = page.getByRole('button', { name: 'Record prepared observation' });
    await recordObservation.click();
    await recordObservation.click();

    await expect(page.getByRole('status', { name: 'Measurement notebook status' })).toHaveText(
        'This observation could not be recorded. Your existing observations are unchanged.'
    );
    await expect(page.getByRole('region', { name: 'Measurement notebook' }).getByText('Observed result')).toHaveCount(1);
    await expect(recordObservation).toBeFocused();
});
