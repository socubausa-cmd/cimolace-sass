import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const Logo = ({ 
  size = 'medium', 
  variant = 'dark', 
  showText = true, 
  /** Tenant ISNA : pas de marque LIRI (image) dans le header. */
  hideWordmarkImage = false,
  logoSrc,
  title,
  subtitle = 'Academy',
  accentColor,
  className 
}) => {
  const isDark = variant === 'dark';
  const { branding } = useTenantBranding();
  const resolvedLogo = logoSrc || branding.logo;
  const resolvedTitle = title || branding.name || 'École';
  const resolvedAccent = accentColor || branding.accentColor || '#D4AF37';

  const sources = useMemo(
    () => [
      resolvedLogo,
      '/liri-logo-mark.png',
      'https://horizons-cdn.hostinger.com/5dd082c4-8386-4ff2-b7e9-8407eeba777b/2218098ab2c6ac491efa407df6650a3a.png',
    ].filter(Boolean),
    [resolvedLogo]
  );
  const [srcIndex, setSrcIndex] = useState(0);
  const [hideImage, setHideImage] = useState(false);
  
  const sizeClasses = {
    small: {
      img: 'h-8 md:h-10',
      title: 'text-lg md:text-xl',
      subtitle: 'text-[0.5rem] tracking-[0.2em]'
    },
    medium: {
      img: 'h-10 md:h-12',
      title: 'text-xl md:text-2xl',
      subtitle: 'text-[0.6rem] tracking-[0.25em]'
    },
    large: {
      img: 'h-16 md:h-24',
      title: 'text-3xl md:text-5xl',
      subtitle: 'text-xs md:text-sm tracking-[0.3em]'
    }
  };

  const currentSize = sizeClasses[size];

  return (
    <Link to="/" className={cn("inline-flex items-center gap-3 group select-none flex-shrink-0", className)}>
      {!hideWordmarkImage ? (
        <motion.div
          whileHover={{ scale: 1.05, filter: `drop-shadow(0 0 8px ${resolvedAccent}80)` }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          {!hideImage && (
            <img
              src={sources[srcIndex]}
              alt={resolvedTitle}
              onError={() => {
                if (srcIndex < sources.length - 1) {
                  setSrcIndex((i) => i + 1);
                } else {
                  setHideImage(true);
                }
              }}
              className={cn(
                'object-contain transition-all duration-300',
                currentSize.img,
                !isDark && !String(sources[srcIndex] || '').includes('liri-logo')
                  ? 'invert brightness-0'
                  : '',
              )}
            />
          )}
        </motion.div>
      ) : null}
      
      {showText && (
        <div className="flex flex-col justify-center">
          <h1 className={cn(
            "font-serif font-bold leading-none transition-colors duration-300 tracking-tight",
            currentSize.title,
            isDark ? "text-white" : "text-[#1a1a1a]"
          )}
          style={{ '--tenant-logo-accent': resolvedAccent }}
          onMouseEnter={(ev) => { ev.currentTarget.style.color = resolvedAccent; }}
          onMouseLeave={(ev) => { ev.currentTarget.style.color = ''; }}
          >
            {resolvedTitle}
          </h1>
          <span className={cn(
            "font-sans uppercase font-medium leading-tight mt-0.5 transition-colors duration-300 opacity-80",
            currentSize.subtitle,
            isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-[#1a1a1a]"
          )}>
            {subtitle}
          </span>
        </div>
      )}
    </Link>
  );
};

export default Logo;
