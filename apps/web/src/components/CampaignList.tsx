import Link from 'next/link';
import type { Campaign } from '@/lib/campaigns/types';
import { displayStatus } from '@/lib/campaigns/status';
import { StatusBadge } from '@/components/StatusBadge';

interface Props {
  campaigns: Campaign[];
}

const formatBudget = (campaign: Campaign) => {
  if (campaign.dailyBudget) {
    return `Diario ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(campaign.dailyBudget))}`;
  }
  if (campaign.lifetimeBudget) {
    return `Total ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(campaign.lifetimeBudget))}`;
  }
  return 'Presupuesto sin definir';
};

export function CampaignList({ campaigns }: Props) {
  if (campaigns.length === 0) {
    return (
      <p style={{ color: '#52606d' }}>
        Aún no tienes campañas. Crea la primera para empezar.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
      {campaigns.map((campaign) => {
        const status = displayStatus(campaign);
        return (
          <li
            key={campaign.id}
            style={{
              padding: '1rem',
              border: '1px solid #e4e7eb',
              borderRadius: '12px',
              background: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                  <Link href={`/campaigns/${campaign.id}`} style={{ color: '#1f2933', textDecoration: 'none' }}>
                    {campaign.name}
                  </Link>
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: '#52606d', fontSize: '0.9rem' }}>{campaign.objective}</p>
              </div>
              <StatusBadge status={status} />
            </div>
            <p style={{ margin: '0.75rem 0 0', color: '#3e4c59', fontSize: '0.9rem' }}>{formatBudget(campaign)}</p>
            <p style={{ margin: '0.25rem 0 0', color: '#9aa5b1', fontSize: '0.85rem' }}>
              {campaign.campaignCreatives?.length ?? 0} anuncio(s)
            </p>
          </li>
        );
      })}
    </ul>
  );
}
