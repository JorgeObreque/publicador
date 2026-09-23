import { STEPS } from '@/lib/campaigns/wizard';
import type { CampaignStepId } from '@/lib/campaigns/wizard';

interface Props {
  current: CampaignStepId;
  onSelect: (step: CampaignStepId) => void;
}

export function CampaignWizardNav({ current, onSelect }: Props) {
  return (
    <ol style={{ display: 'flex', gap: '0.5rem', padding: 0, margin: 0, listStyle: 'none', flexWrap: 'wrap' }}>
      {STEPS.map((step, index) => {
        const isCurrent = step.id === current;
        return (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '999px',
                border: '1px solid',
                borderColor: isCurrent ? '#1f2933' : '#cbd2d9',
                background: isCurrent ? '#1f2933' : '#ffffff',
                color: isCurrent ? '#ffffff' : '#1f2933',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {index + 1}. {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
