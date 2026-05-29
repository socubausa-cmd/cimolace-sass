/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE HEADER
 * Header spécifique pour CIMOLACE Back-Office
 * ═══════════════════════════════════════════════════════════════
 */

export default function CimolaceHeader() {
  return (
    <header style={{
      backgroundColor: '#1e293b',
      borderBottom: '1px solid #334155',
      padding: '0 24px',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        color: 'white',
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold',
          letterSpacing: '0.5px',
        }}>
          CIMOLACE
        </div>
        <span style={{
          marginLeft: '8px',
          fontSize: '12px',
          backgroundColor: '#3b82f6',
          padding: '2px 8px',
          borderRadius: '4px',
          fontWeight: '500',
        }}>
          Back-Office
        </span>
      </div>

      {/* User Menu */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '14px',
        }}>
          A
        </div>
        <div style={{
          color: '#e2e8f0',
          fontSize: '14px',
        }}>
          Admin
        </div>
      </div>
    </header>
  );
}
