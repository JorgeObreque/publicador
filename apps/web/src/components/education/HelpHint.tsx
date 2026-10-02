'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';

export interface HelpHintProps {
  term: string;
  description: string;
}

const MOUSELEAVE_DELAY_MS = 150;
const VIEWPORT_GUTTER = 8;
const POPOVER_OFFSET = 6;

const containerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  position: 'relative',
};

const triggerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.15rem',
  height: '1.15rem',
  borderRadius: '999px',
  border: '1px solid #94a3b8',
  background: '#e0e7ff',
  color: '#3730a3',
  fontSize: '0.7rem',
  fontWeight: 700,
  cursor: 'help',
  padding: 0,
  marginLeft: '0.15rem',
  lineHeight: 1,
  fontFamily: 'inherit',
};

const popoverStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 1100,
  background: '#1f2933',
  color: '#f8fafc',
  padding: '0.55rem 0.7rem',
  borderRadius: '8px',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.22)',
  fontSize: '0.85rem',
  lineHeight: 1.45,
  maxWidth: '320px',
  width: 'max-content',
};

const termStyle: CSSProperties = {
  fontWeight: 700,
};

export function HelpHint({ term, description }: HelpHintProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverId = useId();
  const hideRef = useRef<() => void>(() => undefined);

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current !== null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const show = () => {
    clearLeaveTimer();
    setOpen(true);
  };

  const scheduleHide = () => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      setOpen(false);
      leaveTimerRef.current = null;
    }, MOUSELEAVE_DELAY_MS);
  };

  const hide = () => {
    clearLeaveTimer();
    setOpen(false);
  };

  useEffect(() => {
    hideRef.current = hide;
  });

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const popover = popoverRef.current;
      const trigger = triggerRef.current;
      if (popover && popover.contains(target)) return;
      if (trigger && trigger.contains(target)) return;
      hideRef.current();
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        hideRef.current();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const popover = popoverRef.current;
    const trigger = triggerRef.current;
    if (!popover || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placeBelow = spaceBelow >= popRect.height + POPOVER_OFFSET || spaceBelow >= spaceAbove;
    const desiredTopRelative = placeBelow
      ? rect.bottom + POPOVER_OFFSET
      : rect.top - popRect.height - POPOVER_OFFSET;
    const desiredTop = desiredTopRelative + window.scrollY;

    let desiredLeft = rect.left + window.scrollX;
    const maxLeft = window.scrollX + viewportWidth - popRect.width - VIEWPORT_GUTTER;
    if (desiredLeft > maxLeft) desiredLeft = Math.max(window.scrollX + VIEWPORT_GUTTER, maxLeft);
    if (desiredLeft < window.scrollX + VIEWPORT_GUTTER) desiredLeft = window.scrollX + VIEWPORT_GUTTER;

    popover.style.top = `${desiredTop}px`;
    popover.style.left = `${desiredLeft}px`;
  }, [open]);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current !== null) {
        clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      show();
    }
  };

  const handleTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    show();
  };

  return (
    <span style={containerStyle}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Más información sobre ${term}`}
        aria-describedby={open ? popoverId : undefined}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        style={triggerStyle}
      >
        ?
      </button>
      {open ? (
        <div
          ref={popoverRef}
          id={popoverId}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
          style={popoverStyle}
        >
          <span style={termStyle}>({term})</span> {description}
        </div>
      ) : null}
    </span>
  );
}
