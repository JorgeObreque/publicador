import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  computeRange,
  fetchCampaignPerformance,
  listRemoteCampaigns,
} from '@/lib/overview/api';
import {
  formatCurrency,
  formatDate,
  formatDelta,
  formatInteger,
  formatPercent,
} from '@/lib/overview/format';
import { AnalyzePanel } from './AnalyzePanel';
import { MetricCard } from '@/components/metrics/MetricCard';
import { humanizeMetaStatus, type MetaStatusView } from '@/lib/campaigns/meta-status';
import { GLOSSARY, type GlossaryEntry } from '@/lib/content/marketing-glossary';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { metaCampaignId: string };
  searchParams: { range?: string | string[] };
}

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

const parseRangeParam = (raw: string | string[] | undefined): 7 | 30 | 90 => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  if (parsed === 7 || parsed === 30 || parsed === 90) return parsed;
  return 30;
};

const MAX_BARS = 24;

export default async function CampaignPerformancePage({ params, searchParams }: PageProps) {
  const days = parseRangeParam(searchParams?.range);
  const { from, to } = computeRange(days);
  let error: string | null = null;
  let performance: Awaited<ReturnType<typeof fetchCampaignPerformance>> | null = null;
  let campaignName = '';
  let campaignStatus: string | null = null;
  let campaignEffective: string | null = null;
  let campaignDailyBudget: string | null = null;
  let campaignLifetimeBudget: string | null = null;
  let campaignFetchedAt: string | null = null;

  try {
    performance = await fetchCampaignPerformance(params.metaCampaignId, from, to);
    const remote = await listRemoteCampaigns();
    const found = remote.find((c) => c.metaCampaignId === params.metaCampaignId);
    if (found) {
      campaignName = found.name;
      campaignStatus = found.status;
      campaignEffective = found.effectiveStatus;
      campaignDailyBudget = found.dailyBudget;
      campaignLifetimeBudget = found.lifetimeBudget;
      campaignFetchedAt = found.fetchedAt;
    } else {
      campaignName = `Campaña ${params.metaCampaignId}`;
    }
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('400') || message.includes('No se encontró')) {
      notFound();
    }
    error = message;
  }

  if (!performance) {
    return (
      <section>
        <h2>No pudimos cargar el rendimiento</h2>
        <p>{error}</p>
        <Link href="/overview">Volver al resumen</Link>
      </section>
    );
  }

  const metaStatus = humanizeMetaStatus(campaignStatus ?? 'UNKNOWN', campaignEffective);
  const toneStyle = statusToneStyle[metaStatus.tone];

  const rangeOptions = [
    { days: 7, label: '7 días' },
    { days: 30, label: '30 días' },
    { days: 90, label: '90 días' },
  ];

  const totals = performance.totals;
  const comparison = performance.comparison;
  const daily = performance.daily;
  const ads = performance.ads;
  const maxDailySpend = daily.reduce((max, day) => Math.max(max, day.spend), 0) || 1;
  const visibleDaily = daily.slice(-MAX_BARS);

  const funnel = [
    { label: 'Impresiones', value: totals.impressions },
    { label: 'Clics en WhatsApp', value: totals.clicks },
    { label: 'Resultados', value: totals.results },
  ];
  const maxFunnel = funnel.reduce((max, step) => Math.max(max, step.value), 0) || 1;

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <Link href="/overview" style={{ color: '#52606d', textDecoration: 'none', fontSize: '0.85rem' }}>
            ← Resumen de cuenta
          </Link>
          <h2 style={{ margin: '0.25rem 0 0' }}>{campaignName}</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#52606d', fontSize: '0.85rem' }}>
            id Meta {params.metaCampaignId} · sincronizada {formatDate(campaignFetchedAt)}
          </p>
        </div>
        <div style={{ display: 'grid', gap: '0.25rem', justifyItems: 'flex-end' }}>
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
          <span style={{ color: '#52606d', fontSize: '0.8rem', maxWidth: '20rem', textAlign: 'right' }}>
            {metaStatus.description}
          </span>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: '0.5rem' }}>
        {rangeOptions.map((option) => (
          <Link
            key={option.days}
            href={`/overview/${params.metaCampaignId}?range=${option.days}`}
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

      <section style={{ display: 'grid', gap: '0.4rem', color: '#3e4c59' }}>
        <p style={{ margin: 0 }}>
          {campaignDailyBudget
            ? `Presupuesto diario: ${formatCurrency(Number(campaignDailyBudget), totals.currency)}`
            : campaignLifetimeBudget
              ? `Presupuesto total: ${formatCurrency(Number(campaignLifetimeBudget), totals.currency)}`
              : 'Presupuesto no definido en Meta.'}
        </p>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#52606d' }}>
          Período del {formatDate(performance.range.from)} al {formatDate(performance.range.to)} · comparado con {formatDate(performance.range.previousFrom)} – {formatDate(performance.range.previousTo)}.
        </p>
      </section>

      <section
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <MetricCard
          label="Gasto"
          value={formatCurrency(totals.spend, totals.currency)}
          term={GLOSSARY.cpl}
          delta={buildDelta(comparison.spendDelta, false)}
        />
        <MetricCard
          label="Resultados"
          value={formatInteger(totals.results)}
          term={GLOSSARY.results}
          delta={buildDelta(comparison.resultsDelta, false)}
        />
        <MetricCard
          label="Costo por resultado (CPR)"
          value={formatCurrency(totals.cpl, totals.currency)}
          term={GLOSSARY.cpl}
          formula={GLOSSARY.cpl.formula}
          delta={buildDelta(comparison.cplDelta, true)}
        />
        <MetricCard
          label="Impresiones"
          value={formatInteger(totals.impressions)}
          term={GLOSSARY.impressions}
        />
        <MetricCard
          label="Clics en el botón de WhatsApp"
          value={formatInteger(totals.clicks)}
          term={CLICKS_ENTRY}
        />
        <MetricCard
          label="Tasa de clics (CTR)"
          value={formatPercent(totals.ctr)}
          term={GLOSSARY.ctr}
          formula={GLOSSARY.ctr.formula}
          delta={buildDelta(comparison.ctrDelta, false)}
        />
        <MetricCard
          label="Costo por clic (CPC)"
          value={formatCurrency(totals.cpc, totals.currency)}
          term={GLOSSARY.cpc}
          formula={GLOSSARY.cpc.formula}
          delta={buildDelta(comparison.cpcDelta, true)}
        />
        <MetricCard
          label="Tasa de conversión"
          value={formatPercent(totals.conversionRate)}
          term={GLOSSARY.conversionRate}
          formula={GLOSSARY.conversionRate.formula}
        />
      </section>

      <AnalyzePanel metaCampaignId={params.metaCampaignId} periodDays={days} />

      <hr style={{ border: 'none', borderTop: '1px solid #e4e7eb', margin: 0 }} />

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Rendimiento diario</h3>
          <details>
            <summary style={{ cursor: 'pointer', color: '#1f2933', fontSize: '0.85rem' }}>
              Ver datos diarios en tabla
            </summary>
            <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  background: '#ffffff',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid #e4e7eb',
                  fontSize: '0.85rem',
                }}
              >
                <caption style={{ textAlign: 'left', padding: '0.5rem', color: '#52606d' }}>
                  Datos diarios de la campaña
                </caption>
                <thead>
                  <tr style={{ background: '#f0f4f8', textAlign: 'left' }}>
                    <th style={th()}>Fecha</th>
                    <th style={th()}>Gasto</th>
                    <th style={th()}>Clics en WhatsApp</th>
                    <th style={th()}>Resultados</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDaily.map((day) => (
                    <tr key={day.date} style={{ borderTop: '1px solid #e4e7eb' }}>
                      <td style={td()}>{day.date}</td>
                      <td style={td()}>{formatCurrency(day.spend, totals.currency)}</td>
                      <td style={td()}>{formatInteger(day.clicks)}</td>
                      <td style={td()}>{formatInteger(day.results)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </header>
        {visibleDaily.length === 0 ? (
          <p style={{ color: '#52606d' }}>Aún no hay datos diarios para este período.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: '0.5rem',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid #e4e7eb',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${visibleDaily.length}, minmax(8px, 1fr))`,
                alignItems: 'end',
                gap: '4px',
                height: '120px',
              }}
            >
              {visibleDaily.map((day) => {
                const height = Math.max(2, Math.round((day.spend / maxDailySpend) * 100));
                return (
                  <div
                    key={day.date}
                    aria-label={`${day.date}: ${formatCurrency(day.spend, totals.currency)}, ${formatInteger(day.clicks)} clics, ${formatInteger(day.results)} resultados`}
                    style={{
                      height: `${height}%`,
                      background: '#1f2933',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                );
              })}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${visibleDaily.length}, minmax(8px, 1fr))`,
                gap: '4px',
                fontSize: '0.7rem',
                color: '#52606d',
              }}
            >
              {visibleDaily.map((day) => (
                <span key={day.date} style={{ textAlign: 'center' }}>
                  {day.date.slice(5)}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>Recorrido de la clienta</h3>
        <p style={{ margin: 0, color: '#52606d', fontSize: '0.85rem', lineHeight: 1.4 }}>
          Etapas desde que Meta muestra el anuncio hasta que la persona escribe un mensaje y,
          eventualmente, agenda una cita. Cada barra muestra cuántas personas llegaron a esa etapa.
        </p>
        <div
          style={{
            display: 'grid',
            gap: '0.5rem',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid #e4e7eb',
            background: '#ffffff',
          }}
        >
          {funnel.map((step, index) => {
            const width = Math.max(8, Math.round((step.value / maxFunnel) * 100));
            return (
              <div key={step.label} style={{ display: 'grid', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>{step.label}</span>
                  <strong>{formatInteger(step.value)}</strong>
                </div>
                <div style={{ background: '#e4e7eb', height: '12px', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${width}%`, background: '#1f2933', height: '100%' }} />
                </div>
                {index < funnel.length - 1 && funnel[index + 1] && step.value > 0 && (
                  <p style={{ margin: 0, color: '#52606d', fontSize: '0.75rem' }}>
                    {formatPercent(
                      ((funnel[index + 1]?.value ?? 0) / step.value) * 100,
                    )}{' '}
                    avanzan a la siguiente etapa
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ display: 'grid', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>Rendimiento por anuncio</h3>
        {ads.length === 0 ? (
          <p style={{ color: '#52606d' }}>Aún no hay datos de anuncios en este período.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: '#ffffff',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid #e4e7eb',
                fontSize: '0.85rem',
              }}
            >
              <thead>
                <tr style={{ background: '#f0f4f8', textAlign: 'left' }}>
                  <th style={th()}>Anuncio</th>
                  <th style={th()}>Conjunto</th>
                  <th style={th()}>Gasto</th>
                  <th style={th()}>Impresiones</th>
                  <th style={th()}>Clics en WhatsApp</th>
                  <th style={th()}>Resultados</th>
                  <th style={th()}>Tasa de clics (CTR)</th>
                  <th style={th()}>Costo por resultado (CPR)</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => (
                  <tr key={ad.metaAdId} style={{ borderTop: '1px solid #e4e7eb' }}>
                    <td style={td()}>{ad.adName ?? ad.metaAdId}</td>
                    <td style={td()}>{ad.adSetName ?? '—'}</td>
                    <td style={td()}>{formatCurrency(ad.spend, totals.currency)}</td>
                    <td style={td()}>{formatInteger(ad.impressions)}</td>
                    <td style={td()}>{formatInteger(ad.clicks)}</td>
                    <td style={td()}>{formatInteger(ad.results)}</td>
                    <td style={td()}>{formatPercent(ad.ctr)}</td>
                    <td style={td()}>{ad.results > 0 ? formatCurrency(ad.cpl, totals.currency) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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

const th = () => ({ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#52606d' });
const td = () => ({ padding: '0.6rem 0.75rem', color: '#1f2933' });