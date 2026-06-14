import React from 'react';
import { Helmet } from 'react-helmet';
import { Linkedin, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WEB_TEAM } from '@/data/prorascienceVitrineFromWebContent';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const TeamPage = () => {
  const t = WEB_TEAM;
  const { founders, professors, hero, cta } = t;

  return (
    <div className="min-h-screen premium-dashboard-shell text-white pt-20 font-sans">
      <Helmet><title>{`Notre Équipe | ${isnaTenantConfig.branding.name}`}</title></Helmet>

      {/* Hero */}
      <section className="py-16 text-center px-6">
        <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6">{hero.title}</h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          {hero.lead}
        </p>
      </section>

      {/* Founders */}
      <section className="py-10">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-16 text-center text-[var(--school-accent)]">Les Fondateurs</h2>
          <div className="grid md:grid-cols-2 gap-12">
            {founders.map((founder, i) => (
              <div key={i} className="premium-panel rounded-2xl overflow-hidden border border-white/10 flex flex-col md:flex-row">
                <div className="md:w-2/5 h-64 md:h-auto relative">
                  <img src={founder.image} alt={founder.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-8 md:w-3/5 flex flex-col justify-center">
                  <h3 className="text-2xl font-bold mb-1">{founder.name}</h3>
                  <p className="text-[var(--school-accent)] text-sm uppercase tracking-wider mb-4">{founder.role}</p>
                  <p className="text-gray-300 leading-relaxed mb-6">{founder.bio}</p>
                  <div className="flex gap-4">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white"><Linkedin className="w-4 h-4"/></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white"><Twitter className="w-4 h-4"/></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Professors Grid */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-12 text-center">Corps Professoral</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {professors.map((prof, i) => (
              <div key={i} className="premium-panel p-6 rounded-xl border border-white/10 text-center hover:scale-105 transition-transform duration-300">
                <div className="w-24 h-24 mx-auto rounded-full bg-gray-700 mb-4 overflow-hidden border-2 border-white/10">
                   {/* Placeholder for images */}
                   <div className="w-full h-full flex items-center justify-center bg-[#0F1419] text-gray-500 font-bold text-2xl">
                      {prof.name.charAt(0)}
                   </div>
                </div>
                <h3 className="font-bold text-lg mb-1">{prof.name}</h3>
                <p className="text-[var(--school-accent)] text-xs font-bold mb-2">{prof.module}</p>
                <p className="text-gray-400 text-xs">{prof.spec}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Join Us */}
      <section className="py-20 text-center">
        <div className="max-w-3xl mx-auto px-6 premium-panel rounded-2xl py-10">
           <h2 className="text-3xl font-bold mb-6">{cta.title}</h2>
           <p className="text-gray-400 mb-8">
              {cta.text}
           </p>
           <Button variant="outline" className="border-[var(--school-accent)] text-[var(--school-accent)] hover:bg-[var(--school-accent)] hover:text-black">
              Voir les offres
           </Button>
        </div>
      </section>
    </div>
  );
};

export default TeamPage;