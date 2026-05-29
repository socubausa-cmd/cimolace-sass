import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const StatCard = ({ icon: Icon, label, value, trend, trendUp, color }) => {
  const colorClasses = {
    green: "text-emerald-500 bg-emerald-500/10",
    blue: "text-blue-500 bg-blue-500/10",
    purple: "text-purple-500 bg-purple-500/10",
    orange: "text-orange-500 bg-orange-500/10",
    red: "text-red-500 bg-red-500/10",
  };

  const selectedColor = colorClasses[color] || colorClasses.blue;

  return (
    <Card className="border-none shadow-lg bg-white/5 backdrop-blur-sm hover:scale-105 transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-400">{label}</p>
            <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
          </div>
          <div className={cn("p-3 rounded-xl transition-colors group-hover:bg-opacity-20", selectedColor)}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <span className={cn("flex items-center font-medium", trendUp ? "text-emerald-400" : "text-red-400")}>
            {trendUp ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
            {trend}
          </span>
          <span className="text-gray-500 ml-2">vs last month</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;