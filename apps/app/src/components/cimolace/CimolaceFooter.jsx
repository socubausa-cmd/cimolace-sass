import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Twitter, Linkedin, Github, Mail } from 'lucide-react';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

const footerLinks = {
  produits: [
    { label: 'Installateur', href: cimolacePlatformConfig.routes.installer, isRoute: true },
    { label: 'Solutions', href: cimolacePlatformConfig.routes.solutions, isRoute: true },
    { label: 'Virtuel Mbolo', href: '/cimolace/solutions/virtuel-mbolo', isRoute: true },
    { label: 'Configurateur', href: '/cimolace/configurateur', isRoute: true },
    { label: 'Tarifs', href: cimolacePlatformConfig.routes.subscription, isRoute: true },
  ],
  entreprise: [
    { label: 'Contact', href: cimolacePlatformConfig.routes.contact, isRoute: true },
    { label: 'À propos', href: cimolacePlatformConfig.routes.about, isRoute: true },
    { label: 'Carrières', href: cimolacePlatformConfig.routes.companyCareers, isRoute: true },
    { label: 'Blog', href: cimolacePlatformConfig.routes.companyBlog, isRoute: true },
    { label: 'Presse', href: cimolacePlatformConfig.routes.companyPress, isRoute: true },
  ],
  ressources: [
    { label: 'Documentation', href: cimolacePlatformConfig.routes.resourcesDocs, isRoute: true },
    { label: 'API', href: cimolacePlatformConfig.routes.resourcesApi, isRoute: true },
    { label: 'Guide', href: cimolacePlatformConfig.routes.resourcesGuide, isRoute: true },
    { label: 'Support', href: cimolacePlatformConfig.routes.resourcesSupport, isRoute: true },
  ],
  legal: [
    { label: 'Confidentialité', href: cimolacePlatformConfig.routes.legalPrivacy, isRoute: true },
    { label: 'CGU', href: cimolacePlatformConfig.routes.legalTerms, isRoute: true },
    { label: 'Cookies', href: cimolacePlatformConfig.routes.legalCookies, isRoute: true },
  ],
};

const socialLinks = [
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: Mail, href: `mailto:${cimolacePlatformConfig.contactEmail}`, label: 'Email' },
];

/**
 * @param {{ variant?: 'light' | 'dark' }} props
 */
const CimolaceFooter = ({ variant = 'light' }) => {
  const isLight = variant === 'light';

  // Theme classes
  const bgClass = isLight ? 'bg-[#fafafa] border-t border-[#e5e5ea]' : 'bg-[#0a0a0f] border-t border-white/5';
  const textColor = isLight ? 'text-[#0a0a0f]' : 'text-white';
  const mutedColor = isLight ? 'text-[#6e6e73]' : 'text-gray-400';
  const linkHover = isLight ? 'hover:text-[#5b3df5]' : 'hover:text-white';
  const socialBg = isLight ? 'bg-[#0a0a0f]/5 border-[#e5e5ea] hover:bg-[#0a0a0f]/10' : 'bg-white/5 border-white/10 hover:border-white/30';
  const bottomBorder = isLight ? 'border-t border-[#e5e5ea]' : 'border-t border-white/5';

  return (
    <footer className={`relative ${bgClass}`}>
      {/* Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#5b3df5]/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12 mb-16">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link to={cimolacePlatformConfig.routes.home} className="inline-flex items-center gap-3 mb-6">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 bg-gradient-to-br from-[#5b3df5] to-[#8b6dff] rounded-xl blur-lg opacity-50" />
                <div className="relative w-full h-full bg-gradient-to-br from-[#5b3df5] to-[#8b6dff] rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <span className={`text-xl font-bold tracking-tight ${textColor}`}>CIMOLACE<span className="text-[#5b3df5]">.</span></span>
              </div>
            </Link>
            <p className={`${mutedColor} text-sm max-w-xs mb-6 leading-relaxed`}>
              L&apos;infrastructure intelligente qui permet aux entreprises africaines de vendre,
              enseigner, automatiser et créer sans limites.
            </p>
            {/* Social Links */}
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`w-10 h-10 rounded-lg border ${socialBg} flex items-center justify-center ${mutedColor} ${linkHover} transition-colors`}
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className={`font-semibold mb-4 text-sm ${textColor}`}>Produits</h4>
            <ul className="space-y-3">
              {footerLinks.produits.map((link) => (
                <li key={link.label}>
                  {link.isRoute ? (
                    <Link
                      to={link.href}
                      className={`text-sm ${mutedColor} ${linkHover} transition-colors`}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className={`text-sm ${mutedColor} ${linkHover} transition-colors`}
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className={`font-semibold mb-4 text-sm ${textColor}`}>Entreprise</h4>
            <ul className="space-y-3">
              {footerLinks.entreprise.map((link) => (
                <li key={link.label}>
                  {link.isRoute ? (
                    <Link
                      to={link.href}
                      className={`text-sm ${mutedColor} ${linkHover} transition-colors`}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className={`text-sm ${mutedColor} ${linkHover} transition-colors`}
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className={`font-semibold mb-4 text-sm ${textColor}`}>Ressources</h4>
            <ul className="space-y-3">
              {footerLinks.ressources.map((link) => (
                <li key={link.label}>
                  {link.isRoute ? (
                    <Link
                      to={link.href}
                      className={`text-sm ${mutedColor} ${linkHover} transition-colors`}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className={`text-sm ${mutedColor} ${linkHover} transition-colors`}
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className={`font-semibold mb-4 text-sm ${textColor}`}>Légal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  {link.isRoute ? (
                    <Link
                      to={link.href}
                      className={`text-sm ${mutedColor} ${linkHover} transition-colors`}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className={`text-sm ${mutedColor} ${linkHover} transition-colors`}
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={`pt-8 ${bottomBorder} flex flex-col md:flex-row items-center justify-between gap-4`}>
          <p className={`text-sm ${mutedColor}`}>
            {cimolacePlatformConfig.copyrightLine}. Infrastructure intelligente pour l&apos;Afrique.
          </p>
          <div className={`flex items-center gap-6 text-sm ${mutedColor}`}>
            <span>Conçu pour l&apos;Afrique</span>
            <span className="hidden md:inline">·</span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#2cc275] rounded-full animate-pulse" />
              Systèmes opérationnels
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default CimolaceFooter;
