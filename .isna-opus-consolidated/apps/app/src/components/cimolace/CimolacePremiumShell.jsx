import React from 'react';
import CimolaceHeader from '@/components/cimolace/CimolaceHeader';
import CimolaceFooter from '@/components/cimolace/CimolaceFooter';

/**
 * @param {{ children: React.ReactNode, withFooter?: boolean, className?: string, dark?: boolean }} props
 */
export default function CimolacePremiumShell(props) {
  const { children, withFooter = true, className = '', dark = false } = props;

  // Design system from cimolace.html config
  // Light theme: bg-white, ink-#0a0a0f, accent-#5b3df5
  // Dark sections use bg-deep (#0a0a0f)

  if (dark) {
    return (
      <div className={`min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden ${className}`}>
        <div className="fixed inset-0 pointer-events-none -z-10 bg-[#0a0a0f]" />
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-44 left-1/2 h-[980px] w-[980px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[180px]" />
          <div className="absolute top-1/4 right-0 h-[560px] w-[560px] rounded-full bg-cyan-400/10 blur-[140px]" />
        </div>
        <CimolaceHeader variant="dark" />
        {children}
        {withFooter ? <CimolaceFooter variant="dark" /> : null}
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-white text-[#0a0a0f] overflow-x-hidden ${className}`}>
      {/* Subtle gradient background matching cimolace.html hero */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 800px 600px at 50% -10%, rgba(91, 61, 245, 0.08), transparent 70%),
              radial-gradient(ellipse 600px 400px at 80% 30%, rgba(255, 107, 74, 0.04), transparent 60%),
              radial-gradient(ellipse 600px 400px at 20% 30%, rgba(44, 194, 117, 0.03), transparent 60%),
              #ffffff
            `,
          }}
        />
      </div>
      <CimolaceHeader variant="light" />
      {children}
      {withFooter ? <CimolaceFooter variant="light" /> : null}
    </div>
  );
}
