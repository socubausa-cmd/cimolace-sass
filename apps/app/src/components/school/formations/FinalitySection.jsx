import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Search, FlaskConical, Crown, Target, Key } from 'lucide-react';

const FinalitySection = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
       
       {/* Header 🎓 */}
       <div className="text-center space-y-6">
          <div className="inline-block p-4 rounded-full bg-blue-900/20 border border-blue-500/30 mb-2 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
             <span className="text-4xl">🎓</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-white tracking-tight">
            Finalité des formations <span className="text-[#D4AF37]">Prorascience</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed font-light">
            Notre école ne se contente pas de transmettre un savoir. Elle vise à bâtir des architectures intérieures solides, capables de soutenir une haute fréquence spirituelle tout en restant ancrées dans le réel.
          </p>
          <div className="flex justify-center items-center opacity-50 my-8">
             <span className="text-[#D4AF37] text-3xl font-light tracking-[0.5em]">⸻</span>
          </div>
       </div>

       <div className="grid md:grid-cols-2 gap-8">
          {/* Rational Approach 🧠 */}
          <Card className="bg-[#192734] border-l-4 border-l-blue-500 border-y-0 border-r-0 border-white/5 overflow-hidden shadow-xl hover:shadow-blue-900/10 transition-shadow">
             <CardContent className="p-8 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                   <div className="bg-blue-500/10 p-2 rounded-lg">
                      <Brain className="w-8 h-8 text-blue-400" />
                   </div>
                   <h3 className="text-xl font-bold text-blue-100">Approche Rationnelle 🧠</h3>
                </div>
                <p className="text-gray-400 leading-relaxed">
                   Nous déconstruisons les superstitions pour les remplacer par une compréhension logique des mécanismes invisibles. La spiritualité n'est pas une fuite du réel, mais sa maîtrise par l\'intelligence et la raison.
                </p>
             </CardContent>
          </Card>

          {/* Learning Outcomes 🔍 */}
          <Card className="bg-[#192734] border-l-4 border-l-green-500 border-y-0 border-r-0 border-white/5 overflow-hidden shadow-xl hover:shadow-green-900/10 transition-shadow">
             <CardContent className="p-8 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                   <div className="bg-green-500/10 p-2 rounded-lg">
                      <Search className="w-8 h-8 text-green-400" />
                   </div>
                   <h3 className="text-xl font-bold text-green-100">Résultats Concrets 🔍</h3>
                </div>
                <p className="text-gray-400 leading-relaxed">
                   Chaque module est conçu pour apporter des outils applicables immédiatement. Vous ne repartez pas avec de simples croyances, mais avec des compétences vérifiables et des protocoles fonctionnels.
                </p>
             </CardContent>
          </Card>

          {/* Experience Based 🧪 */}
          <Card className="bg-[#192734] border-l-4 border-l-yellow-500 border-y-0 border-r-0 border-white/5 overflow-hidden shadow-xl hover:shadow-yellow-900/10 transition-shadow">
             <CardContent className="p-8 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                   <div className="bg-yellow-500/10 p-2 rounded-lg">
                      <FlaskConical className="w-8 h-8 text-yellow-400" />
                   </div>
                   <h3 className="text-xl font-bold text-yellow-100">Science Expérimentale 🧪</h3>
                </div>
                <p className="text-gray-400 leading-relaxed">
                   La théorie est la carte, l'expérience est le territoire. Nous mettons l\'accent sur la pratique, les rituels et l\'observation directe des phénomènes. Seule l\'expérience valide la connaissance.
                </p>
             </CardContent>
          </Card>

           {/* Manikongo Heritage 👑 */}
          <Card className="bg-[#192734] border-l-4 border-l-purple-500 border-y-0 border-r-0 border-white/5 overflow-hidden shadow-xl hover:shadow-purple-900/10 transition-shadow">
             <CardContent className="p-8 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                   <div className="bg-purple-500/10 p-2 rounded-lg">
                      <Crown className="w-8 h-8 text-purple-400" />
                   </div>
                   <h3 className="text-xl font-bold text-purple-100">Héritage Manikongo 👑</h3>
                </div>
                <p className="text-gray-400 leading-relaxed">
                   Nous honorons et transmettons la sagesse ancestrale de l'ordre des Manikongos, adaptée aux défis du monde moderne, pour former l\'élite spirituelle de demain ancrée dans une tradition vivante.
                </p>
             </CardContent>
          </Card>
       </div>

       <div className="flex justify-center items-center opacity-50 my-10">
           <span className="text-[#D4AF37] text-3xl font-light tracking-[0.5em]">⸻</span>
       </div>

       {/* Final Objectives 🎯 */}
       <div className="bg-gradient-to-br from-[#151a21] to-[#0d1117] border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-40 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors duration-700"></div>
          <div className="absolute bottom-0 left-0 p-32 bg-[#D4AF37]/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 group-hover:bg-[#D4AF37]/10 transition-colors duration-700"></div>
          
          <div className="relative z-10">
             <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="bg-red-900/20 p-5 rounded-2xl border border-red-500/20 shrink-0 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                   <Target className="w-12 h-12 text-red-500" />
                </div>
                <div className="space-y-6 flex-grow">
                   <h3 className="text-3xl font-bold text-white flex items-center gap-3 font-serif">
                      Objectifs Finaux 🎯
                   </h3>
                   <ul className="space-y-5">
                      <li className="flex items-start gap-4 text-gray-300">
                         <span className="text-[#D4AF37] mt-1.5 text-xl">●</span>
                         <span className="text-lg">Développer une <strong className="text-white">autonomie spirituelle totale</strong>, libre de toute dépendance extérieure ou gouroutisme.</span>
                      </li>
                      <li className="flex items-start gap-4 text-gray-300">
                         <span className="text-[#D4AF37] mt-1.5 text-xl">●</span>
                         <span className="text-lg">Maîtriser les <strong className="text-white">arts opératifs</strong> pour influencer positivement sa réalité, celle de ses proches et celle de ses futurs consultants.</span>
                      </li>
                      <li className="flex items-start gap-4 text-gray-300">
                         <span className="text-[#D4AF37] mt-1.5 text-xl">●</span>
                         <span className="text-lg">Incarner une <strong className="text-white">éthique irréprochable</strong>, garante de la puissance, de la légitimité et de la sécurité du praticien.</span>
                      </li>
                   </ul>
                </div>
             </div>
          </div>
       </div>

       {/* Summary 🔑 */}
       <div className="text-center pt-8 pb-4">
          <div className="inline-flex items-center gap-3 px-8 py-4 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full text-[#D4AF37] font-semibold hover:bg-[#D4AF37]/20 transition-colors cursor-default">
             <Key className="w-6 h-6" />
             <span className="text-lg">En résumé : Prorascience est l'école de la Souveraineté et de l\'Excellence.</span>
          </div>
       </div>
    </div>
  );
};

export default FinalitySection;