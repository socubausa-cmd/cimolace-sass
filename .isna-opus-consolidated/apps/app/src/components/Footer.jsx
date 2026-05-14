import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, LayoutDashboard } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { resolveDashboardPath } from '@/lib/dashboardRoute';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const Footer = () => {
  const vitrineEmail = useVitrineContactEmail();
  const currentYear = new Date().getFullYear();
  const { user } = useAuth();
  const dashboardPath = resolveDashboardPath(user);

  return (
    <footer className="bg-black border-t border-white/10 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-6">
            <Logo size="small" variant="dark" showText={true} />
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              De la prophétie à la raison, de la raison à la science.
              L'école de l'excellence et de la rigueur scientifique et symbolique.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-serif font-bold text-lg mb-6">Navigation</h3>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><Link to="/" className="hover:text-[#D4AF37] transition-colors">Accueil</Link></li>
              <li><Link to="/formations/catalogue" className="hover:text-[#D4AF37] transition-colors">Catalogue des formations</Link></li>
              <li><Link to="/equipe" className="hover:text-[#D4AF37] transition-colors">Équipe Pédagogique</Link></li>
              <li><Link to="/a-propos" className="hover:text-[#D4AF37] transition-colors">À propos</Link></li>
            </ul>
          </div>

          {/* Gestion Section (NEW) */}
          <div>
            <h3 className="text-white font-serif font-bold text-lg mb-6">Gestion</h3>
            <ul className="space-y-4 text-sm text-gray-400">
               <li>
                  <Link to={dashboardPath} className="flex items-center hover:text-[#D4AF37] transition-colors group">
                     <LayoutDashboard className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                     Tableau de bord
                  </Link>
               </li>
              <li><Link to="/profil/mon-profil" className="hover:text-[#D4AF37] transition-colors">Mon Profil</Link></li>
              <li><Link to="/settings" className="hover:text-[#D4AF37] transition-colors">Paramètres</Link></li>
              <li><Link to="/appointment/request" className="hover:text-[#D4AF37] transition-colors">Contacter un conseiller</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-serif font-bold text-lg mb-6">Nous Contacter</h3>
            <ul className="space-y-4 text-sm text-gray-400">
              <li className="flex items-start">
                <MapPin className="w-5 h-5 mr-3 text-[#D4AF37] flex-shrink-0" />
                <span>Agondjé Village,<br />Libreville, Gabon</span>
              </li>
              <li className="flex items-center">
                <Phone className="w-5 h-5 mr-3 text-[#D4AF37] flex-shrink-0" />
                <span>+33 7 66 52 57 08</span>
              </li>
              <li className="flex items-center">
                <Mail className="w-5 h-5 mr-3 text-[#D4AF37] flex-shrink-0" />
                <a href={`mailto:${vitrineEmail}`} className="hover:text-white transition-colors">
                  {vitrineEmail}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>{`© ${currentYear} ${isnaTenantConfig.branding.name} · LIRI. Tous droits réservés.`}</p>
          <div className="flex gap-4">
            <Link to="/conditions-utilisation" className="hover:text-[#D4AF37] transition-colors">CGU</Link>
            <Link to="/politique-confidentialite" className="hover:text-[#D4AF37] transition-colors">Confidentialité</Link>
            <Link to="/mentions-legales" className="hover:text-[#D4AF37] transition-colors">Mentions légales</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;