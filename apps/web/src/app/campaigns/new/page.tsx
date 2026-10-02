import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CampaignWizard } from '@/components/wizard/CampaignWizard';
import { getCampaignBriefForWizardAction } from '@/app/campaigns/new/actions';
import { createDraftFromBrief, type CampaignDraft } from '@/lib/campaigns/wizard';

export const dynamic = 'force-dynamic';

interface NewCampaignPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const normalizeSearchParam = (value: string | string[] | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const BRIEF_NEW_URL = '/campaign-brief/new';

/**
 * Carga el brief aprobado para precargar el wizard. Devuelve `null`
 * cuando el brief no existe, no pertenece al negocio, o no está en
 * estado APPROVED. Devolver `null` (en vez de redirigir desde aquí)
 * evita una doble redirección cuando el caller ya hace su propio
 * `redirect(BRIEF_NEW_URL)`.
 */
async function loadApprovedBriefDraft(briefId: string): Promise<CampaignDraft | null> {
  let result;
  try {
    result = await getCampaignBriefForWizardAction(briefId);
  } catch {
    return null;
  }
  if (!result.brief || result.brief.status !== 'APPROVED') {
    return null;
  }
  return createDraftFromBrief(result.brief, {
    dailyBudget: result.recommendedDailyBudget,
    lifetimeBudget: result.recommendedLifetimeBudget,
    durationDays: result.recommendedDurationDays,
  });
}

export default async function NewCampaignPage({ searchParams }: NewCampaignPageProps) {
  const briefId = normalizeSearchParam(searchParams.briefId);

  // Sin briefId aprobado no se puede crear una ejecución: el backend
  // rechaza campañas sin `campaignBriefId` y la arquitectura exige que
  // cada ejecución nazca de un plan comercial aprobado.
  if (!briefId) {
    redirect(BRIEF_NEW_URL);
  }

  const initialDraft = await loadApprovedBriefDraft(briefId);
  if (!initialDraft) {
    redirect(BRIEF_NEW_URL);
  }

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h2 style={{ margin: 0 }}>Empieza tu próxima campaña</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
            Sigue los pasos para crear una campaña que se quedará pausada en Meta.
          </p>
          <p
            role="note"
            data-testid="campaign-new-from-brief-note"
            style={{
              margin: '0.5rem 0 0',
              color: '#1f2933',
              fontSize: '0.85rem',
              lineHeight: 1.4,
            }}
          >
            Esta campaña parte del objetivo comercial que aprobaste en tu diagnóstico. El
            copy respetará la estrategia aprobada.
          </p>
        </div>
        <Link href="/campaign-brief" style={{ color: '#1f2933' }}>
          ← Volver al listado
        </Link>
      </header>
      <CampaignWizard initialDraft={initialDraft} />
    </section>
  );
}
