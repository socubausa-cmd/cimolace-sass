import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  Shield, BookOpen, Eye, Swords, Heart,
  ArrowRight, MessageCircle, Target,
  FileText, Activity, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WEB_COACHING_VS_MENTORAT } from '@/data/prorascienceVitrineFromWebContent';

const VS_ICONS = {
  Activity,
  Target,
  Eye,
  Heart,
  BookOpen,
  Swords,
  Zap,
};

const MentoratPage = () => {
  const v = WEB_COACHING_VS_MENTORAT;
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-20 pb-20">
      <Helmet>
        <title>Coaching vs Mentorat Spirituel | PRORASCIENCE</title>
        <meta name="description" content="La distinction cruciale entre le coaching spirituel (formation de praticien) et le mentorat spirituel (assistance et protection). Comprenez ce dont vous avez reellement besoin." />
      </Helmet>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/50 to-[#0F1419]" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-yellow-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-[150px]" />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 text-gray-400 text-xs font-bold uppercase tracking-widest border border-white/10">
            {v.pageHero.kicker}
          </span>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight">
            {v.pageHero.title}
          </h1>
          <p className="text-lg md:text-xl text-[#D4AF37] font-medium">
            {v.pageHero.subtitle}
          </p>
          <div className="w-24 h-0.5 bg-gradient-to-r from-yellow-500 via-white/20 to-red-500 mx-auto" />
        </div>
      </section>

      {/* ═══════════ ARTICLE ═══════════ */}
      <article className="max-w-3xl mx-auto px-4 md:px-6 space-y-16">

        {/* INTRODUCTION */}
        <section className="space-y-5">
          {v.intro.map((p, i) => (
            <p key={i} className={`text-[15px] leading-relaxed ${i === 0 ? 'text-gray-300' : 'text-gray-400'}`}>
              {p}
            </p>
          ))}
        </section>

        <div className="flex items-center gap-4 opacity-40">
          <div className="h-px bg-yellow-500 flex-1" />
          <span className="text-xs text-yellow-400 uppercase tracking-widest font-bold whitespace-nowrap">{v.partCoaching.label}</span>
          <div className="h-px bg-yellow-500 flex-1" />
        </div>

        <section className="space-y-5">
          <h2 className="text-2xl font-serif font-bold text-white">
            {v.partCoaching.title}
          </h2>
          {v.partCoaching.paras.map((p, i) => (
            <p key={i} className={`text-[15px] leading-relaxed ${i === 0 ? 'text-gray-300' : 'text-gray-400'}`}>
              {p}
            </p>
          ))}
          {v.partCoaching.blockquote && (
            <blockquote className="border-l-4 border-yellow-500/40 pl-5 py-3 bg-yellow-500/[0.03] rounded-r-xl">
              <p className="text-sm text-yellow-200/80 italic leading-relaxed">« {v.partCoaching.blockquote} »</p>
            </blockquote>
          )}
        </section>

        <section className="space-y-5">
          <h3 className="text-xl font-serif font-bold text-yellow-300 flex items-center gap-3">
            <FileText className="w-5 h-5" /> {v.cahierSection.h3}
          </h3>
          <p className="text-gray-300 text-[15px] leading-relaxed">{v.cahierSection.intro}</p>
          <p className="text-gray-400 text-sm mb-3">{v.cahierSection.leadIndicators}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {v.cahierSection.indicators.map((item) => {
              const Ic = VS_ICONS[item.key] || Activity;
              return (
                <div key={item.label} className="bg-yellow-500/[0.04] border border-yellow-500/15 rounded-xl p-4">
                  <Ic className="w-5 h-5 text-yellow-400 mb-2" />
                  <p className="text-xs font-bold text-yellow-300">{item.label}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{item.desc}</p>
                </div>
              );
            })}
          </div>
          <p className="text-gray-400 text-[15px] leading-relaxed">{v.cahierSection.after}</p>
        </section>

        {v.partMentorat.paras?.[0] && (
          <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">{v.partMentorat.title}</h3>
            {v.partMentorat.paras.map((p) => (
              <p key={p.slice(0, 40)} className="text-sm text-gray-400 leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        )}

        <div className="flex items-center gap-4 opacity-40">
          <div className="h-px bg-red-500 flex-1" />
          <span className="text-xs text-red-400 uppercase tracking-widest font-bold whitespace-nowrap">{v.partMentorat.label}</span>
          <div className="h-px bg-red-500 flex-1" />
        </div>

        <section className="space-y-5">
          <h2 className="text-2xl font-serif font-bold text-white">
            {v.mentoratShield.title}
          </h2>
          {v.mentoratShield.paras.map((p, i) => (
            <p key={i} className={`text-[15px] leading-relaxed ${i === 0 ? 'text-gray-300' : 'text-gray-400'}`}>
              {p}
            </p>
          ))}
          <blockquote className="border-l-4 border-red-500/40 pl-5 py-3 bg-red-500/[0.03] rounded-r-xl">
            <p className="text-sm text-red-200/80 italic leading-relaxed">« {v.mentoratShield.blockquote} »</p>
          </blockquote>
        </section>

        <section className="space-y-5">
          <h3 className="text-xl font-serif font-bold text-red-300 flex items-center gap-3">
            <Shield className="w-5 h-5" /> {v.maitreAutel.h3}
          </h3>
          <p className="text-gray-300 text-[15px] leading-relaxed">{v.maitreAutel.lead}</p>
          <p className="text-gray-400 text-sm mb-3">{v.maitreAutel.carrefourNote}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {v.maitreAutel.situations.map((item) => {
              const Ic = VS_ICONS[item.key] || Heart;
              return (
                <div key={item.title} className="bg-red-500/[0.03] border border-red-500/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Ic className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-bold text-red-300">{item.title}</span>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex items-center gap-4 opacity-40">
          <div className="h-px bg-white flex-1" />
          <span className="text-sm text-gray-400 uppercase tracking-widest font-bold whitespace-nowrap">Synthese</span>
          <div className="h-px bg-white flex-1" />
        </div>

        <section className="space-y-6">
          <h2 className="text-2xl font-serif font-bold text-white text-center">
            {v.synthese.title}
          </h2>
          <p className="text-gray-300 text-[15px] leading-relaxed text-center max-w-2xl mx-auto">
            {v.synthese.text}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse bg-[#141c27] rounded-xl overflow-hidden">
              <thead>
                <tr>
                  <th className="text-left py-4 px-5 text-gray-500 font-medium text-xs uppercase tracking-wider border-b border-white/5">Critere</th>
                  <th className="text-left py-4 px-5 text-yellow-400 font-bold text-xs uppercase tracking-wider border-b border-yellow-500/20 bg-yellow-500/[0.03]">Coaching</th>
                  <th className="text-left py-4 px-5 text-red-400 font-bold text-xs uppercase tracking-wider border-b border-red-500/20 bg-red-500/[0.03]">Mentorat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {v.comparisonRows.map((row) => (
                  <tr key={row[0]} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-5 text-white font-semibold text-xs">{row[0]}</td>
                    <td className="py-3 px-5 text-gray-400 text-xs bg-yellow-500/[0.02]">{row[1]}</td>
                    <td className="py-3 px-5 text-gray-400 text-xs bg-red-500/[0.02]">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-gradient-to-r from-[#192734] to-[#141c27] rounded-2xl p-8 md:p-10 border border-white/10 text-center space-y-5">
          <p className="text-gray-300 text-[15px] leading-relaxed italic">
            {v.closingReflection.p1}
          </p>
          <p className="text-gray-400 text-[15px] leading-relaxed">
            {v.closingReflection.p2}
          </p>
          <p className="text-lg font-serif font-bold text-white">
            {v.closingReflection.p3Before}
            <span className="text-yellow-300">{v.closingReflection.p3HighlightCoaching}</span>
            {v.closingReflection.p3Between}
            <span className="text-red-300">{v.closingReflection.p3HighlightMentor}</span>
            {v.closingReflection.p3After}
          </p>
        </section>

        {/* CTA Links */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/accompagnement/coaching" className="block">
            <div className="bg-yellow-500/[0.05] border border-yellow-500/20 rounded-2xl p-6 text-center hover:bg-yellow-500/[0.1] transition-all group">
              <BookOpen className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-yellow-300 mb-2">Coaching Therapeute</h3>
              <p className="text-sm text-gray-500 mb-4">Apprendre le metier. Devenir praticien.</p>
              <span className="inline-flex items-center gap-1 text-sm text-yellow-400 font-semibold group-hover:gap-2 transition-all">
                Decouvrir <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>
          <Link to="/accompagnement/mentorat" className="block">
            <div className="bg-red-500/[0.05] border border-red-500/20 rounded-2xl p-6 text-center hover:bg-red-500/[0.1] transition-all group">
              <Shield className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-red-300 mb-2">Montorat Spirituel</h3>
              <p className="text-sm text-gray-500 mb-4">Etre protege. Beneficier d'un intercesseur.</p>
              <span className="inline-flex items-center gap-1 text-sm text-red-400 font-semibold group-hover:gap-2 transition-all">
                Decouvrir <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>
        </section>

        {/* CTA Principal */}
        <section className="bg-gradient-to-br from-[#192734] to-[#0f1216] rounded-3xl p-10 md:p-16 text-center border border-white/10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold font-serif text-white">Besoin d'aide pour choisir ?</h2>
            <p className="text-gray-400">
              Prenez rendez-vous avec un conseiller qui analysera votre situation et vous orientera vers le service le plus adapte a votre phase de vie.
            </p>
            <a href="/appointment/request">
              <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500 gap-2 h-12 px-8 text-lg font-bold mt-4">
                <MessageCircle className="w-5 h-5" /> Prendre rendez-vous
              </Button>
            </a>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-4 border-t border-white/5">
          <p className="text-sm text-gray-600">
            {v.footer}
          </p>
        </div>
      </article>
    </div>
  );
};

export default MentoratPage;