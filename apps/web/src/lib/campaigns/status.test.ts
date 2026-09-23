import { displayStatus } from './status';
import type { CampaignDisplayStatus } from './status';

describe('displayStatus', () => {
  const cases: Array<{
    name: string;
    input: Parameters<typeof displayStatus>[0];
    expectedKey: CampaignDisplayStatus['key'];
    expectedTone: CampaignDisplayStatus['tone'];
  }> = [
    {
      name: 'archivada',
      input: { status: 'ARCHIVED', metaPublishStatus: 'PAUSED', metaPublishError: null },
      expectedKey: 'ARCHIVED',
      expectedTone: 'archived',
    },
    {
      name: 'borrador',
      input: { status: 'DRAFT', metaPublishStatus: 'DRAFT', metaPublishError: null },
      expectedKey: 'DRAFT',
      expectedTone: 'neutral',
    },
    {
      name: 'publicada y pausada',
      input: { status: 'PAUSED', metaPublishStatus: 'PAUSED', metaPublishError: null },
      expectedKey: 'PUBLISHED_PAUSED',
      expectedTone: 'paused',
    },
    {
      name: 'enviando',
      input: { status: 'PAUSED', metaPublishStatus: 'PUBLISHING', metaPublishError: null },
      expectedKey: 'PUBLISHING',
      expectedTone: 'pending',
    },
    {
      name: 'error',
      input: {
        status: 'DRAFT',
        metaPublishStatus: 'FAILED',
        metaPublishError: 'Cuenta publicitaria inactiva',
      },
      expectedKey: 'PUBLISH_ERROR',
      expectedTone: 'error',
    },
  ];

  it.each(cases)('devuelve el estado correcto para $name', ({ input, expectedKey, expectedTone }) => {
    const result = displayStatus(input);
    expect(result.key).toBe(expectedKey);
    expect(result.tone).toBe(expectedTone);
  });
});
