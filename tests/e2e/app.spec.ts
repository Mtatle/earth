import { expect, test } from '@playwright/test';

test('loads Earthly shell', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Geospatial Operations Surface' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Layers' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Camera presets' })).toBeVisible();
  await expect(page.getByTestId('cesium-canvas')).toBeVisible();

  await page.waitForTimeout(3000);
  expect(consoleErrors.filter((line) => line.includes('Failed to bootstrap Cesium viewer'))).toEqual([]);
});
