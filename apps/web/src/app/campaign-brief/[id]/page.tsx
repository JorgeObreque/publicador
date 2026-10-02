import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBusinessProfileAction } from '../../business-profile/actions';
import { listServices } from '@/lib/services/api';
import type { ServiceSummary } from '@/lib/services/api';
import { getCampaignBriefAction } from '../actions';
import { BriefStatusBadge } from '../BriefStatusBadge';
import { CampaignBriefForm } from '../CampaignBriefForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function fetchServices(): Promise<ServiceSummary[]> {
  try {
    return await listServices();
  } catch {
    return [];
  }
}

async function fetchProfile() {
  try {
    return await getBusinessProfileAction();
  } catch {
    return null;
  }
}

export default async function CampaignBriefDetailPage({ params }: PageProps) {
  let brief = null;
  let error: string | null = null;
  try {
    brief = await getCampaignBriefAction(params.id);
  } catch (err) {
    if ((err as Error).message.includes('404')) {
      notFound();
    }
    error = (err as Error).message;
  }

  const [services, profile] = await Promise.all([fetchServices(), fetchProfile()]);
  const profileReady = Boolean(profile?.ready);

  if (!brief && error) {
    return (
      <section style={{ display: 'grid', gap: '1.5rem' }}>
        <p
          style={{
            color: '#991b1b',
            background: '#fee2e2',
            padding: '0.75rem',
            borderRadius: '8px',
          }}
        >
          No pudimos cargar el plan: {error}
        </p>
        <Link href="/campaign-brief" style={{ color: '#1f2933' }}>
          ← Volver al listado
        </Link>
      </section>
    );
  }

  if (!brief) {
    return (
      <section style={{ display: 'grid', gap: '1.5rem' }}>
        <h2>Plan no encontrado</h2>
        <Link href="/campaign-brief" style={{ color: '#1f2933' }}>
          ← Volver al listado
        </Link>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>{brief.title}</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
            {brief.businessObjective}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <BriefStatusBadge status={brief.status} />
          <Link href="/campaign-brief" style={{ color: '#1f2933' }}>
            ← Volver al listado
          </Link>
        </div>
      </header>

      <section
        style={{
          padding: '1rem',
          border: '1px solid #e4e7eb',
          borderRadius: '12px',
          background: '#ffffff',
          display: 'grid',
          gap: '0.5rem',
        }}
      >
        <h3 style={{ margin: 0 }}>Resumen</h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#3e4c59' }}>
          <li>Oferta: {brief.offer}</li>
          <li>
            <strong>Indicador clave de rendimiento (KPI) principal:</strong>{' '}
            {brief.primaryKpi}
          </li>
          <li>Cliente ideal: {brief.idealCustomerProfile ?? '—'}</li>
          <li>Preguntas de calificación: {brief.qualifyingQuestions.length}</li>
          <li>Restricciones: {brief.constraints.length}</li>
          <li>
            Aprobado:{' '}
            {brief.approvedAt
              ? new Date(brief.approvedAt).toISOString()
              : 'aún no'}
          </li>
        </ul>
      </section>

      {profileReady ? (
        <CampaignBriefForm
          mode="edit"
          initialBrief={brief}
          services={services}
        />
      ) : (
        <div
          style={{
            border: '1px solid #fee2e2',
            background: '#fee2e2',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: '12px',
          }}
        >
          <strong style={{ display: 'block' }}>
            Define el contexto del negocio antes de editar el plan
          </strong>
          <p style={{ margin: '0.5rem 0 0' }}>
            Para editar planes necesitas completar el contexto del negocio.
          </p>
          <Link
            href="/business-profile"
            style={{
              display: 'inline-block',
              marginTop: '0.5rem',
              padding: '0.45rem 0.95rem',
              borderRadius: '8px',
              background: '#1f2933',
              color: '#ffffff',
              textDecoration: 'none',
            }}
          >
            Ir al contexto del negocio
          </Link>
        </div>
      )}
    </section>
  );
}
