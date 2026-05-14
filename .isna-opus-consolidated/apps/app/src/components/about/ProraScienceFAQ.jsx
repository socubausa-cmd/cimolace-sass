import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MessageCircle } from 'lucide-react';

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-white/10 rounded-lg bg-[#192734] overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
      >
        <span className={`font-medium transition-colors ${isOpen ? 'text-[#D4AF37]' : 'text-white'}`}>{question}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#D4AF37]' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="px-6 pb-6 pt-2 text-gray-400 text-sm leading-relaxed border-t border-white/5 bg-black/20">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProraScienceFAQ = () => {
  const faqs = [
    { q: "La Prorascience est-elle une religion ?", a: "Non. Elle ne repose sur aucun dogme, aucune croyance obligatoire et aucun culte d'adoration. Elle est une science de l'esprit qui étudie les lois universelles de manière objective." },
    { q: "Faut-il être Africain pour l'étudier ?", a: "Non. Bien qu'elle puise ses racines dans le paradigme africain (berceau de l'humanité), les lois qu'elle étudie sont universelles (gravité, karma, mort). Elle est ouverte à tout être humain cherchant la vérité." },
    { q: "Est-ce compatible avec ma foi religieuse ?", a: "Oui. La Prorascience explique les mécanismes 'comment', elle ne juge pas les croyances 'pourquoi'. Elle peut souvent approfondir votre compréhension métaphysique de vos propres textes sacrés." },
    { q: "Quelle différence avec la physique quantique ?", a: "La physique quantique s'arrête souvent à l'observation de la matière et de l'énergie. La Prorascience inclut la conscience, l'éthique et les plans invisibles comme variables intégrantes de l'équation scientifique." },
    { q: "Y a-t-il des dangers à pratiquer ?", a: "Toute science puissante nécessite une éthique. C'est pourquoi nous insistons sur la 'Responsabilité Éthique' comme pilier fondamental avant toute pratique avancée." },
    { q: "Combien de temps dure la formation ?", a: "Le cycle fondamental dure 1 an. Le cycle complet de Transmetteur dure 3 ans. Cependant, la Prorascience est une voie de transformation continue tout au long de la vie." },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle className="w-6 h-6 text-[#D4AF37]" />
        <h3 className="text-xl font-bold text-white">Questions Fréquentes</h3>
      </div>
      {faqs.map((faq, i) => (
        <FAQItem key={i} question={faq.q} answer={faq.a} />
      ))}
    </div>
  );
};

export default ProraScienceFAQ;