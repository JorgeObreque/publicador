import Link from 'next/link';
import { listCampaigns } from '@/lib/campaigns/api';
import { displayStatus } from '@/lib/campaigns/status';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let error: string | null = null;
  let campaigns: Awaited<ReturnType<typeof listCampaigns>> | null = null;
  try {
    campaigns = await listCampaigns();
  } catch (err) {
    error = (err as Error).message;
  }

  const counts = (campaigns ?? []).reduce<Record<string, number>>((acc, campaign) => {
    const key = displayStatus(campaign).key;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h2 style={{ margin: 0 }}>Inicio</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
          Crea campañas pausadas en Meta y revisa sus resultados.
        </p>
      </header>

      {error && (
        <p style={{ color: '#991b1b', background: '#fee2e2', padding: '0.75rem', borderRadius: '8px' }}>
          No pudimos conectar con la API: {error}
        </p>
      )}

      <section style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <SummaryCard label="Borradores" value={counts.DRAFT ?? 0} />
        <SummaryCard label="Publicadas y pausadas" value={counts.PUBLISHED_PAUSED ?? 0} />
        <SummaryCard label="Enviando" value={counts.PUBLISHING ?? 0} />
        <SummaryCard label="Con error" value={counts.PUBLISH_ERROR ?? 0} />
      </section>

      {campaigns && campaigns.length > 0 && (
        <section style={{ display: 'grid', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Últimas campañas</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
            {campaigns.slice(0, 3).map((campaign) => {
              const status = displayStatus(campaign);
              return (
                <li
                  key={campaign.id}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #e4e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    style={{ color: '#1f2933', textDecoration: 'none', fontWeight: 600 }}
                  >
                    {campaign.name}
                  </Link>
                  <StatusBadge status={status} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: '1rem',
        borderRadius: '12px',
        background: '#ffffff',
        border: '1px solid #e4e7eb',
      }}
    >
      <p style={{ margin: 0, color: '#52606d', fontSize: '0.9rem' }}>{label}</p>
      <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 700 }}>{value}</p>
    </div>
  );
}
