import type { GlossaryEntry } from '@/lib/content/marketing-glossary';

export interface TermHelpProps {
  id: string;
  entry: GlossaryEntry;
}

export function TermHelp({ id, entry }: TermHelpProps) {
  const descId = `${id}-desc`;
  const hasExample = Boolean(entry.example);
  const hasWarning = Boolean(entry.warning);

  return (
    <span style={{ display: 'block', marginTop: '0.25rem' }}>
      <span
        style={{
          display: 'inline',
          color: '#1f2933',
          fontWeight: 600,
          fontSize: '0.95rem',
        }}
      >
        {entry.everydayLabel}
        {entry.technicalTerm ? (
          <span style={{ fontWeight: 400, color: '#52606d' }}> ({entry.technicalTerm})</span>
        ) : null}
      </span>
      <span
        id={descId}
        style={{
          display: 'block',
          marginTop: '0.15rem',
          color: '#3e4c59',
          fontSize: '0.85rem',
          lineHeight: 1.4,
        }}
      >
        {entry.short}
      </span>
      {hasExample ? (
        <details
          style={{
            marginTop: '0.35rem',
            color: '#3e4c59',
            fontSize: '0.85rem',
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              color: '#1f2933',
              fontSize: '0.85rem',
            }}
          >
            Ver ejemplo
          </summary>
          <div style={{ marginTop: '0.35rem' }}>
            <p style={{ margin: 0, lineHeight: 1.4 }}>{entry.example}</p>
            {hasWarning ? (
              <p
                style={{
                  margin: '0.5rem 0 0',
                  padding: '0.5rem 0.6rem',
                  borderRadius: '6px',
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '0.85rem',
                  lineHeight: 1.4,
                }}
              >
                {entry.warning}
              </p>
            ) : null}
          </div>
        </details>
      ) : hasWarning ? (
        <p
          role="note"
          style={{
            margin: '0.35rem 0 0',
            padding: '0.5rem 0.6rem',
            borderRadius: '6px',
            background: '#fef3c7',
            color: '#92400e',
            fontSize: '0.85rem',
            lineHeight: 1.4,
          }}
        >
          {entry.warning}
        </p>
      ) : null}
    </span>
  );
}
