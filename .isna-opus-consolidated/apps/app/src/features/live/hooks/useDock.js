import { useEffect } from 'react';

export function useDock(containerRef, selector, axis, maxScale, spread) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = Array.from(container.querySelectorAll(selector));
    if (!items.length) return;

    const targets = items.map(() => 1);
    const currents = items.map(() => 1);
    let rafId = null;
    const lerp = (a, b, t) => a + (b - a) * t;
    const gauss = (d, sp, mx) => (d > sp ? 1 : 1 + (mx - 1) * Math.pow(1 - d / sp, 1.8));

    items.forEach((item) => {
      item.style.transition = 'none';
      item.style.willChange = 'transform';
      item.style.transformOrigin = axis === 'y' ? 'center right' : 'bottom center';
      item.style.position = 'relative';
    });

    function anim() {
      let moving = false;
      items.forEach((item, index) => {
        if (Math.abs(currents[index] - targets[index]) > 0.002) {
          currents[index] = lerp(currents[index], targets[index], 0.16);
          moving = true;
        } else {
          currents[index] = targets[index];
        }
        item.style.transform = `scale(${currents[index].toFixed(3)})`;
        item.style.zIndex = Math.round(currents[index] * 10);
      });
      rafId = moving ? requestAnimationFrame(anim) : null;
    }

    const onMove = (event) => {
      const pos = axis === 'x' ? event.clientX : event.clientY;
      items.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const center = axis === 'x' ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
        targets[index] = gauss(Math.abs(pos - center), spread, maxScale);
      });
      if (!rafId) rafId = requestAnimationFrame(anim);
    };

    const onLeave = () => {
      items.forEach((_, index) => {
        targets[index] = 1;
      });
      if (!rafId) rafId = requestAnimationFrame(anim);
    };

    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseleave', onLeave);

    return () => {
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('mouseleave', onLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  });
}
