import { Children, cloneElement, isValidElement, memo } from 'react';
import type { ReactElement, ReactNode } from 'react';

export interface FieldShellProps {
  id?: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  term?: string;
  children: ReactNode;
}

function FieldShellBase({ id, label, required, error, hint, term, children }: FieldShellProps) {
  const childId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const helpId = `${childId}-help`;
  const errorId = `${childId}-err`;
  const describedBy = [hint ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  const childArray = Children.toArray(children);
  const clonedChildren = childArray.map((child, index) => {
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<{
      id?: string;
      'aria-describedby'?: string;
      'aria-invalid'?: boolean;
      'aria-required'?: boolean;
    }>;
    const prevDescribedBy =
      typeof element.props['aria-describedby'] === 'string'
        ? element.props['aria-describedby']
        : undefined;
    const mergedDescribedBy = prevDescribedBy
      ? `${prevDescribedBy} ${describedBy ?? ''}`.trim()
      : describedBy;
    return cloneElement(element, {
      id: element.props.id ?? childId,
      'aria-describedby': mergedDescribedBy,
      'aria-invalid': error ? true : element.props['aria-invalid'],
      'aria-required': required ? true : element.props['aria-required'],
      key: element.key ?? index,
    });
  });

  return (
    <label htmlFor={childId} style={{ display: 'grid', gap: '0.35rem' }}>
      <span style={{ color: '#1f2933', fontSize: '0.95rem', fontWeight: 600 }}>
        {label}
        {term ? (
          <span style={{ fontWeight: 400, color: '#52606d' }}> ({term})</span>
        ) : null}
        {required ? (
          <span aria-hidden="true" style={{ color: '#991b1b', marginLeft: '0.25rem' }}>
            *
          </span>
        ) : null}
      </span>
      {hint ? (
        <span id={helpId} style={{ color: '#52606d', fontSize: '0.85rem' }}>
          {hint}
        </span>
      ) : null}
      {clonedChildren}
      {error ? (
        <span id={errorId} role="alert" style={{ color: '#991b1b', fontSize: '0.85rem' }}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

export const FieldShell = memo(FieldShellBase);
