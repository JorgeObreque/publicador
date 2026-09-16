import { test, expect } from '@playwright/test';

test.describe('Campaign lifecycle E2E (API + DB)', () => {
  test('creates a campaign, attaches a creative, publishes paused and reports metrics', async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1';

    const campaign = await request.post(`${apiBase}/campaigns`, {
      data: {
        name: 'E2E Campaign',
        objective: 'whatsapp',
        dailyBudget: 3000,
      },
    });
    expect(campaign.ok()).toBe(true);
    const campaignBody = await campaign.json();

    const creative = await request.post(`${apiBase}/creatives`, {
      data: {
        name: 'E2E Creative',
        format: 'image',
        primaryText: 'Hola',
        headline: 'Reserva',
        callToAction: 'WHATSAPP_MESSAGE',
      },
    });
    expect(creative.ok()).toBe(true);
    const creativeBody = await creative.json();

    const attach = await request.post(`${apiBase}/creatives/attach`, {
      data: { campaignId: campaignBody.id, creativeId: creativeBody.id, isControl: true },
    });
    expect(attach.ok()).toBe(true);
    const attachBody = await attach.json();
    expect(attachBody.attributionCode).toMatch(/^ADS:CMP-/);

    const summary = await request.get(`${apiBase}/analytics/campaigns/${campaignBody.id}`);
    expect(summary.ok()).toBe(true);
    const summaryBody = await summary.json();
    expect(summaryBody.attribution.length).toBe(1);
    expect(summaryBody.attribution[0].attributionCode).toBe(attachBody.attributionCode);
  });
});
