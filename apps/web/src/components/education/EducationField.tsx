'use client';

import { Children, cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { TermHelp } from '@/components/education/TermHelp';
import type { GlossaryEntry } from '@/lib/content/marketing-glossary';

export interface EducationFieldProps {
  id: string;
  label: string;
  term?: GlossaryEntry;
  help?: string;
  example?: string;
  warning?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function EducationField({
  id,
  label,
  term,
  help,
  example,
  warning,
  error,
  required,
  children,
}: EducationFieldProps) {
  const describedByParts = [`${id}-desc`];
  if (help) describedByParts.push(`${id}-help`);
  if (error) describedByParts.push(`${id}-err`);
  const describedBy = describedByParts.join(' ');

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
      ? `${prevDescribedBy} ${describedBy}`
      : describedBy;
    return cloneElement(element, {
      id: element.props.id ?? id,
      'aria-describedby': mergedDescribedBy,
      'aria-invalid': error ? true : element.props['aria-invalid'],
      'aria-required': required ? true : element.props['aria-required'],
      key: element.key ?? index,
    });
  });

  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <label
        htmlFor={id}
        style={{ color: '#1f2933', fontSize: '0.95rem', fontWeight: 600 }}
      >
        {label}
        {required ? (
          <span aria-hidden="true" style={{ color: '#991b1b', marginLeft: '0.25rem' }}>
            *
          </span>
        ) : null}
      </label>
      {term ? <TermHelp id={id} entry={term} /> : null}
      {help ? (
        <span id={`${id}-help`} style={{ color: '#52606d', fontSize: '0.85rem' }}>
          {help}
        </span>
      ) : null}
      {clonedChildren}
      {example ? (
        <details style={{ color: '#52606d', fontSize: '0.85rem' }}>
          <summary style={{ cursor: 'pointer', color: '#1f2933' }}>Ver ejemplo</summary>
          <p style={{ margin: '0.35rem 0 0', lineHeight: 1.4 }}>{example}</p>
        </details>
      ) : null}
      {warning ? (
        <p
          role="note"
          style={{
            margin: 0,
            padding: '0.5rem 0.6rem',
            borderRadius: '6px',
            background: '#fef3c7',
            color: '#92400e',
            fontSize: '0.85rem',
            lineHeight: 1.4,
          }}
        >
          {warning}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-err`}
          role="alert"
          style={{ margin: 0, color: '#991b1b', fontSize: '0.85rem' }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
