import React from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Link } from 'react-router-dom';

const CycleCard = ({ cycle, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="h-full"
    >
      <Card 
        className={`h-full flex flex-col relative overflow-hidden bg-gradient-to-br ${cycle.gradient} border ${cycle.borderColor} backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-${cycle.color}-900/30 group rounded-xl`}
      >
        {/* Glow Effect */}
        <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${cycle.color}-500/20 rounded-full blur-3xl group-hover:bg-${cycle.color}-500/30 transition-all duration-500`} />

        <CardHeader className="text-center pb-2 relative z-10">
          <div className="text-4xl mb-3 transform group-hover:scale-110 transition-transform duration-300">
            {cycle.emoji}
          </div>
          <div className={`text-xs font-bold uppercase tracking-widest mb-1 opacity-80 ${cycle.textColor}`}>
            {cycle.cycleNumber}
          </div>
          <h3 className="text-lg font-serif font-bold text-white leading-tight min-h-[3rem] flex items-center justify-center">
            {cycle.packageName}
          </h3>
        </CardHeader>

        <CardContent className="flex-grow space-y-4 px-4 relative z-10">
          {/* Pricing Section */}
          <div className="bg-black/30 rounded-lg p-3 text-center border border-white/5 backdrop-blur-md">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-white">{cycle.pricing.monthly}</span>
              <span className="text-sm text-gray-400">/mois</span>
            </div>
            {cycle.pricing.registration && (
              <div className="text-[10px] text-gray-500 mt-1">
                {cycle.pricing.registration}
              </div>
            )}
            {(cycle.pricing.quarterly || cycle.pricing.full) && (
              <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-1 gap-1 text-[10px] text-gray-400">
                 {cycle.pricing.quarterly && <div>Ou {cycle.pricing.quarterly}</div>}
                 {cycle.pricing.full && <div>Ou {cycle.pricing.full}</div>}
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
            <Calendar className="w-3 h-3" />
            <span>Durée : <span className="text-white font-medium">{cycle.duration}</span></span>
          </div>

          {/* Key Points */}
          <ul className="space-y-2 pt-2">
            {cycle.content.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                <Check className={`w-3 h-3 mt-0.5 shrink-0 ${cycle.textColor}`} />
                <span className="leading-snug">{point}</span>
              </li>
            ))}
          </ul>

          {/* Objective */}
          <div className={`text-xs italic text-center opacity-90 mt-4 px-2 py-2 rounded border border-white/5 bg-white/5 ${cycle.textColor}`}>
            "{cycle.objective}"
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0 mt-auto relative z-10">
          <Link to="/formations" className="w-full">
            <Button className={`w-full ${cycle.buttonColor} text-white shadow-lg transition-all duration-300 text-sm h-10`}>
              Découvrir <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default CycleCard;