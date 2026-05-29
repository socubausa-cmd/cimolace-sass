/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LAYOUT
 * Layout dédié aux écrans CIMOLACE (shell produit, pas la vitrine école ISNA)
 * ═══════════════════════════════════════════════════════════════
 */

import { Outlet } from 'react-router-dom';
import CimolaceHeader from '@/components/cimolace/Header';

export default function CimolaceLayout() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <CimolaceHeader />
      <Outlet />
    </div>
  );
}
