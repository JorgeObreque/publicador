import Link from 'next/link';
import { CampaignWizard } from '@/components/wizard/CampaignWizard';

export const dynamic = 'force-dynamic';

export default function NewCampaignPage() {
  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h2 style={{ margin: 0 }}>Nueva campaña</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
            Sigue los pasos para crear una campaña que se quedará pausada en Meta.
          </p>
        </div>
        <Link href="/campaigns" style={{ color: '#1f2933' }}>
          ← Volver al listado
        </Link>
      </header>
      <CampaignWizard />
    </section>
  );
}
