import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react';

const DropdownMenu = ({ title, icon: Icon, items, mega = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const location = useLocation();
  const pathname = String(location?.pathname || '');
  const isActive = (items || []).some((item) => {
    const target = String(item?.path || '').split('?')[0];
    return target && (pathname === target || pathname.startsWith(`${target}/`));
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  return (
    <div 
      ref={rootRef}
      className="relative h-full flex items-center"
    >
      <button 
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 px-2 py-2 text-[0.8rem] xl:text-sm font-medium transition-all duration-300 rounded-lg group ${
          isOpen || isActive ? 'text-[var(--school-accent)] bg-white/5' : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}
      >
        {Icon && <Icon className={`w-3.5 h-3.5 xl:w-4 xl:h-4 ${isOpen || isActive ? 'text-[var(--school-accent)]' : 'text-gray-500 group-hover:text-white'}`} />}
        <span className="uppercase tracking-tight font-bold whitespace-nowrap">{title}</span>
        <ChevronDown 
          className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[var(--school-accent)]' : 'text-gray-600'}`} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 z-[220] pointer-events-auto ${mega ? 'w-[720px]' : 'w-64'}`}
          >
            <div className="bg-[#192734]/90 border border-white/15 rounded-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] overflow-hidden backdrop-blur-xl ring-1 ring-white/5">
              
              {/* Decorative top border */}
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent opacity-80"></div>

              {mega ? (
                <div className="grid grid-cols-3 gap-0">
                  <div className="col-span-2 p-4 grid grid-cols-2 gap-2">
                    {items.map((item, index) => (
                      <Link
                        key={index}
                        to={item.path}
                        onClick={() => setIsOpen(false)}
                        className="group rounded-xl border border-white/10 bg-white/5 px-3 py-3 hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] hover:bg-white/10 transition-all"
                      >
                        <div className="text-sm font-semibold text-white group-hover:text-[var(--school-accent)] transition-colors">
                          {item.label}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          Explorer cette section
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="p-4 border-l border-white/10 bg-gradient-to-b from-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] to-transparent">
                    <div className="flex items-center gap-2 text-[var(--school-accent)] text-xs uppercase tracking-wider font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      Focus Formation
                    </div>
                    <h4 className="mt-3 text-white font-bold leading-snug">
                      Lance ton parcours avec les modules Prorascience
                    </h4>
                    <p className="mt-2 text-xs text-gray-300">
                      Catalogue, plans et contenus d apprentissage centralises dans un seul espace.
                    </p>
                    <Link
                      to="/formations/catalogue"
                      onClick={() => setIsOpen(false)}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--school-accent)] hover:text-white transition-colors"
                    >
                      Ouvrir le catalogue
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="py-2 px-1 flex flex-col gap-0.5">
                  {items.map((item, index) => (
                    <Link
                      key={index}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all group relative overflow-hidden"
                    >
                      {item.icon && (
                        <div className="p-1.5 rounded-md bg-[#0F1419] border border-white/5 text-gray-500 group-hover:text-[var(--school-accent)] group-hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-colors shadow-sm z-10">
                          <item.icon className="w-4 h-4" />
                        </div>
                      )}
                      <span className="font-medium group-hover:translate-x-1 transition-transform duration-300 text-xs xl:text-sm z-10">
                        {item.label}
                      </span>
                      <div className="absolute left-0 top-0 w-0.5 h-full bg-[var(--school-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DropdownMenu;