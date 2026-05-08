import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";

export const metadata: Metadata = { title: "Contact — Cimolace" };

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <h1 className="text-4xl font-bold text-slate-900 mb-4">Contact</h1>
      <p className="text-lg text-slate-500 mb-12">Une question ? Un projet ? L&apos;équipe Cimolace vous répond.</p>

      <div className="grid sm:grid-cols-2 gap-6 mb-16">
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8">
          <Mail className="w-8 h-8 text-indigo-500 mb-4" />
          <h3 className="font-semibold text-slate-900 mb-2">Email</h3>
          <a href="mailto:hello@cimolace.com" className="text-indigo-600 hover:text-indigo-700">hello@cimolace.com</a>
          <p className="text-xs text-slate-400 mt-2">Réponse sous 24h ouvrées</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8">
          <MessageCircle className="w-8 h-8 text-emerald-500 mb-4" />
          <h3 className="font-semibold text-slate-900 mb-2">Support</h3>
          <a href="mailto:support@cimolace.com" className="text-emerald-600 hover:text-emerald-700">support@cimolace.com</a>
          <p className="text-xs text-slate-400 mt-2">Clients Pro et Business : prioritaire</p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Envoyez-nous un message</h2>
        <form className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <input type="text" placeholder="Nom" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
            <input type="email" placeholder="Email" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
          </div>
          <input type="text" placeholder="Sujet" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
          <textarea rows={5} placeholder="Votre message..." className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none" />
          <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-indigo-700 transition-colors">Envoyer</button>
        </form>
      </div>
    </div>
  );
}
