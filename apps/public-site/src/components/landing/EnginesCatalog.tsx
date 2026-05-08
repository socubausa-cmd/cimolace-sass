"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Brain, Video, CreditCard, Mail, Calendar, Stethoscope, Workflow, FileText, MessageSquare, Shield, BarChart3, Bot } from "lucide-react";
import { ArrowLeft } from "lucide-react";

const allEngines = [
  { cat: "IA & Intelligence", icon: Brain, gradient: "from-purple-400 to-pink-500", engines: ["LIRI Brain — IA conversationnelle","SmartBoard — Génération slides","Masterclass Factory — Texte → formation","Neuro Recall — Rappels mnémotechniques","AI Charting — Transcription médicale"] },
  { cat: "Live & Vidéo", icon: Video, gradient: "from-red-400 to-orange-500", engines: ["LIRI Live — Broadcast LiveKit","Replay VOD — Mux/Cloudflare Stream","Studio Créateur — Production avancée","NLE Engine — Éditeur vidéo","Webinar — Webinaires interactifs"] },
  { cat: "Paiements", icon: CreditCard, gradient: "from-emerald-400 to-green-500", engines: ["Pay Engine — Orchestrateur","Stripe Connect — Compte par tenant","CinetPay — Mobile Money","Orange Money — Paiement Afrique","Chariow — Paiement régional"] },
  { cat: "Communication", icon: Mail, gradient: "from-blue-400 to-cyan-500", engines: ["Email Engine — Transactionnel + campagnes","SMS Engine — Twilio/Orange/MTN","WhatsApp Engine — Meta API","Push Engine — FCM/OneSignal","Chat Engine — Messagerie privée + groupes"] },
  { cat: "Contenu & Pédagogie", icon: FileText, gradient: "from-amber-400 to-yellow-500", engines: ["Course Builder — Constructeur de formation","Library Engine — Bibliothèque","Forum — Discussions + modération","Marketing Creator — Promos, popups"] },
  { cat: "Agenda", icon: Calendar, gradient: "from-rose-400 to-pink-500", engines: ["Calendar — Disponibilités + RDV","Appointment Engine — Gestion RDV","Secretary Matching — Matching secrétaire"] },
  { cat: "Santé — MedOS", icon: Stethoscope, gradient: "from-teal-400 to-emerald-500", engines: ["EHR — Dossiers patients","Consultation Notes — Notes SOAP","Prescriptions — Ordonnances PDF","Forms — Formulaires médicaux","Health Tracking — Suivi habitudes","Care Programs — Programmes de soins","AI Charting — Transcription Deepgram","GDPR Engine — Conformité RGPD"] },
  { cat: "Infrastructure", icon: Workflow, gradient: "from-slate-400 to-slate-600", engines: ["Workflow Engine — Automation no-code","Webhook Engine — Entrées/sorties HMAC","Activity Stream — Journal global","Template Engine — Templates multi-canaux","Event Bus — pub/sub central"] },
];

export function EnginesCatalog() {
  return (
    <>
      <section className="relative bg-black py-24 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-sm mb-8"><ArrowLeft className="w-4 h-4" /> Accueil</Link>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">40+ moteurs<span className="text-indigo-400">.</span></h1>
          <p className="text-lg text-white/40 max-w-xl mx-auto mb-8">Des modules indépendants que vous activez comme des apps. Interopérables, sécurisés, évolutifs.</p>
        </div>
      </section>
      <section className="relative bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="space-y-10">
            {allEngines.map((cat, ci) => {
              const Icon = cat.icon;
              return (
                <motion.div key={cat.cat} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: ci * 0.05 }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cat.gradient} flex items-center justify-center`}><Icon className="w-4 h-4 text-white" /></div>
                    <h2 className="text-xl font-bold text-slate-900">{cat.cat}</h2>
                    <span className="text-xs text-slate-400">({cat.engines.length} moteurs)</span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {cat.engines.map((e) => (
                      <div key={e} className="bg-white border border-slate-100 rounded-xl px-4 py-3 text-sm text-slate-600 hover:border-slate-200 hover:shadow-sm transition-all">{e}</div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
