import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export const LiveHostMobileCameraQrModal = ({
  open,
  isGuestUi,
  loading,
  errorMsg,
  joinUrl,
  expiresAt,
  onClose,
  onCopy,
}) => {
  if (!open || isGuestUi) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="liri-mobile-camera-qr-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,.78)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 380,
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,.12)',
          background: 'linear-gradient(165deg,#12142a,#0a0b14)',
          padding: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,.55)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div>
            <h2 id="liri-mobile-camera-qr-title" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>
              Caméra mobile (QR)
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 10, color: 'rgba(255,255,255,.45)', lineHeight: 1.45 }}>
              Scannez avec le téléphone. Sur ce PC : scène <strong style={{ color: '#67e8f9' }}>Cam 2</strong> → flux{' '}
              <strong style={{ color: '#67e8f9' }}>Caméra mobile LIRI</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'rgba(255,255,255,.5)',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>
        {loading ? (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', textAlign: 'center', padding: '24px 0' }}>
            Génération du lien…
          </p>
        ) : null}
        {errorMsg ? (
          <p style={{ fontSize: 11, color: '#fca5a5', marginBottom: 12 }}>{errorMsg}</p>
        ) : null}
        {!loading && joinUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 12, background: '#fff', borderRadius: 8 }}>
              <QRCodeSVG value={joinUrl} size={200} level="M" />
            </div>
            {expiresAt ? (
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', margin: 0 }}>
                Expire le{' '}
                {new Date(expiresAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onCopy}
              style={{
                borderRadius: 8,
                border: '1px solid rgba(34,211,238,.35)',
                background: 'rgba(6,182,212,.12)',
                padding: '8px 14px',
                fontSize: 11,
                fontWeight: 700,
                color: '#67e8f9',
                cursor: 'pointer',
              }}
            >
              Copier le lien
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LiveHostMobileCameraQrModal;
