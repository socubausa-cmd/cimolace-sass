import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, LayoutDashboard } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { resolveDashboardPath } from '@/lib/dashboardRoute';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const Footer = () => {
  const vitrineEmail = useVitrineContactEmail();
  const { branding } = useTenantBranding();
  const currentYear = new Date().getFullYear();
  const { user } = useAuth();
  const dashboardPath = resolveDashboardPath(user);
  const accentColor = branding.accentColor || '#D4AF37';

  return (
    <footer className="bg-black border-t border-white/10 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-6">
            <Logo size="small" variant="dark" showText={true} />
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              De la prophétie à la raison, de la raison à la science.
              L'école de l\'excellence et de la rigueur scientifique et symbolique.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-serif font-bold text-lg mb-6">Navigation</h3>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><BrandLink to="/" accentColor={accentColor}>Accueil</BrandLink></li>
              <li><BrandLink to="/formations/catalogue" accentColor={accentColor}>Catalogue des formations</BrandLink></li>
              <li><BrandLink to="/equipe" accentColor={accentColor}>Équipe Pédagogique</BrandLink></li>
              <li><BrandLink to="/a-propos" accentColor={accentColor}>À propos</BrandLink></li>
            </ul>
          </div>

          {/* Gestion Section (NEW) */}
          <div>
            <h3 className="text-white font-serif font-bold text-lg mb-6">Gestion</h3>
            <ul className="space-y-4 text-sm text-gray-400">
               <li>
                  <Link to={dashboardPath} className="flex items-center transition-colors group" style={{ '--hover-color': accentColor }} onMouseEnter={(ev) => { ev.currentTarget.style.color = accentColor; }} onMouseLeave={(ev) => { ev.currentTarget.style.color = ''; }}>
                     <LayoutDashboard className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                     Tableau de bord
                  </Link>
               </li>
              <li><BrandLink to="/profil/mon-profil" accentColor={accentColor}>Mon Profil</BrandLink></li>
              <li><BrandLink to="/settings" accentColor={accentColor}>Paramètres</BrandLink></li>
              <li><BrandLink to="/appointment/request" accentColor={accentColor}>Contacter un conseiller</BrandLink></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-serif font-bold text-lg mb-6">Nous Contacter</h3>
            <ul className="space-y-4 text-sm text-gray-400">
              <li className="flex items-start">
                <MapPin className="w-5 h-5 mr-3 flex-shrink-0" style={{ color: accentColor }} />
                <span>Agondjé Village,<br />Libreville, Gabon</span>
              </li>
              <li className="flex items-center">
                <Phone className="w-5 h-5 mr-3 flex-shrink-0" style={{ color: accentColor }} />
                <span>+33 7 66 52 57 08</span>
              </li>
              <li className="flex items-center">
                <Mail className="w-5 h-5 mr-3 flex-shrink-0" style={{ color: accentColor }} />
                <a href={`mailto:${vitrineEmail}`} className="hover:text-white transition-colors">
                  {vitrineEmail}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>{`© ${currentYear} ${branding.name} · LIRI. Tous droits réservés.`}</p>
          <div className="flex gap-4">
            <BrandLink to="/conditions-utilisation" accentColor={accentColor}>CGU</BrandLink>
            <BrandLink to="/politique-confidentialite" accentColor={accentColor}>Confidentialité</BrandLink>
            <BrandLink to="/mentions-legales" accentColor={accentColor}>Mentions légales</BrandLink>
          </div>
        </div>
      </div>
    </footer>
  );
};

function BrandLink({ to, accentColor, children }) {
  return (
    <Link
      to={to}
      className="transition-colors"
      onMouseEnter={(ev) => { ev.currentTarget.style.color = accentColor; }}
      onMouseLeave={(ev) => { ev.currentTarget.style.color = ''; }}
    >
      {children}
    </Link>
  );
}

export default Footer;
