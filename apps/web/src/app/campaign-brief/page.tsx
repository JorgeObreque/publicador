import Link from 'next/link';
import { listCampaignBriefsAction } from './actions';
import type {
  CampaignBrief,
  CampaignBriefStatus,
  CampaignExecutionSummary,
} from '@/lib/campaign-brief/api';
import { BriefStatusBadge } from './BriefStatusBadge';
import { displayStatus } from '@/lib/campaigns/status';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<CampaignBriefStatus, string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobado',
  ARCHIVED: 'Archivado',
};

const dateFormatter = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' });

const moneyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return dateFormatter.format(new Date(value));
}

function formatMoney(value: string | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return moneyFormatter.format(num);
}

interface PageProps {
  searchParams: { status?: string };
}

function normalizeStatus(raw?: string): CampaignBriefStatus | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === 'DRAFT' || upper === 'APPROVED' || upper === 'ARCHIVED') {
    return upper;
  }
  return null;
}

export default async function CampaignBriefsListPage({ searchParams }: PageProps) {
  const filter = normalizeStatus(searchParams.status);
  let briefs: CampaignBrief[] = [];
  let error: string | null = null;
  try {
    briefs = await listCampaignBriefsAction();
  } catch (err) {
    error = (err as Error).message;
  }

  const counts = briefs.reduce<Record<CampaignBriefStatus, number>>(
    (acc, brief) => {
      acc[brief.status] += 1;
      return acc;
    },
    { DRAFT: 0, APPROVED: 0, ARCHIVED: 0 },
  );

  const filtered = filter ? briefs.filter((b) => b.status === filter) : briefs;

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Planes comerciales</h2>
        </div>
        <Link
          href="/campaign-brief/new"
          style={{
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            background: '#1f2933',
            color: '#ffffff',
            textDecoration: 'none',
          }}
        >
          Nuevo plan
        </Link>
      </header>

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#52606d', fontSize: '0.9rem' }}>
          <strong>{counts.DRAFT}</strong> borrador(es)
        </span>
        <span style={{ color: '#52606d', fontSize: '0.9rem' }}>
          <strong>{counts.APPROVED}</strong> aprobado(s)
        </span>
        <span style={{ color: '#52606d', fontSize: '0.9rem' }}>
          <strong>{counts.ARCHIVED}</strong> archivado(s)
        </span>
        <span style={{ flex: 1 }} />
        <Link
          href="/campaign-brief"
          style={{
            fontSize: '0.85rem',
            color: filter === null ? '#1f2933' : '#52606d',
            textDecoration: filter === null ? 'underline' : 'none',
          }}
        >
          Todos
        </Link>
        {(['DRAFT', 'APPROVED', 'ARCHIVED'] as CampaignBriefStatus[]).map((s) => (
          <Link
            key={s}
            href={`/campaign-brief?status=${s}`}
            style={{
              fontSize: '0.85rem',
              color: filter === s ? '#1f2933' : '#52606d',
              textDecoration: filter === s ? 'underline' : 'none',
            }}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {error && (
        <p
          style={{
            color: '#991b1b',
            background: '#fee2e2',
            padding: '0.75rem',
            borderRadius: '8px',
          }}
        >
          No pudimos cargar los planes: {error}
        </p>
      )}

      {filtered.length === 0 && !error && (
        <p style={{ color: '#52606d' }}>
          {filter
            ? `No hay planes en estado ${STATUS_LABEL[filter]}.`
            : 'Aún no tienes planes. Crea el primero desde "Nuevo plan".'}
        </p>
      )}

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        {filtered.map((brief) => (
          <li
            key={brief.id}
            data-testid={`briefs-list-item-${brief.id}`}
            style={{
              padding: '1rem',
              border: '1px solid #e4e7eb',
              borderRadius: '12px',
              background: '#ffffff',
              display: 'grid',
              gap: '0.75rem',
            }}
          >
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
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                  <Link
                    href={`/campaign-brief/${brief.id}`}
                    style={{ color: '#1f2933', textDecoration: 'none' }}
                  >
                    {brief.title}
                  </Link>
                </h3>
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    color: '#52606d',
                    fontSize: '0.9rem',
                  }}
                >
                  <strong>Indicador clave de rendimiento (KPI) principal:</strong>{' '}
                  <strong>{brief.primaryKpi}</strong>
                </p>
                <p
                  style={{
                    margin: '0.35rem 0 0',
                    color: '#3e4c59',
                    fontSize: '0.85rem',
                  }}
                >
                  Creado el {formatDate(brief.createdAt)}
                  {brief.approvedAt
                    ? ` · Aprobado el ${formatDate(brief.approvedAt)}`
                    : ''}
                </p>
              </div>
              <BriefStatusBadge status={brief.status} />
            </header>

            <ExecutionsSection brief={brief} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExecutionsSection({ brief }: { brief: CampaignBrief }) {
  const executions: CampaignExecutionSummary[] = brief.executions;

  return (
    <div>
      <p
        style={{
          margin: '0 0 0.5rem',
          color: '#1f2933',
          fontSize: '0.95rem',
          fontWeight: 600,
        }}
      >
        Ejecuciones ({executions.length})
      </p>

      {executions.length === 0 ? (
        <p
          style={{
            margin: 0,
            color: '#52606d',
            fontSize: '0.9rem',
          }}
        >
          Aún no hay ejecuciones para este plan.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          {executions.map((execution) => (
            <li
              key={execution.id}
              data-testid={`briefs-list-execution-${execution.id}`}
              style={{
                padding: '0.65rem 0.85rem',
                border: '1px solid #e4e7eb',
                borderRadius: '8px',
                background: '#f9fafb',
                display: 'grid',
                gap: '0.35rem',
              }}
            >
              <ExecutionRow execution={execution} />
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: '0.85rem' }}>
        {brief.status === 'APPROVED' && (
          <Link
            href={`/campaigns/new?briefId=${brief.id}`}
            data-testid={`briefs-list-create-execution-${brief.id}`}
            style={{
              display: 'inline-block',
              padding: '0.45rem 0.95rem',
              borderRadius: '8px',
              background: '#1f2933',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
          >
            Crear nueva ejecución
          </Link>
        )}
        {brief.status === 'DRAFT' && (
          <p
            style={{
              margin: 0,
              color: '#52606d',
              fontSize: '0.85rem',
            }}
          >
            Aprueba este plan para poder crear una ejecución.
          </p>
        )}
      </div>
    </div>
  );
}

function ExecutionRow({
  execution,
}: {
  execution: CampaignExecutionSummary;
}) {
  const status = displayStatus({
    status: execution.status,
    metaPublishStatus: execution.metaPublishStatus,
  });

  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <Link
          href={`/campaigns/${execution.id}`}
          style={{
            color: '#1f2933',
            textDecoration: 'none',
            fontSize: '0.95rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span
            aria-hidden
            style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              background: '#52606d',
              display: 'inline-block',
            }}
          />
          {execution.name} — {status.label}
        </Link>
        <StatusBadge status={status} />
      </div>
      <p
        style={{
          margin: 0,
          color: '#52606d',
          fontSize: '0.8rem',
        }}
      >
        {execution.dailyBudget
          ? `Diario ${formatMoney(execution.dailyBudget)}`
          : 'Sin presupuesto diario'}
        {' · '}
        0 anuncio(s)
        {' · '}
        creada {formatDate(execution.createdAt)}
      </p>
    </div>
  );
}
