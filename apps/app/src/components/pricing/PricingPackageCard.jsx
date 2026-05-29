import React from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Calendar, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Link } from 'react-router-dom';

const PricingPackageCard = ({ pkg, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="h-full"
    >
      <Card 
        className={`h-full flex flex-col relative overflow-hidden bg-gradient-to-br ${pkg.gradient} border ${pkg.borderColor} backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-${pkg.color}-900/30 group rounded-xl`}
      >
        {/* Glow Effect */}
        <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${pkg.color}-500/20 rounded-full blur-3xl group-hover:bg-${pkg.color}-500/30 transition-all duration-500`} />

        <CardHeader className="text-center pb-2 relative z-10">
          <div className="text-4xl mb-3 transform group-hover:scale-110 transition-transform duration-300">
            {pkg.emoji}
          </div>
          <div className={`text-xs font-bold uppercase tracking-widest mb-1 opacity-80 ${pkg.textColor}`}>
            {pkg.cycleNumber}
          </div>
          <h3 className="text-xl font-serif font-bold text-white leading-tight min-h-[3.5rem] flex items-center justify-center">
            {pkg.packageName}
          </h3>
        </CardHeader>

        <CardContent className="flex-grow space-y-5 px-5 relative z-10">
          {/* Pricing Section */}
          <div className="bg-black/40 rounded-xl p-4 text-center border border-white/5 backdrop-blur-md shadow-inner">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold text-white">{pkg.pricing.monthly}</span>
              <span className="text-sm text-gray-400">/mois</span>
            </div>
            {pkg.pricing.registration && (
              <div className="text-sm text-gray-500 mt-1 font-medium">
                {pkg.pricing.registration}
              </div>
            )}
            
            {(pkg.pricing.quarterly || pkg.pricing.full) && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                 {pkg.pricing.quarterly && (
                   <div className="flex justify-between text-sm text-gray-300">
                     <span>Trimestriel:</span>
                     <span className="font-semibold text-white">{pkg.pricing.quarterly}</span>
                   </div>
                 )}
                 {pkg.pricing.full && (
                   <div className="flex justify-between text-sm text-gray-300">
                     <span>Annuel:</span>
                     <span className="font-semibold text-white">{pkg.pricing.full}</span>
                   </div>
                 )}
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-300 bg-white/5 py-1.5 rounded-full border border-white/5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Durée : <span className="text-white font-medium">{pkg.duration}</span></span>
          </div>

          {/* Key Points */}
          <ul className="space-y-3 pt-1">
            {pkg.content.map((point, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                <div className={`mt-1 p-0.5 rounded-full bg-${pkg.color}-500/10`}>
                  <Check className={`w-3.5 h-3.5 ${pkg.textColor}`} />
                </div>
                <span className="leading-snug">{point}</span>
              </li>
            ))}
          </ul>

          {/* Objective */}
          <div className={`text-xs italic text-center font-medium opacity-90 mt-4 px-3 py-3 rounded-lg border border-white/5 bg-gradient-to-r from-transparent via-white/5 to-transparent ${pkg.textColor}`}>
            <span className="opacity-70 mr-1">Objectif:</span> "{pkg.objective}"
          </div>
        </CardContent>

        <CardFooter className="p-5 pt-0 mt-auto relative z-10">
          <Link to="/formations" className="w-full">
            <Button className={`w-full ${pkg.buttonColor} text-white shadow-lg transition-all duration-300 font-medium h-11 group-hover:shadow-${pkg.color}-500/25`}>
              Choisir ce forfait <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default PricingPackageCard;