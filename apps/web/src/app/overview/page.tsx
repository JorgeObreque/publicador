import Link from 'next/link';
import { refreshOverviewAction } from './actions';
import { computeRange, fetchAccountPerformance } from '@/lib/overview/api';
import { formatCurrency, formatDate, formatDelta, formatInteger, formatPercent } from '@/lib/overview/format';
import { MetricCard } from '@/components/metrics/MetricCard';
import { humanizeMetaStatus, type MetaStatusView } from '@/lib/campaigns/meta-status';
import { GLOSSARY, type GlossaryEntry } from '@/lib/content/marketing-glossary';

export const dynamic = 'force-dynamic';

const statusToneStyle: Record<MetaStatusView['tone'], { bg: string; fg: string }> = {
  ok: { bg: '#dcfce7', fg: '#166534' },
  warn: { bg: '#fef3c7', fg: '#92400e' },
  error: { bg: '#fee2e2', fg: '#991b1b' },
  neutral: { bg: '#e5e7eb', fg: '#374151' },
};

const CLICKS_ENTRY: GlossaryEntry = {
  everydayLabel: 'Clics en el botón de WhatsApp',
  technicalTerm: 'Clics',
  short:
    'Cantidad de veces que alguien hizo clic en el botón de WhatsApp del anuncio, no en cualquier parte.',
  warning:
    'Un clic no significa que el mensaje haya llegado: la persona puede cerrar la conversación antes de escribir.',
  category: 'metric',
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: { range?: string | string[] };
}) {
  const daysParam = Number(searchParams?.range ?? 30);
  const days = Number.isFinite(daysParam) && [7, 30, 90].includes(daysParam) ? daysParam : 30;
  const { from, to } = computeRange(days);
  let error: string | null = null;
  let performance: Awaited<ReturnType<typeof fetchAccountPerformance>> | null = null;
  try {
    performance = await fetchAccountPerformance(from, to);
  } catch (err) {
    error = (err as Error).message;
  }

  const campaigns = performance?.campaigns ?? [];
  const rangeOptions = [
    { days: 7, label: '7 días' },
    { days: 30, label: '30 días' },
    { days: 90, label: '90 días' },
  ];

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Resumen de la cuenta publicitaria</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
            Vista de todas las campañas en Meta Ads Manager, incluidas las creadas fuera de Publicador.
          </p>
        </div>
        <form action={refreshOverviewAction}>
          <button
            type="submit"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid #1f2933',
              background: '#1f2933',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Actualizar datos de Meta
          </button>
        </form>
        <span style={{ display: 'none' }} aria-hidden="true">
          Recupera campañas y métricas recientes desde Meta Ads.
        </span>
      </header>

      <nav style={{ display: 'flex', gap: '0.5rem' }}>
        {rangeOptions.map((option) => (
          <Link
            key={option.days}
            href={`/overview?range=${option.days}`}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid #cbd2d9',
              background: option.days === days ? '#1f2933' : '#ffffff',
              color: option.days === days ? '#ffffff' : '#1f2933',
              fontSize: '0.85rem',
              textDecoration: 'none',
            }}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {error && (
        <p style={{ color: '#991b1b', background: '#fee2e2', padding: '0.75rem', borderRadius: '8px' }}>
          No pudimos cargar el resumen: {error}
        </p>
      )}
      {performance && (
        <section
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          <MetricCard
            label="Gasto"
            value={formatCurrency(performance.totals.spend, performance.totals.currency)}
            term={GLOSSARY.cpl}
            delta={buildDelta(performance.comparison.spendDelta, false)}
          />
          <MetricCard
            label="Resultados"
            value={formatInteger(performance.totals.results)}
            term={GLOSSARY.results}
          />
          <MetricCard
            label="Costo por resultado (CPR)"
            value={formatCurrency(performance.totals.cpl, performance.totals.currency)}
            term={GLOSSARY.cpl}
            formula={GLOSSARY.cpl.formula}
            delta={buildDelta(performance.comparison.cplDelta, true)}
          />
          <MetricCard
            label="Impresiones"
            value={formatInteger(performance.totals.impressions)}
            term={GLOSSARY.impressions}
          />
          <MetricCard
            label="Clics"
            value={formatInteger(performance.totals.clicks)}
            term={CLICKS_ENTRY}
          />
          <MetricCard
            label="Tasa de clics (CTR)"
            value={formatPercent(performance.totals.ctr)}
            term={GLOSSARY.ctr}
            formula={GLOSSARY.ctr.formula}
            delta={buildDelta(performance.comparison.ctrDelta, false)}
          />
          <MetricCard
            label="Costo por clic (CPC)"
            value={formatCurrency(performance.totals.cpc, performance.totals.currency)}
            term={GLOSSARY.cpc}
            formula={GLOSSARY.cpc.formula}
            delta={buildDelta(performance.comparison.cpcDelta, true)}
          />
          <MetricCard
            label="Tasa de conversión"
            value={formatPercent(performance.totals.conversionRate)}
            term={GLOSSARY.conversionRate}
            formula={GLOSSARY.conversionRate.formula}
          />
        </section>
      )}

      {campaigns.length === 0 && (
        <p style={{ color: '#52606d' }}>
          Aún no hemos sincronizado campañas. Usa el botón &ldquo;Actualizar datos de Meta&rdquo; para importar la lista desde Meta.
        </p>
      )}
      {campaigns.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
          {campaigns.map((c) => {
            const metaStatus = humanizeMetaStatus(c.status ?? 'UNKNOWN', c.effectiveStatus);
            const toneStyle = statusToneStyle[metaStatus.tone];
            return (
              <li
                key={c.metaCampaignId}
                style={{
                  padding: '1rem',
                  border: '1px solid #e4e7eb',
                  borderRadius: '12px',
                  background: '#ffffff',
                  display: 'grid',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
                      <Link
                        href={`/overview/${c.metaCampaignId}?range=${days}`}
                        style={{ color: '#1f2933', textDecoration: 'none' }}
                      >
                        {c.campaignName}
                      </Link>
                    </h3>
                    <p style={{ margin: '0.25rem 0 0', color: '#52606d', fontSize: '0.85rem' }}>
                      id Meta {c.metaCampaignId}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '999px',
                      background: toneStyle.bg,
                      color: toneStyle.fg,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    {metaStatus.label}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    color: '#3e4c59',
                    fontSize: '0.85rem',
                    lineHeight: 1.4,
                  }}
                >
                  {metaStatus.description}
                </p>
                {c.hasResults ? (
                  <p style={{ margin: 0, color: '#3e4c59', fontSize: '0.9rem' }}>
                    Gasto: {formatCurrency(c.totals.spend, c.totals.currency)} · Resultados:{' '}
                    {formatInteger(c.totals.results)} · Costo por resultado:{' '}
                    {formatCurrency(c.totals.cpl, c.totals.currency)}
                  </p>
                ) : (
                  <p style={{ margin: 0, color: '#9aa5b1', fontSize: '0.9rem' }}>
                    Aún no hay resultados en este período.
                  </p>
                )}
                <Link
                  href={`/overview/${c.metaCampaignId}?range=${days}`}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    background: '#1f2933',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                  }}
                >
                  Ver detalle de campaña
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {performance && (
        <p style={{ color: '#9aa5b1', fontSize: '0.8rem' }}>
          Período consultado del {formatDate(performance.range.from)} al {formatDate(performance.range.to)} · comparado con{' '}
          {formatDate(performance.range.previousFrom)} – {formatDate(performance.range.previousTo)}.
        </p>
      )}
    </section>
  );
}

function buildDelta(
  delta: number | null,
  inverse: boolean,
): { value: string; label: string; favorable: 'up' | 'down' | 'flat' } | undefined {
  if (delta === null || delta === undefined) return undefined;
  const value = formatDelta(delta);
  const favorable: 'up' | 'down' | 'flat' =
    delta === 0 ? 'flat' : (inverse ? delta < 0 : delta > 0) ? 'up' : 'down';
  return { value, label: 'vs período anterior', favorable };
}