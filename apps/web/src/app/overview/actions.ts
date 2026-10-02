'use server';

import { revalidatePath } from 'next/cache';
import { importMetrics, importRemoteCampaigns } from '@/lib/overview/api';

export async function refreshOverviewAction() {
  await importRemoteCampaigns(50);
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getTime() - 29 * 86_400_000);
  const from = fromDate.toISOString().slice(0, 10);
  await importMetrics(from, to);
  revalidatePath('/overview');
}
