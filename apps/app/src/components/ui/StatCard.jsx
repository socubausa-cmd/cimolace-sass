import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const StatCard = ({ icon: Icon, label, value, trend, trendValue, color = "blue", className }) => {
  const getTrendIcon = () => {
    if (trend === 'up') return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const colorStyles = {
    blue: "from-blue-500/12 to-blue-600/5 border-blue-500/25 text-blue-300",
    green: "from-green-500/12 to-green-600/5 border-green-500/25 text-green-300",
    red: "from-red-500/12 to-red-600/5 border-red-500/25 text-red-300",
    yellow: "from-yellow-500/12 to-yellow-600/5 border-yellow-500/25 text-yellow-300",
    gold: "from-[#D4AF37]/15 to-[#D4AF37]/5 border-[#D4AF37]/30 text-[#D4AF37]",
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_50px_rgba(0,0,0,0.3)]",
      colorStyles[color],
      className
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight">{value}</h3>
        </div>
        <div className={cn("rounded-full p-3 bg-black/20 border border-white/10", colorStyles[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {(trend || trendValue) && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-medium">
            {getTrendIcon()}
            {trendValue}
          </span>
          <span className="opacity-60">par rapport au mois dernier</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;