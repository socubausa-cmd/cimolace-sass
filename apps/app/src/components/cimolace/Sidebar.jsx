/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE SIDEBAR
 * Sidebar navigation pour CIMOLACE Back-Office
 * ═══════════════════════════════════════════════════════════════
 */

import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { name: 'Dashboard', path: '/cimolace/admin', icon: '📊' },
  { name: 'Monitoring', path: '/cimolace/admin/monitoring', icon: '🔭' },
  { name: 'Clients', path: '/cimolace/admin/clients', icon: '👥' },
  { name: 'CRM', path: '/cimolace/admin/crm', icon: '📇' },
  { name: 'Écoles', path: '/cimolace/admin/school-provisioning', icon: '🎓' },
  { name: 'Créer une école', path: '/cimolace/create-school', icon: '➕' },
  { name: 'Sites', path: '/cimolace/admin/sites', icon: '🌐' },
  { name: 'Billing', path: '/cimolace/admin/billing', icon: '💳' },
  { name: 'Finances', path: '/cimolace/admin/finances', icon: '💰' },
  { name: 'Clés IA', path: '/cimolace/admin/ai-keys', icon: '🔑' },
  { name: 'Support', path: '/cimolace/admin/support', icon: '🎫' },
];

export default function CimolaceSidebar() {
  const location = useLocation();

  return (
    <aside style={{
      width: '240px',
      backgroundColor: '#1e293b',
      borderRight: '1px solid #334155',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      position: 'sticky',
      top: '64px',
      height: 'calc(100vh - 64px)',
      overflowY: 'auto',
    }}>
      {/* Logo section */}
      <div style={{
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #334155',
      }}>
        <div style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: 'white',
          letterSpacing: '0.5px',
        }}>
          CIMOLACE
        </div>
        <div style={{
          fontSize: '11px',
          color: '#94a3b8',
          marginTop: '4px',
        }}>
          Back-Office
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                          (item.path !== '/cimolace/admin' && location.pathname.startsWith(item.path));
          
          return (
            <Link
              key={item.name}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500',
                color: isActive ? 'white' : '#94a3b8',
                backgroundColor: isActive ? '#3b82f6' : 'transparent',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = '#334155';
                  e.target.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#94a3b8';
                }
              }}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        paddingTop: '16px',
        borderTop: '1px solid #334155',
      }}>
        <div style={{
          fontSize: '12px',
          color: '#64748b',
          textAlign: 'center',
        }}>
          v1.0.0
        </div>
      </div>
    </aside>
  );
}
