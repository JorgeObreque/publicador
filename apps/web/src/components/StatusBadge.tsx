import type { CampaignDisplayStatus } from '@/lib/campaigns/status';

const TONE_STYLES: Record<CampaignDisplayStatus['tone'], { background: string; color: string }> = {
  neutral: { background: '#eef2f7', color: '#1f2933' },
  pending: { background: '#fef3c7', color: '#92400e' },
  paused: { background: '#e0e7ff', color: '#3730a3' },
  archived: { background: '#e5e7eb', color: '#374151' },
  error: { background: '#fee2e2', color: '#991b1b' },
};

interface Props {
  status: CampaignDisplayStatus;
}

export function StatusBadge({ status }: Props) {
  const styles = TONE_STYLES[status.tone];
  return (
    <span
      title={status.description}
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.6rem',
        borderRadius: '999px',
        background: styles.background,
        color: styles.color,
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      {status.label}
    </span>
  );
}
