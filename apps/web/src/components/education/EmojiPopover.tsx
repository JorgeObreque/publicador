'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

export interface EmojiCategory {
  label: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: ReadonlyArray<EmojiCategory> = [
  {
    label: 'Servicio/Estética',
    emojis: ['💇‍♀️', '✂️', '💅', '💄', '✨', '💫'],
  },
  {
    label: 'Resultados',
    emojis: ['🌟', '🎯', '🏆', '✨', '🌸'],
  },
  {
    label: 'Cercanía',
    emojis: ['🤍', '📍', '🏠', '💬'],
  },
  {
    label: 'Confianza',
    emojis: ['🔒', '🛡️', '✅', '👍'],
  },
  {
    label: 'Novedad',
    emojis: ['🆕', '🎉', '🌟'],
  },
  {
    label: 'Símbolos',
    emojis: ['✨', '📍', '🤍', '💬', '📞', '💌'],
  },
];

export interface EmojiPopoverProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

const POPOVER_WIDTH = 296;
const VIEWPORT_GUTTER = 8;

const popoverStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 1000,
  background: '#ffffff',
  border: '1px solid #cbd2d9',
  borderRadius: '10px',
  padding: '0.75rem',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
  width: `${POPOVER_WIDTH}px`,
  maxHeight: '320px',
  overflowY: 'auto',
  display: 'grid',
  gap: '0.75rem',
};

const categoryLabelStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#52606d',
  marginBottom: '0.35rem',
};

const emojiGridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.25rem',
};

export function EmojiPopover({ onSelect, onClose, anchorRef }: EmojiPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const popover = popoverRef.current;
    const anchor = anchorRef.current;
    if (popover && anchor) {
      const rect = anchor.getBoundingClientRect();
      const desiredTop = rect.bottom + window.scrollY + 6;
      let desiredLeft = rect.left + window.scrollX;
      const maxLeft =
        window.scrollX + window.innerWidth - POPOVER_WIDTH - VIEWPORT_GUTTER;
      if (desiredLeft > maxLeft) desiredLeft = maxLeft;
      if (desiredLeft < window.scrollX + VIEWPORT_GUTTER) {
        desiredLeft = window.scrollX + VIEWPORT_GUTTER;
      }
      popover.style.top = `${desiredTop}px`;
      popover.style.left = `${desiredLeft}px`;
    }
    firstButtonRef.current?.focus();
  }, [anchorRef]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const popover = popoverRef.current;
      const anchor = anchorRef.current;
      const target = event.target as Node | null;
      if (!target) return;
      if (popover && popover.contains(target)) return;
      if (anchor && anchor.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose]);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
  };

  let isFirstButton = true;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label="Emojis comunes para tu marca"
      style={popoverStyle}
    >
      {EMOJI_CATEGORIES.map((category) => (
        <div key={category.label}>
          <div style={categoryLabelStyle}>{category.label}</div>
          <div style={emojiGridStyle}>
            {category.emojis.map((emoji) => {
              const isFirst = isFirstButton;
              isFirstButton = false;
              return (
                <button
                  key={`${category.label}-${emoji}`}
                  ref={isFirst ? firstButtonRef : undefined}
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  aria-label={`Agregar emoji ${emoji}`}
                  data-testid={`emoji-popover-${emoji}`}
                  style={{
                    fontSize: '1.25rem',
                    padding: '0.25rem 0.45rem',
                    border: '1px solid transparent',
                    borderRadius: '6px',
                    background: 'transparent',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd2d9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}