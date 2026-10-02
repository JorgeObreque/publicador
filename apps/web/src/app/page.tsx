import Link from 'next/link';
import { listCampaignBriefs, type CampaignBrief } from '@/lib/campaign-brief/api';
import { listServices, type ServiceSummary } from '@/lib/services/api';
import { getBusinessProfile } from '@/lib/business-profile/api';
import { BriefStatusBadge } from './campaign-brief/BriefStatusBadge';

export const dynamic = 'force-dynamic';

const ACTIVE_BRIEF_LIMIT = 3;

const formatExecutionCount = (count: number): string => {
  if (count === 0) return 'sin ejecuciones';
  if (count === 1) return '1 ejecución';
  return `${count} ejecuciones`;
};

export default async function Home() {
  let briefs: CampaignBrief[] | null = null;
  let briefsError: string | null = null;
  let services: ServiceSummary[] = [];
  let profile: Awaited<ReturnType<typeof getBusinessProfile>> | null = null;

  // Cargamos en paralelo: los planes, los servicios (para resolver
  // serviceName sin un join extra en backend) y el perfil del negocio.
  try {
    briefs = await listCampaignBriefs();
  } catch (err) {
    briefsError = (err as Error).message;
  }
  try {
    services = await listServices();
  } catch {
    services = [];
  }
  try {
    profile = await getBusinessProfile();
  } catch {
    profile = null;
  }
  const profileReady = Boolean(profile?.ready);
  const hasProfile = profile !== null;

  const servicesById = new Map(services.map((s) => [s.id, s.name]));
  const activeBriefs = (briefs ?? [])
    .filter((b) => b.status === 'DRAFT' || b.status === 'APPROVED')
    .slice(0, ACTIVE_BRIEF_LIMIT);

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h2 style={{ margin: 0 }}>Inicio</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
          Busca la próxima oportunidad para tu negocio o revisa tus planes activos.
        </p>
      </header>

      {briefsError && (
        <p style={{ color: '#991b1b', background: '#fee2e2', padding: '0.75rem', borderRadius: '8px' }}>
          No pudimos cargar los planes: {briefsError}
        </p>
      )}

      <section
        style={{
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid #e4e7eb',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Contexto del negocio</h3>
          <p style={{ margin: '0.25rem 0 0', color: '#52606d', fontSize: '0.9rem' }}>
            Define ubicación, voz de marca y metas para alimentar a la IA.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {!profileReady && (
            <span
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                background: '#fee2e2',
                color: '#991b1b',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {hasProfile ? 'Perfil incompleto' : 'Sin perfil'}
            </span>
          )}
          <Link
            href="/business-profile"
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '8px',
              background: '#1f2933',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
          >
            {profileReady ? 'Editar contexto' : 'Completar perfil'}
          </Link>
        </div>
      </section>

      <section style={{ display: 'grid', gap: '0.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <h3 style={{ margin: 0 }}>Planes activos</h3>
          <Link
            href="/campaign-brief"
            style={{ color: '#52606d', fontSize: '0.85rem' }}
          >
            Ver todos los planes →
          </Link>
        </div>
        {activeBriefs.length === 0 && !briefsError && (
          <p style={{ color: '#52606d', margin: 0 }}>
            Aún no tienes planes activos. Crea el primero desde &ldquo;Nuevo plan&rdquo;.
          </p>
        )}
        {activeBriefs.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: '0.5rem',
            }}
          >
            {activeBriefs.map((brief) => {
              const serviceName = servicesById.get(brief.serviceId);
              const executionCount = brief.executions?.length ?? 0;
              return (
                <li
                  key={brief.id}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #e4e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Link
                      href={`/campaign-brief/${brief.id}`}
                      style={{
                        color: '#1f2933',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      {brief.title}
                    </Link>
                    <p
                      style={{
                        margin: '0.25rem 0 0',
                        color: '#52606d',
                        fontSize: '0.85rem',
                      }}
                    >
                      {serviceName ? `${serviceName} · ` : ''}
                      {formatExecutionCount(executionCount)}
                    </p>
                  </div>
                  <BriefStatusBadge status={brief.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
