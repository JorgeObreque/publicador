import type { CampaignBriefStatus } from '@/lib/campaign-brief/api';

const STATUS_LABEL: Record<CampaignBriefStatus, string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobado',
  ARCHIVED: 'Archivado',
};

const STATUS_TONE: Record<CampaignBriefStatus, { background: string; color: string }> = {
  DRAFT: { background: '#fff7ed', color: '#9a3412' },
  APPROVED: { background: '#dcfce7', color: '#166534' },
  ARCHIVED: { background: '#e5e7eb', color: '#374151' },
};

interface Props {
  status: CampaignBriefStatus;
}

export function BriefStatusBadge({ status }: Props) {
  const tone = STATUS_TONE[status];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.6rem',
        borderRadius: '999px',
        background: tone.background,
        color: tone.color,
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
