import React, { useState, useMemo } from 'react';

const hexToRgba = (hex, alpha) => {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const GRID_COLS = 36;
const GRID_ROWS = 12;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS;
const RIPPLE_SIZE = "18.973665961em";

const JS_RIPPLE_KEYFRAMES = `
  @keyframes js-ripple-animation {
    0% { transform: scale(0); opacity: 1; }
    100% { transform: scale(1); opacity: 0; }
  }
  .animate-js-ripple-effect {
    animation: js-ripple-animation var(--ripple-duration) ease-out forwards;
  }
`;

export const RippleButton = ({
  children,
  onClick,
  className = '',
  disabled = false,
  variant = 'default',
  rippleColor: userRippleColor,
  rippleDuration = 600,
  hoverBaseColor = '#6996e2',
  hoverRippleColor,
  hoverBorderEffectColor = '#6996e277',
  hoverBorderEffectThickness = '0.3em',
}) => {
  const [jsRipples, setJsRipples] = useState([]);

  const rippleColor = useMemo(
    () => userRippleColor || 'rgba(255,255,255,0.15)',
    [userRippleColor]
  );

  const dynamicStyles = useMemo(() => {
    const dur = '0.9s';
    let nth = '';
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const idx = r * GRID_COLS + c + 1;
        const top = 0.125 + r * 0.25;
        const left = 0.1875 + c * 0.25;
        if (variant === 'hover') {
          nth += `.hover-variant-grid-cell:nth-child(${idx}):hover ~ .hover-variant-visual-ripple { top:${top}em;left:${left}em;transition:width ${dur} ease,height ${dur} ease,top 0s linear,left 0s linear; }`;
        } else if (variant === 'hoverborder') {
          nth += `.hoverborder-variant-grid-cell:nth-child(${idx}):hover ~ .hoverborder-variant-visual-ripple { top:${top}em;left:${left}em;transition:width ${dur} ease-out,height ${dur} ease-out,top 0s linear,left 0s linear; }`;
        }
      }
    }
    if (variant === 'hover') {
      const color = hoverRippleColor || hexToRgba(hoverBaseColor, 0.466);
      return `.hover-variant-visual-ripple{background-color:${color};transition:width ${dur} ease,height ${dur} ease,top 99999s linear,left 99999s linear;}.hover-variant-grid-cell:hover~.hover-variant-visual-ripple{width:${RIPPLE_SIZE};height:${RIPPLE_SIZE};}${nth}`;
    }
    if (variant === 'hoverborder') {
      return `.hoverborder-variant-ripple-container{padding:${hoverBorderEffectThickness};mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;}.hoverborder-variant-visual-ripple{background-color:${hoverBorderEffectColor};transition:width ${dur} ease-out,height ${dur} ease-out,top 99999s linear,left 9999s linear;}.hoverborder-variant-grid-cell:hover~.hoverborder-variant-visual-ripple{width:${RIPPLE_SIZE};height:${RIPPLE_SIZE};}${nth}`;
    }
    return '';
  }, [variant, hoverBaseColor, hoverRippleColor, hoverBorderEffectColor, hoverBorderEffectThickness]);

  const addRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const key = Date.now();
    setJsRipples(p => [...p, { key, x, y, size, color: rippleColor }]);
    setTimeout(() => setJsRipples(p => p.filter(r => r.key !== key)), rippleDuration);
  };

  const handleClick = (e) => {
    if (!disabled) { addRipple(e); onClick?.(e); }
  };

  const rippleEls = (
    <div className="absolute inset-0 pointer-events-none z-[5]">
      {jsRipples.map(r => (
        <span
          key={r.key}
          className="absolute rounded-full animate-js-ripple-effect"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size, backgroundColor: r.color, '--ripple-duration': `${rippleDuration}ms` }}
        />
      ))}
    </div>
  );

  if (variant === 'hover') {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: JS_RIPPLE_KEYFRAMES + dynamicStyles }} />
        <button className={`relative rounded-lg text-lg px-4 py-2 border-none bg-transparent isolate overflow-hidden cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''} ${className}`} onClick={handleClick} disabled={disabled}>
          <span className="relative z-[10] pointer-events-none">{children}</span>
          {rippleEls}
          <div className="absolute inset-0 grid overflow-hidden pointer-events-none z-[0]" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 0.25em)` }}>
            {Array.from({ length: TOTAL_CELLS }, (_, i) => <span key={i} className="hover-variant-grid-cell relative flex justify-center items-center pointer-events-auto" />)}
            <div className="hover-variant-visual-ripple pointer-events-none absolute w-0 h-0 rounded-full transform -translate-x-1/2 -translate-y-1/2 top-0 left-0 z-[-1]" />
          </div>
        </button>
      </>
    );
  }

  if (variant === 'hoverborder') {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: JS_RIPPLE_KEYFRAMES + dynamicStyles }} />
        <button className={`relative rounded-lg overflow-hidden text-lg px-4 py-2 border-none bg-transparent isolate cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''} ${className}`} onClick={handleClick} disabled={disabled}>
          <span className="relative z-[10] pointer-events-none">{children}</span>
          {rippleEls}
          <div className="hoverborder-variant-ripple-container absolute inset-0 grid rounded-[0.8em] overflow-hidden pointer-events-none z-[0]" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 0.25em)` }}>
            {Array.from({ length: TOTAL_CELLS }, (_, i) => <span key={i} className="hoverborder-variant-grid-cell relative flex justify-center items-center pointer-events-auto" />)}
            <div className="hoverborder-variant-visual-ripple pointer-events-none absolute w-0 h-0 rounded-full transform -translate-x-1/2 -translate-y-1/2 top-0 left-0 z-[-1]" />
          </div>
        </button>
      </>
    );
  }

  if (variant === 'ghost') {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: JS_RIPPLE_KEYFRAMES }} />
        <button className={`relative border-none bg-transparent isolate overflow-hidden cursor-pointer px-4 py-2 rounded-lg text-lg ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''} ${className}`} onClick={handleClick} disabled={disabled}>
          <span className="relative z-10 pointer-events-none">{children}</span>
          {rippleEls}
        </button>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: JS_RIPPLE_KEYFRAMES }} />
      <button className={`relative border-none overflow-hidden isolate transition-all duration-200 cursor-pointer px-4 py-2 rounded-lg ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`} onClick={handleClick} disabled={disabled}>
        <span className="relative z-[1] pointer-events-none">{children}</span>
        {rippleEls}
      </button>
    </>
  );
};
