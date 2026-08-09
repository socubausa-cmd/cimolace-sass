/**
 * BARRE LATÉRALE — console SaaS Cimolace.
 *
 * Les entrées portaient des emoji système (📊 💰 🔑) : rendus par la police de
 * l'OS, ils changent de forme d'un poste à l'autre, imposent leurs couleurs
 * saturées — le 💰 est doré, et l'or est banni par la charte — et ne peuvent pas
 * hériter de la couleur du lien actif. Remplacés par lucide-react, monochromes.
 *
 * Les couleurs viennent des jetons partagés (../../pages/cimolace/theme) : la
 * coque et le corps se ressemblaient si peu qu'on voyait deux produits sur un
 * même écran.
 */

import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Radar, Users, Contact, GraduationCap, Plus, Globe,
  CreditCard, Wallet, KeyRound, Calculator, LifeBuoy,
} from 'lucide-react';
import { T, FS, R, useConsoleCss } from '../../pages/cimolace/theme';

const navItems = [
  { name: 'Dashboard', path: '/cimolace/admin', Icon: LayoutDashboard },
  { name: 'Monitoring', path: '/cimolace/admin/monitoring', Icon: Radar },
  { name: 'Clients', path: '/cimolace/admin/clients', Icon: Users },
  { name: 'CRM', path: '/cimolace/admin/crm', Icon: Contact },
  { name: 'Écoles', path: '/cimolace/admin/school-provisioning', Icon: GraduationCap },
  { name: 'Créer une école', path: '/cimolace/create-school', Icon: Plus },
  { name: 'Sites', path: '/cimolace/admin/sites', Icon: Globe },
  { name: 'Facturation', path: '/cimolace/admin/billing', Icon: CreditCard },
  { name: 'Finances', path: '/cimolace/admin/finances', Icon: Wallet },
  { name: 'Infrastructure', path: '/cimolace/admin/infrastructure', Icon: Activity },
  { name: 'Clés IA', path: '/cimolace/admin/ai-keys', Icon: KeyRound },
  { name: 'Tarification IA', path: '/cimolace/admin/ai-pricing', Icon: Calculator },
  { name: 'Support', path: '/cimolace/admin/support', Icon: LifeBuoy },
];

export default function CimolaceSidebar() {
  const location = useLocation();
  useConsoleCss();

  return (
    <aside style={{
      width: 232,
      flexShrink: 0,
      background: T.rail,
      borderRight: `1px solid ${T.line}`,
      display: 'flex',
      flexDirection: 'column',
      padding: 14,
      position: 'sticky',
      top: 64,
      height: 'calc(100vh - 64px)',
      overflowY: 'auto',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ fontSize: FS.xl, fontWeight: 700, color: T.ink, letterSpacing: '.02em' }}>Cimolace</div>
        <div style={{ fontSize: FS.xs, color: T.faint, marginTop: 2 }}>Console propriétaire</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ name, path, Icon }) => {
          const isActive = location.pathname === path
            || (path !== '/cimolace/admin' && location.pathname.startsWith(path));
          return (
            <Link
              key={name}
              to={path}
              aria-current={isActive ? 'page' : undefined}
              className="cml-focus"
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 11px', borderRadius: R.control, textDecoration: 'none',
                fontSize: FS.base, fontWeight: isActive ? 600 : 500,
                color: isActive ? T.coral : T.muted,
                background: isActive ? T.coralSoft : 'transparent',
                transition: 'background-color .15s ease, color .15s ease',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = T.ink; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = T.muted; }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {name}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
        <div style={{ fontSize: FS.xs, color: T.faint, textAlign: 'center' }}>v1.0.0</div>
      </div>
    </aside>
  );
}
