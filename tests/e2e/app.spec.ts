import { expect, test } from '@playwright/test';

test('loads Earthly shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Geospatial Operations Surface' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Layers' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Camera presets' })).toBeVisible();
  await expect(page.getByTestId('cesium-canvas')).toBeVisible();
});
