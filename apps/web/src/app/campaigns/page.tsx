import Link from 'next/link';
import { listCampaigns } from '@/lib/campaigns/api';
import { CampaignList } from '@/components/CampaignList';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  let error: string | null = null;
  let campaigns: Awaited<ReturnType<typeof listCampaigns>> | null = null;
  try {
    campaigns = await listCampaigns();
  } catch (err) {
    error = (err as Error).message;
  }

  return (
    <section>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Campañas</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
            Revisa el estado de cada campaña y crea nuevas para probar ideas.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          style={{
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            background: '#1f2933',
            color: '#ffffff',
            textDecoration: 'none',
          }}
        >
          Crear campaña
        </Link>
      </header>
      {error && (
        <p style={{ color: '#991b1b', background: '#fee2e2', padding: '0.75rem', borderRadius: '8px' }}>
          No pudimos cargar las campañas: {error}
        </p>
      )}
      {campaigns && <CampaignList campaigns={campaigns} />}
    </section>
  );
}
