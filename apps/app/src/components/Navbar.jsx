import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, User, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import MobileMenu from '@/components/MobileMenu';
import DropdownMenu from '@/components/DropdownMenu';
import { resolveDashboardPath } from '@/lib/dashboardRoute';
import { getLiriMemberLoginPath } from '@/lib/liriVitrineModel';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, profile } = useAuth();
  const dashboardPath = resolveDashboardPath(user);
  
  // Custom navigation structure based on requirements
  const navigation = [
    { name: 'Accueil', href: '/' },
    { 
      name: 'L\'École', 
      href: '#',
      children: [
        { name: 'À propos', href: '/a-propos' },
        { name: 'Le Fondateur', href: '/a-propos/fondateur' },
        { name: 'Équipe', href: '/equipe' },
        { name: 'FAQ', href: '/faq' },
      ]
    },
    { 
      name: 'Formations', 
      href: '#',
      children: [
        { name: '1ère Année : Fondements', href: '/curriculum/first-year' },
        { name: 'Catalogue Formations', href: '/formations/catalogue' },
        { name: 'Coaching Therapeute', href: '/accompagnement/coaching' },
        { name: 'Montorat Spirituel', href: '/accompagnement/mentorat' },
        { name: 'Coaching vs Mentorat', href: '/accompagnement/coaching-vs-mentorat' },
      ]
    },
    { name: 'Contact', href: '/appointment/request' },
  ];

  return (
    <nav className="fixed w-full z-50 bg-[#0F1419]/90 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center gap-2">
              <Logo className="h-10 w-auto" />
              <span className="text-white font-serif font-bold text-xl tracking-wide hidden md:block">
                PRORASCIENCE
              </span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navigation.map((item) => (
                <div key={item.name} className="relative group">
                  {item.children ? (
                    <button className="text-gray-300 hover:text-[var(--school-accent)] px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1 transition-colors">
                      {item.name}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  ) : item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-300 hover:text-[var(--school-accent)]"
                    >
                      {item.name}
                    </a>
                  ) : (
                    <Link
                      to={item.href}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        location.pathname === item.href 
                          ? 'text-[var(--school-accent)]' 
                          : 'text-gray-300 hover:text-[var(--school-accent)]'
                      }`}
                    >
                      {item.name}
                    </Link>
                  )}

                  {/* Dropdown */}
                  {item.children && (
                    <div className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-[#192734] ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left z-50 border border-white/10">
                      <div className="py-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.name}
                            to={child.href}
                            className="block px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-[var(--school-accent)]"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                 <Link to={dashboardPath}>
                    <Button variant="ghost" className="text-white hover:text-[var(--school-accent)] hover:bg-white/5">
                       <User className="w-4 h-4 mr-2" />
                       Mon Espace
                    </Button>
                 </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to={getLiriMemberLoginPath()}>
                  <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/5" title="Espace membre — LIRI">
                    Connexion
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="bg-[var(--school-accent)] text-black hover:bg-[#b5952f] font-bold">
                    S'inscrire
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
            >
              {isOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-[#192734] border-t border-white/5 px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {navigation.map((item) => (
            <div key={item.name}>
              {item.children ? (
                <>
                  <div className="text-gray-400 px-3 py-2 text-base font-bold uppercase tracking-wider mt-4 mb-1">
                    {item.name}
                  </div>
                  {item.children.map((child) => (
                    <Link
                      key={child.name}
                      to={child.href}
                      onClick={() => setIsOpen(false)}
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5 pl-6"
                    >
                      {child.name}
                    </Link>
                  ))}
                </>
              ) : item.external ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5"
                >
                  {item.name}
                </a>
              ) : (
                <Link
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5"
                >
                  {item.name}
                </Link>
              )}
            </div>
          ))}
          <div className="pt-4 border-t border-white/10 mt-4">
             {user ? (
               <Link to={dashboardPath} onClick={() => setIsOpen(false)}>
                   <Button className="w-full bg-[var(--school-accent)] text-black">Mon Espace</Button>
                </Link>
             ) : (
                <div className="grid grid-cols-2 gap-2">
                   <Link to={getLiriMemberLoginPath()} onClick={() => setIsOpen(false)}>
                      <Button variant="outline" className="w-full border-white/20 text-white" title="Espace membre — LIRI">Connexion</Button>
                   </Link>
                   <Link to="/signup" onClick={() => setIsOpen(false)}>
                      <Button className="w-full bg-[var(--school-accent)] text-black">S'inscrire</Button>
                   </Link>
                </div>
             )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;