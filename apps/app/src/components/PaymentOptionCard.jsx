import React from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const PaymentOptionCard = ({ 
  optionNumber, 
  title, 
  price, 
  period, // mapped to frequency in new usage
  frequency, // alias for period
  totalPrice, 
  total, // alias for totalPrice
  savings, 
  features, 
  benefits, // alias for features
  duration,
  isRecommended,
  paymentPlanId,
  onSelect
}) => {
  // Normalize props to handle both naming conventions
  const displayPeriod = period || frequency;
  const displayTotal = totalPrice || total;
  const displayFeatures = features || benefits || [];

  return (
    <motion.div 
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
      className={`relative bg-[#192734] rounded-2xl p-6 border ${isRecommended ? 'border-[#D4AF37] shadow-lg shadow-[#D4AF37]/10' : 'border-white/5'} flex flex-col h-full overflow-hidden group`}
    >
      {isRecommended && (
        <div className="absolute top-0 right-0 bg-[#D4AF37] text-black text-xs font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider z-10">
          Meilleure Offre
        </div>
      )}
      
      {/* Header */}
      <div className="mb-6 relative z-10">
        <div className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-2">Option 0{optionNumber}</div>
        <h3 className="text-2xl font-bold text-white mb-4 font-serif">{title}</h3>
        
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-4xl font-bold text-[#D4AF37]">{price}€</span>
          {displayPeriod && <span className="text-gray-400 font-medium">{displayPeriod}</span>}
        </div>
        
        {displayTotal && (
          <div className="text-sm text-gray-400 mt-1">
            Total : <span className="text-gray-300 font-semibold">{displayTotal}€</span>
          </div>
        )}
        
        {duration && (
           <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <Clock className="w-3 h-3" />
              <span>Durée : {duration}</span>
           </div>
        )}

        {savings && (
          <div className="mt-3 inline-block bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1">
            <span className="text-green-400 text-xs font-bold uppercase tracking-wide">
              {savings}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10 w-full mb-6"></div>

      {/* Features */}
      <div className="flex-grow mb-8 relative z-10">
        <ul className="space-y-3">
          {displayFeatures.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
              <Check className="w-5 h-5 text-[#D4AF37] shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action */}
      <div className="relative z-10 mt-auto">
        {onSelect ? (
          <Button 
            onClick={onSelect}
            className={`w-full py-6 text-base font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group/btn ${
              isRecommended 
                ? 'bg-[#D4AF37] text-black hover:bg-yellow-500' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            CHOISIR CETTE OPTION
            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
          </Button>
        ) : (
          <Link to={paymentPlanId ? `/signup?plan=${paymentPlanId}` : '/signup'}>
            <Button 
              className={`w-full py-6 text-base font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group/btn ${
                isRecommended 
                  ? 'bg-[#D4AF37] text-black hover:bg-yellow-500' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              CHOISIR CETTE OPTION
              <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
            </Button>
          </Link>
        )}
        <p className="text-center text-sm text-gray-500 mt-3">
          Paiement sécurisé via Chariow
        </p>
      </div>

      {/* Background decoration */}
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-[#D4AF37]/5 rounded-full blur-3xl group-hover:bg-[#D4AF37]/10 transition-colors duration-500 pointer-events-none"></div>
    </motion.div>
  );
};

export default PaymentOptionCard;