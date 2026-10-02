import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getCampaign,
  summarizeCampaign,
} from '@/lib/campaigns/api';
import { getCampaignBrief } from '@/lib/campaign-brief/api';
import type { Campaign, CampaignSummary } from '@/lib/campaigns/types';
import { displayStatus } from '@/lib/campaigns/status';
import { StatusBadge } from '@/components/StatusBadge';
import { summarizeInsights } from '@/lib/campaigns/insights';
import { CampaignAppointments } from '@/components/CampaignAppointments';
import { PublishActions } from '@/components/PublishActions';

interface PageProps {
  params: { id: string };
}

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(value)) : '—';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({ params }: PageProps) {
  let campaign: Campaign | null = null;
  let summary: CampaignSummary | null = null;
  let error: string | null = null;

  try {
    campaign = await getCampaign(params.id);
    try {
      summary = await summarizeCampaign(params.id);
    } catch (summaryError) {
      summary = null;
      error = (summaryError as Error).message;
    }
  } catch (err) {
    if ((err as Error).message.includes('404')) {
      notFound();
    }
    error = (err as Error).message;
  }

  if (!campaign) {
    return (
      <section>
        <h2>Campaña no encontrada</h2>
        <p>{error ?? 'Verifica el enlace utilizado.'}</p>
      </section>
    );
  }

  let breadcrumbBrief: { id: string; title: string } | null = null;
  if (campaign.campaignBriefId) {
    try {
      const brief = await getCampaignBrief(campaign.campaignBriefId);
      breadcrumbBrief = { id: brief.id, title: brief.title };
    } catch {
      breadcrumbBrief = null;
    }
  }

  const status = displayStatus(campaign);
  const insights = summary ? summarizeInsights(summary) : null;
  const hasCreatives = (campaign.campaignCreatives?.length ?? 0) > 0;

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <nav
        aria-label="Ruta de navegación"
        style={{ fontSize: '0.85rem', color: '#52606d', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}
      >
        <Link href="/campaign-brief" style={{ color: '#52606d' }}>Planes comerciales</Link>
        <span aria-hidden="true">›</span>
        {breadcrumbBrief ? (
          <Link href={`/campaign-brief/${breadcrumbBrief.id}`} style={{ color: '#52606d' }}>
            {breadcrumbBrief.title}
          </Link>
        ) : (
          <span>(sin plan vinculado)</span>
        )}
        <span aria-hidden="true">›</span>
        <span style={{ color: '#1f2933', fontWeight: 600 }}>{campaign.name}</span>
      </nav>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>{campaign.name}</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>{campaign.objective}</p>
        </div>
        <StatusBadge status={status} />
      </header>

      <p style={{ margin: 0, color: '#3e4c59' }}>{status.description}</p>

      {campaign.metaPublishError && (
        <p style={{ color: '#991b1b', background: '#fee2e2', padding: '0.75rem', borderRadius: '8px' }}>
          {campaign.metaPublishError}
        </p>
      )}

      <section style={{ display: 'grid', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>Configuración</h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#3e4c59' }}>
          <li>Inicio: {formatDate(campaign.startDate)}</li>
          <li>Término: {formatDate(campaign.endDate)}</li>
          <li>
            Presupuesto:{' '}
            {campaign.dailyBudget
              ? `diario CLP ${campaign.dailyBudget}`
              : campaign.lifetimeBudget
                ? `total CLP ${campaign.lifetimeBudget}`
                : 'sin definir'}
          </li>
          {campaign.notes && <li>Notas: {campaign.notes}</li>}
        </ul>
      </section>

      <section style={{ display: 'grid', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>Resultados</h3>
        {insights ? (
          insights.hasResults ? (
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#3e4c59' }}>
              <li>Dinero gastado: {insights.spendLabel}</li>
              <li>Personas que hicieron clic: {insights.clicksLabel}</li>
              <li>Citas atribuidas: {insights.conversionsLabel}</li>
              {insights.revenueLabel && <li>Ingresos registrados: {insights.revenueLabel}</li>}
              {insights.averagePerConversion && (
                <li>Costo promedio por cita: {insights.averagePerConversion}</li>
              )}
            </ul>
          ) : (
            <p style={{ color: '#52606d' }}>Aún no hay resultados.</p>
          )
        ) : (
          <p style={{ color: '#52606d' }}>
            No pudimos cargar los resultados: {error ?? 'intenta nuevamente más tarde.'}
          </p>
        )}
      </section>

      <section style={{ display: 'grid', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>Anuncios</h3>
        {campaign.campaignCreatives && campaign.campaignCreatives.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#3e4c59' }}>
            {campaign.campaignCreatives.map((attachment) => (
              <li key={attachment.id}>
                {attachment.creative.name}
                {attachment.isControl ? ' (control)' : ''} · código {attachment.attributionCode}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#52606d' }}>Aún no hay anuncios asociados.</p>
        )}
      </section>

      <CampaignAppointments campaignId={campaign.id} />

      {hasCreatives && (
        <section
          style={{
            display: 'grid',
            gap: '0.75rem',
            padding: '1rem',
            border: '1px solid #e4e7eb',
            borderRadius: '12px',
            background: '#ffffff',
          }}
        >
          <h3 style={{ margin: 0 }}>Publicación en Meta</h3>
          <PublishActions
            campaign={{
              id: campaign.id,
              status: campaign.status,
              metaPublishStatus: campaign.metaPublishStatus,
              metaPublishError: campaign.metaPublishError,
            }}
            hasCreatives={hasCreatives}
          />
        </section>
      )}
    </section>
  );
}
