import React from 'react';
import { ArrowRight, CalendarClock, MessageSquare } from 'lucide-react';
import { CHEMIN_CONSULTATION, CHEMIN_CONTACT } from '@/components/prorascience/prorascienceOffres';

/**
 * CONTACT & RENDEZ-VOUS — le site n'offrait aucun canal entrant (« Prendre rendez-vous » était
 * un href="#", et « Contact » une ancre vers la section « choisir sa porte »).
 *
 * ⚠️ Les deux chemins proposés sont les SEULS qui fonctionnent aujourd'hui sur le domaine propre :
 *  - /nous-contacter (ContactPage : formulaire réel → table contact_requests) ;
 *  - le checkout de la consultation (la séance de 90 min est le rendez-vous vendu).
 * Il n'existe PAS de route racine /reserver : tant qu'elle manque, on ne promet pas de créneau
 * en ligne et on ne chaîne pas `next=reserver` (qui aboutirait sur « Page Non Trouvée »).
 */
export default function ProrascienceContactBloc({
  eyebrow = 'Parler à quelqu’un',
  titre = 'Une question, une urgence, un cas particulier ?',
  texte = 'Écrivez au secrétariat : votre demande est lue, qualifiée, puis orientée vers la bonne porte. Si vous savez déjà que vous voulez un diagnostic, réservez directement la consultation.',
}) {
  const gold = { color: 'var(--gold)' };
  return (
    <section id="contact" className="relative py-20">
      <div className="mx-auto max-w-4xl px-5 sm:px-6">
        <div className="rounded-3xl border p-7 sm:p-12" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>{eyebrow}</p>
          <h2 className="mq-display mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{titre}</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--muted)' }}>{texte}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={CHEMIN_CONTACT}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110"
              style={{ background: 'var(--gold)', color: '#0d0b09' }}
            >
              <MessageSquare className="h-4 w-4" /> Écrire au secrétariat
            </a>
            <a
              href={CHEMIN_CONSULTATION}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border px-7 py-3 text-sm font-semibold transition hover:bg-[var(--gold)] hover:text-[#0d0b09]"
              style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
            >
              <CalendarClock className="h-4 w-4" /> Réserver une consultation <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
