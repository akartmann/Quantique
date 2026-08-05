import { expect, test } from '@playwright/test';

test('guides the semantic Young context and prediction flow with named, recoverable gate feedback', async ({ page }) => {
    await page.goto('/');

    const context = page.getByRole('region', { name: 'Young context and prediction' });
    const continueButton = context.getByRole('button', { name: 'Continue to prediction' });
    await continueButton.focus();
    await page.keyboard.press('Enter');
    await expect(continueButton).toBeFocused();
    await expect(context.getByRole('status', { name: 'Context and prediction status' })).toHaveText(
        'Inspect Thomas Young’s 1801 lecture record before continuing to prediction.'
    );

    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await continueButton.click();
    await expect(context.getByRole('status', { name: 'Context and prediction status' })).toHaveText(
        'Inspect Opticks reference before continuing to prediction.'
    );
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await continueButton.click();
    await expect(context.getByRole('status', { name: 'Context and prediction status' })).toHaveText(
        'Context is complete. Record or revise your tentative prediction.'
    );

    const prediction = context.getByLabel('Tentative prediction');
    await prediction.fill('A stable pattern may appear.');
    const record = context.getByRole('button', { name: 'Record a prediction' });
    await record.click();
    await expect(record).toBeFocused();
    await expect(context.getByRole('status', { name: 'Context and prediction status' })).toHaveText(
        'Your tentative prediction is recorded and can be revised.'
    );
    const experiment = context.getByRole('button', { name: 'Continue to experimentation' });
    await experiment.click();
    await expect(context).toBeFocused();
    await expect(context.getByText('Your contextual record and prediction are saved. Continue with the bounded laboratory.')).toBeVisible();
});
