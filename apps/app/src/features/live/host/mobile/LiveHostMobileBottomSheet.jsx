import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Bottom sheet générique swipe-up — TikTok style.
 * Accepte `isOpen`, `onClose`, `title`, `children`.
 */
export function LiveHostMobileBottomSheet({ isOpen, onClose, title, children, maxHeightVh = 80 }) {
  const sheetRef = useRef(null);
  const startYRef = useRef(null);
  const [translateY, setTranslateY] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Reset translate on open
  useEffect(() => {
    if (isOpen) {
      setTranslateY(0);
      setAnimating(false);
    }
  }, [isOpen]);

  const onTouchStart = useCallback((e) => {
    startYRef.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (startYRef.current == null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) setTranslateY(delta);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (translateY > 120) {
      // swipe down → close
      setAnimating(true);
      setTranslateY(window.innerHeight);
      setTimeout(() => {
        setTranslateY(0);
        setAnimating(false);
        onClose?.();
      }, 280);
    } else {
      setTranslateY(0);
    }
    startYRef.current = null;
  }, [translateY, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 9000,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: `${maxHeightVh}vh`,
          background: 'linear-gradient(180deg, #1a1d2e 0%, #12141f 100%)',
          borderRadius: '20px 20px 0 0',
          zIndex: 9001,
          display: 'flex',
          flexDirection: 'column',
          transform: `translateY(${translateY}px)`,
          transition: animating ? 'transform 0.28s ease' : 'none',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
        </div>

        {/* Header */}
        {title && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>{title}</span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>
    </>
  );
}
