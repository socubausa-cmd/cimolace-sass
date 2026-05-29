import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { OS_LIST } from '@/data/cimolaceOsData';

function truncateNav(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  const cut = str.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export default function CimolaceMarketingNav({ scrolled, homePath = '/cimolace' }) {
  const [dropOpen, setDropOpen] = useState(false);
  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
      <div className="nav-inner">
        <Link className="brand" to={homePath}>CIMOLACE<span className="brand-dot">.</span></Link>
        <div className="nav-links">
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setDropOpen(true)}
            onMouseLeave={() => setDropOpen(false)}
          >
            <Link className="nav-link has-dropdown" to={`${homePath}#os`}>Solutions</Link>
            {dropOpen && (
              <div
                className="dropdown"
                style={{
                  opacity: 1,
                  pointerEvents: 'auto',
                  transform: 'translateX(-50%) translateY(2px)',
                }}
              >
                {OS_LIST.map(os => (
                  <Link key={os.id} className="dropdown-item" to={`/cimolace/os/${os.id}`}>
                    <div className="dropdown-icon" style={{ background: os.colorHex }}>{os.icon}</div>
                    <div className="dropdown-meta">
                      <div className="dropdown-name">{os.name}</div>
                      <div className="dropdown-desc">{os.tagline}</div>
                      {os.impactPhrase ? (
                        <div className="dropdown-desc" style={{ marginTop: 6, fontSize: 12, opacity: 0.92 }}>
                          {truncateNav(os.impactPhrase, 110)}
                        </div>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link className="nav-link" to={`${homePath}#how`}>Capacités</Link>
          <Link className="nav-link" to="/cimolace/comparaison">Comparer</Link>
          <Link className="nav-link" to="/cimolace/architecture">Architecture</Link>
          <Link className="nav-link" to="/cimolace/resources/documentation">Docs</Link>
          <Link className="nav-link" to="/cimolace/resources/guide">Guide</Link>
          <Link className="nav-link" to={`${homePath}#pricing`}>Tarifs</Link>
          <Link className="nav-link" to="/cimolace/hebergement">Hébergement</Link>
          <Link className="nav-link" to="/cimolace/contact">Contact</Link>
        </div>
        <Link className="nav-cta" to="/cimolace/installer">Créer ma plateforme</Link>
      </div>
    </nav>
  );
}
