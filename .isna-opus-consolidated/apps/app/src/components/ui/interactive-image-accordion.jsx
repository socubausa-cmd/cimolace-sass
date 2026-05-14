import React, { useState } from 'react';

const AccordionItem = ({ item, isActive, onMouseEnter }) => (
  <div
    className={`
      relative h-[480px] rounded-2xl overflow-hidden cursor-pointer
      transition-all duration-700 ease-in-out flex-shrink-0
      ${isActive ? 'w-[380px]' : 'w-[64px]'}
    `}
    onMouseEnter={onMouseEnter}
  >
    {/* Background image */}
    <img
      src={item.imageUrl}
      alt={item.title}
      className="absolute inset-0 w-full h-full object-cover scale-105 transition-transform duration-700"
      onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80'; }}
    />

    {/* Dark + tinted gradient overlay */}
    <div
      className="absolute inset-0 transition-opacity duration-700"
      style={{
        background: isActive
          ? `linear-gradient(to top, ${item.color}99 0%, rgba(0,0,0,0.5) 60%, transparent 100%)`
          : 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%)',
      }}
    />

    {/* Badge (active only) */}
    {isActive && (
      <div
        className="absolute top-4 left-4 px-3 py-1 rounded-full text-[11px] font-semibold tracking-widest uppercase transition-all duration-300"
        style={{ backgroundColor: `${item.color}30`, color: item.color, border: `1px solid ${item.color}50` }}
      >
        {item.badge}
      </div>
    )}

    {/* Title */}
    <span
      className={`
        absolute text-white font-bold whitespace-nowrap transition-all duration-500 ease-in-out
        ${isActive
          ? 'text-xl bottom-8 left-6 rotate-0 opacity-100'
          : 'text-sm bottom-28 left-1/2 -translate-x-1/2 rotate-90 opacity-70'}
      `}
    >
      {item.title}
    </span>

    {/* Sub-text (active only) */}
    {isActive && (
      <p className="absolute bottom-8 left-6 right-6 mt-1 text-sm text-white/60 leading-snug" style={{ top: 'auto', marginTop: '2rem' }}>
        {item.description}
      </p>
    )}
  </div>
);

export function InteractiveImageAccordion({
  items,
  heading,
  subheading,
  ctaLabel = 'Explorer',
  ctaHref = '#modules',
  defaultActive = 0,
}) {
  const [activeIndex, setActiveIndex] = useState(defaultActive);

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">
      {/* Left text */}
      <div className="w-full lg:w-[42%] text-center lg:text-left">
        {heading}
        {subheading && (
          <p className="mt-5 text-lg text-white/40 max-w-md mx-auto lg:mx-0 leading-relaxed">
            {subheading}
          </p>
        )}
        <div className="mt-8">
          <a
            href={ctaHref}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 hover:opacity-90 transition-opacity"
          >
            {ctaLabel} →
          </a>
        </div>
      </div>

      {/* Right accordion */}
      <div className="w-full lg:w-[58%] overflow-x-auto">
        <div className="flex flex-row items-stretch justify-start lg:justify-end gap-3 p-1">
          {items.map((item, index) => (
            <AccordionItem
              key={item.id}
              item={item}
              isActive={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
