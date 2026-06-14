import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const IndicatorCard = ({ title, value, unit, trend, color, subtitle }) => (
  <Card className="bg-[#192734] border-white/10">
    <CardContent className="p-6">
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <div className="flex items-end gap-2 mb-2">
        <span className={`text-3xl font-bold ${color}`}>{value}</span>
        <span className="text-sm text-gray-500 mb-1">{unit}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
        {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
        {trend === 'stable' && <Minus className="w-4 h-4 text-gray-500" />}
        <span className="text-gray-400">{subtitle}</span>
      </div>
    </CardContent>
  </Card>
);

const IndicatorsSection = ({ data }) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <IndicatorCard 
          title="Taux de Régularité" 
          value={data.regularity} 
          unit="%" 
          trend="up" 
          color="text-green-500"
          subtitle="vs semaine dernière"
        />
        <IndicatorCard 
          title="Participation Lives" 
          value={data.liveParticipation} 
          unit="%" 
          trend="stable" 
          color="text-blue-400"
          subtitle="Stable"
        />
        <IndicatorCard 
          title="Qualité des Écrits" 
          value={data.averageNoteQuality} 
          unit="/10" 
          trend="up" 
          color="text-[var(--school-accent)]"
          subtitle="+0.2 pts"
        />
        <IndicatorCard 
          title="Tendance Globale" 
          value={data.trend === 'up' ? "Positive" : "Neutre"} 
          unit="" 
          trend={data.trend} 
          color="text-purple-400"
          subtitle="Engagement"
        />
      </div>

      <Card className="bg-[#192734] border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Évolution de l'Engagement (30 derniers jours)</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.history}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
              />
              <Area type="monotone" dataKey="value" stroke="#D4AF37" fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default IndicatorsSection;