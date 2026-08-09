/**
 * EN-TÊTE — console SaaS Cimolace.
 *
 * Même socle de jetons que la barre latérale et les pages : la coque était en
 * slate-navy avec un accent bleu, le corps en GitHub-dark avec un accent violet.
 * Deux produits sur un même écran.
 */

import { T, FS, R } from '../../pages/cimolace/theme';

export default function CimolaceHeader() {
  return (
    <header style={{
      background: T.rail,
      borderBottom: `1px solid ${T.line}`,
      padding: '0 22px',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: T.ink }}>
        <span style={{ fontSize: FS.xl, fontWeight: 700, letterSpacing: '.01em' }}>Cimolace</span>
        <span style={{
          fontSize: FS.xs, fontWeight: 600, color: T.coral,
          background: T.coralSoft, border: `1px solid rgba(217,119,87,.32)`,
          padding: '2px 8px', borderRadius: R.pill,
        }}>
          Console propriétaire
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div aria-hidden style={{
          width: 32, height: 32, borderRadius: R.pill,
          background: T.coralSoft, border: `1px solid rgba(217,119,87,.32)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.coral, fontWeight: 700, fontSize: FS.base,
        }}>
          A
        </div>
        <span style={{ color: T.muted, fontSize: FS.base }}>Admin</span>
      </div>
    </header>
  );
}
