import { test, expect } from '@playwright/test';

test.describe('Publicador E2E smoke', () => {
  test('home page renders API status from backend', async ({ page, request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1';
    const health = await request.get(`${apiBase}/health/ready`);
    expect(health.ok()).toBe(true);
    const healthBody = await health.json();
    expect(healthBody.status).toBe('ok');
    expect(healthBody.checks.database.status).toBe('ok');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Publicador' })).toBeVisible();
    await expect(page.getByText(/Estado: ok/i)).toBeVisible();
  });
});
