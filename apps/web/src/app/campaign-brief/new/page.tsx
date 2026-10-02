import Link from 'next/link';
import { getBusinessProfileAction } from '../../business-profile/actions';
import { listServices } from '@/lib/services/api';
import type { ServiceSummary } from '@/lib/services/api';
import { CommercialDiagnosisFlow } from '@/components/commercial-diagnosis/CommercialDiagnosisFlow';

export const dynamic = 'force-dynamic';

async function fetchServices(): Promise<ServiceSummary[]> {
  try {
    return await listServices();
  } catch {
    return [];
  }
}

async function fetchProfile(): Promise<
  Awaited<ReturnType<typeof getBusinessProfileAction>> | null
> {
  try {
    return await getBusinessProfileAction();
  } catch {
    return null;
  }
}

export default async function NewCampaignBriefPage() {
  const [services, profile] = await Promise.all([fetchServices(), fetchProfile()]);
  const profileReady =
    profile !== null && Boolean((profile as { ready?: boolean }).ready);

  if (!profileReady) {
    return (
      <section style={{ display: 'grid', gap: '1.5rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0 }}>Nuevo plan</h2>
          <Link href="/campaign-brief" style={{ color: '#1f2933' }}>
            ← Volver al listado
          </Link>
        </header>
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
            Define el contexto del negocio antes
          </strong>
          <p style={{ margin: '0.5rem 0 0' }}>
            Para crear un plan primero debes completar el contexto del negocio (dirección, voz de marca, perfil de cliente ideal).
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
      </section>
    );
  }

  if (services.length === 0) {
    return (
      <section style={{ display: 'grid', gap: '1.5rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0 }}>Nuevo plan</h2>
          <Link href="/campaign-brief" style={{ color: '#1f2933' }}>
            ← Volver al listado
          </Link>
        </header>
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
            Crea al menos un servicio antes de iniciar un diagnóstico
          </strong>
          <p style={{ margin: '0.5rem 0 0' }}>
            El diagnóstico comercial necesita saber qué servicio quieres
            potenciar para proponerte una meta útil.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0 }}>Nuevo plan</h2>
        <Link href="/campaign-brief" style={{ color: '#1f2933' }}>
          ← Volver al listado
        </Link>
      </header>
      <CommercialDiagnosisFlow services={services} />
    </section>
  );
}