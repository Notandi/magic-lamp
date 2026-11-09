import { useEffect, useState, type CSSProperties, type SyntheticEvent } from 'react';

// The Credits overlay is plain HTML layered above the 3D canvas. Every pointer
// event inside it is stopped here so it can never reach the scene as a Rub.
const swallow = (e: SyntheticEvent) => e.stopPropagation();
const swallowPointer = {
  onPointerDown: swallow,
  onPointerMove: swallow,
  onPointerUp: swallow,
  onClick: swallow,
  onWheel: swallow,
  onTouchStart: swallow,
  onTouchMove: swallow,
};

const gold = '#e8c98a';

const styles = {
  button: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: `1px solid rgba(232, 201, 138, 0.35)`,
    background: 'rgba(20, 12, 30, 0.55)',
    color: gold,
    font: '20px/1 Georgia, serif',
    opacity: 0.7,
    cursor: 'pointer',
    padding: 0,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'rgba(5, 3, 8, 0.55)',
    cursor: 'auto',
  },
  panel: {
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: 440,
    maxHeight: 'calc(100dvh - 32px)',
    overflowY: 'auto',
    padding: '20px 22px',
    borderRadius: 10,
    border: `1px solid rgba(232, 201, 138, 0.3)`,
    background: '#160d22',
    color: '#e9e2f0',
    font: '14px/1.5 system-ui, sans-serif',
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    border: 'none',
    background: 'transparent',
    color: gold,
    fontSize: 22,
    cursor: 'pointer',
  },
  heading: { margin: '0 0 12px', color: gold, font: '600 18px/1.3 Georgia, serif' },
  section: { margin: '0 0 12px' },
  small: { fontSize: 12, opacity: 0.8 },
  link: { color: gold },
} satisfies Record<string, CSSProperties>;

export function CreditsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="credits-title" style={styles.panel}>
      <button type="button" aria-label="Close credits" style={styles.close} onClick={onClose}>
        ×
      </button>
      <h2 id="credits-title" style={styles.heading}>
        Credits
      </h2>
      {/* Verbatim from https://company.wizards.com/en/legal/fancontentpolicy — do not reword. */}
      <p style={styles.section}>
        Magic Lamp is unofficial Fan Content permitted under the Fan Content Policy. Not
        approved/endorsed by Wizards. Portions of the materials used are property of Wizards of
        the Coast. ©Wizards of the Coast LLC.
      </p>
      <p style={styles.section}>
        Card data and images from{' '}
        <a href="https://scryfall.com" target="_blank" rel="noreferrer" style={styles.link}>
          Scryfall
        </a>
        .
      </p>
      <p style={styles.section}>
        Hand model from{' '}
        <a
          href="https://github.com/immersive-web/webxr-input-profiles/tree/main/packages/assets"
          target="_blank"
          rel="noreferrer"
          style={styles.link}
        >
          WebXR Input Profiles
        </a>
        , used under the MIT License.
        <br />
        <span style={styles.small}>Copyright (c) 2019 Amazon</span>
      </p>
    </div>
  );
}

export function Credits() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Credits"
        aria-expanded={open}
        style={styles.button}
        {...swallowPointer}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        ⓘ
      </button>
      {open && (
        <div
          style={styles.backdrop}
          {...swallowPointer}
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <CreditsPanel onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
