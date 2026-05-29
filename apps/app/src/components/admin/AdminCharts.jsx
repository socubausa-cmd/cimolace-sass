import React from 'react';

export const SimpleLineChart = ({ data, color = "#3B82F6", height = 200 }) => {
  if (!data || data.length === 0) return <div className="text-gray-500 text-sm">No data available</div>;

  const maxVal = Math.max(...data.map(d => d.value));
  const minVal = Math.min(...data.map(d => d.value));
  const range = maxVal - minVal || 1;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.value - minVal) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full relative" style={{ height: `${height}px` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <path
          d={`M0,100 L${points} L100,100 Z`}
          fill={color}
          fillOpacity="0.1"
        />
        <path
          d={`M${points}`}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between mt-2 text-sm text-gray-400">
        {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0).map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
    </div>
  );
};

export const SimpleBarChart = ({ data, color = "#3B82F6", height = 200 }) => {
  if (!data || data.length === 0) return <div className="text-gray-500 text-sm">No data available</div>;
  const maxVal = Math.max(...data.map(d => d.value)) || 1;

  return (
    <div className="w-full flex items-end justify-between gap-1" style={{ height: `${height}px` }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center group">
          <div 
            className="w-full bg-opacity-80 hover:bg-opacity-100 transition-all rounded-t-sm relative"
            style={{ 
              height: `${(d.value / maxVal) * 100}%`,
              backgroundColor: color 
            }}
          >
             <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
               {d.value}
             </div>
          </div>
        </div>
      ))}
    </div>
  );
};