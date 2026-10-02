'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export type ConfirmDialogTone = 'info' | 'warn' | 'danger';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  tone?: ConfirmDialogTone;
}

const TONE_COLORS: Record<ConfirmDialogTone, { primaryBg: string; primaryFg: string; border: string }> = {
  info: { primaryBg: '#1f2933', primaryFg: '#ffffff', border: '#1f2933' },
  warn: { primaryBg: '#92400e', primaryFg: '#ffffff', border: '#92400e' },
  danger: { primaryBg: '#991b1b', primaryFg: '#ffffff', border: '#991b1b' },
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  children,
  primaryLabel = 'Confirmar',
  secondaryLabel = 'Cancelar',
  onPrimary,
  tone = 'info',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onPrimaryRef = useRef(onPrimary);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onPrimaryRef.current = onPrimary;
  }, [onPrimary]);

  const handleClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const native = typeof dialog.showModal === 'function';
    if (native) {
      if (!dialog.open) dialog.showModal();
    } else if (!dialog.hasAttribute('open')) {
      dialog.setAttribute('open', '');
    }
    previousFocusRef.current =
      typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    const focusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable) {
      focusable.focus();
    } else {
      dialog.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [open, handleClose]);

  const colors = TONE_COLORS[tone];

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      open
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: 0,
        background: '#ffffff',
        color: '#1f2933',
        maxWidth: '480px',
        width: 'calc(100% - 2rem)',
      }}
    >
      <div style={{ display: 'grid', gap: '0.75rem', padding: '1.25rem' }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: '1.1rem' }}>
          {title}
        </h2>
        {description ? (
          <p id={descId} style={{ margin: 0, color: '#3e4c59', fontSize: '0.95rem', lineHeight: 1.4 }}>
            {description}
          </p>
        ) : null}
        {children ? <div style={{ color: '#3e4c59', fontSize: '0.95rem' }}>{children}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleClose} style={secondaryButtonStyle}>
            {secondaryLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onPrimaryRef.current?.();
              handleClose();
            }}
            style={{
              ...primaryButtonStyle,
              background: colors.primaryBg,
              color: colors.primaryFg,
              borderColor: colors.primaryBg,
            }}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

const primaryButtonStyle = {
  padding: '0.5rem 0.9rem',
  borderRadius: '8px',
  border: '1px solid #1f2933',
  background: '#1f2933',
  color: '#ffffff',
  fontSize: '0.9rem',
  cursor: 'pointer',
} as const;

const secondaryButtonStyle = {
  padding: '0.5rem 0.9rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  background: '#ffffff',
  color: '#1f2933',
  fontSize: '0.9rem',
  cursor: 'pointer',
} as const;
