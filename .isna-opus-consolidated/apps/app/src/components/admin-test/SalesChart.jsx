import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';

const SalesChart = () => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const data = [45, 52, 48, 60, 55, 65, 72, 68, 80, 85, 82, 95];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;
  
  // SVG dimensions
  const width = 800;
  const height = 300;
  const padding = 40;
  
  // Calculate points
  const points = data.map((val, index) => {
    const x = padding + (index * ((width - padding * 2) / (data.length - 1)));
    const y = height - (padding + ((val - min) / range) * (height - padding * 2));
    return `${x},${y}`;
  }).join(' ');

  // Area path (closed at bottom)
  const areaPoints = `
    ${padding},${height - padding} 
    ${points} 
    ${width - padding},${height - padding}
  `;

  return (
    <Card className="border-none shadow-lg bg-[#192734] w-full">
      <CardHeader>
        <CardTitle className="text-white">Sales Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[300px] relative overflow-hidden">
          {mounted && (
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                </linearGradient>
              </defs>
              
              {/* Grid Lines */}
              {[0, 1, 2, 3, 4].map(i => (
                <line 
                  key={i}
                  x1={padding} 
                  y1={padding + (i * (height - padding * 2) / 4)} 
                  x2={width - padding} 
                  y2={padding + (i * (height - padding * 2) / 4)} 
                  stroke="#374151" 
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Area */}
              <motion.path
                d={`M ${areaPoints} Z`}
                fill="url(#gradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
              />

              {/* Line */}
              <motion.path
                d={`M ${points}`}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />

              {/* Points */}
              {data.map((val, index) => {
                const x = padding + (index * ((width - padding * 2) / (data.length - 1)));
                const y = height - (padding + ((val - min) / range) * (height - padding * 2));
                return (
                  <motion.circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#3B82F6"
                    stroke="#1F2937"
                    strokeWidth="2"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.5 + (index * 0.1) }}
                    className="hover:r-6 transition-all cursor-pointer"
                  >
                    <title>{`${months[index]}: ${val}k`}</title>
                  </motion.circle>
                );
              })}

              {/* Labels */}
              {months.map((month, index) => {
                const x = padding + (index * ((width - padding * 2) / (data.length - 1)));
                return (
                  <text 
                    key={index} 
                    x={x} 
                    y={height - 10} 
                    fill="#9CA3AF" 
                    fontSize="12" 
                    textAnchor="middle"
                  >
                    {month}
                  </text>
                );
              })}
            </svg>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesChart;