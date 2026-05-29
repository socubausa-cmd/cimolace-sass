import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X, Zap } from 'lucide-react';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

const MotionLink = motion.create(Link);

const navLinks = [
  { label: 'Accueil', href: cimolacePlatformConfig.routes.home, isRoute: true },
  { label: 'OS & produits', href: '/cimolace/products', isRoute: true, highlight: true },
  { label: 'Comparer', href: '/cimolace/comparaison', isRoute: true },
  { label: 'Architecture', href: '/cimolace/architecture', isRoute: true },
  { label: 'Guide', href: '/cimolace/resources/guide', isRoute: true },
  { label: 'Tarifs', href: '/cimolace#pricing' },
  { label: 'Hébergement', href: cimolacePlatformConfig.routes.hosting, isRoute: true },
  { label: 'Contact', href: cimolacePlatformConfig.routes.contact, isRoute: true },
];

/**
 * @param {{ variant?: 'light' | 'dark' }} props
 */
const CimolaceHeader = ({ variant = 'light' }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Design system colors from cimolace.html
  const isLight = variant === 'light';
  const bgClass = isScrolled
    ? isLight
      ? 'bg-white/90 backdrop-blur-xl border-b border-[#e5e5ea]'
      : 'bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5'
    : isLight
      ? 'bg-white/70 backdrop-blur-xl border-b border-black/5'
      : 'bg-transparent';

  const textColor = isLight ? 'text-[#0a0a0f]' : 'text-white';
  const mutedColor = isLight ? 'text-[#6e6e73]' : 'text-gray-400';
  const hoverColor = isLight ? 'hover:text-[#0a0a0f]' : 'hover:text-white';
  const mobileBg = isLight ? 'bg-white/95' : 'bg-[#0a0a0f]/95';
  const mobileBorder = isLight ? 'border-[#e5e5ea]' : 'border-white/5';

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${bgClass}`}>
      <div className="mx-auto max-w-[1440px] px-5 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-[72px]">
          {/* Logo */}
          <Link to="/cimolace" className="flex shrink-0 items-center gap-3">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 bg-gradient-to-br from-[#5b3df5] to-[#8b6dff] rounded-xl blur-lg opacity-50" />
              <div className="relative w-full h-full bg-gradient-to-br from-[#5b3df5] to-[#8b6dff] rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <span className={`text-lg font-black tracking-tight ${textColor}`}>CIMOLACE<span className="text-[#5b3df5]">.</span></span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) =>
              link.isRoute ? (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`whitespace-nowrap px-3 py-2 text-sm font-semibold transition-all duration-200 rounded-lg ${
                    link.highlight
                      ? isLight
                        ? 'text-[#5b3df5] hover:bg-[#5b3df5]/10'
                        : 'text-[#8b6dff] hover:bg-white/5'
                      : `${mutedColor} ${hoverColor} hover:bg-black/5`
                  }`}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className={`whitespace-nowrap px-3 py-2 text-sm font-semibold ${mutedColor} ${hoverColor} hover:bg-black/5 rounded-lg transition-all duration-200`}
                >
                  {link.label}
                </a>
              )
            )}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden shrink-0 md:flex items-center gap-3">
            <Link
              to="/cimolace/login"
              className={`px-4 py-2 text-sm font-medium ${mutedColor} ${hoverColor} transition-colors`}
            >
              Connexion
            </Link>
            <MotionLink
              to="/cimolace/installer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                isLight
                  ? 'bg-[#0a0a0f] text-white hover:bg-[#5b3df5]'
                  : 'bg-white text-[#0a0a0f] hover:bg-[#5b3df5] hover:text-white'
              }`}
            >
              Commencer
            </MotionLink>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`lg:hidden p-2 ${textColor}`}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <motion.div
        initial={false}
        animate={isMobileMenuOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        className={`lg:hidden absolute top-full left-0 right-0 ${mobileBg} backdrop-blur-xl border-b ${mobileBorder} ${
          isMobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div className="px-6 py-8 space-y-4">
          {navLinks.map((link) =>
            link.isRoute ? (
              <Link
                key={link.label}
                to={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block text-base font-medium transition-colors py-2 ${
                  link.highlight
                    ? isLight ? 'text-[#5b3df5]' : 'text-[#8b6dff]'
                    : isLight ? 'text-[#424245] hover:text-[#0a0a0f]' : 'text-gray-300 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block text-base font-medium py-2 ${isLight ? 'text-[#424245] hover:text-[#0a0a0f]' : 'text-gray-300 hover:text-white'} transition-colors`}
              >
                {link.label}
              </a>
            )
          )}
          <div className={`pt-6 border-t ${isLight ? 'border-[#e5e5ea]' : 'border-white/10'} space-y-3`}>
            <Link
              to="/cimolace/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block text-base font-medium ${isLight ? 'text-[#6e6e73] hover:text-[#0a0a0f]' : 'text-gray-400 hover:text-white'} transition-colors`}
            >
              Connexion
            </Link>
            <Link
              to="/cimolace/installer"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block w-full text-center px-5 py-3 font-semibold rounded-xl ${
                isLight
                  ? 'bg-[#0a0a0f] text-white hover:bg-[#5b3df5]'
                  : 'bg-white text-[#0a0a0f] hover:bg-[#5b3df5] hover:text-white'
              }`}
            >
              Commencer
            </Link>
          </div>
        </div>
      </motion.div>
    </header>
  );
};

export default CimolaceHeader;
