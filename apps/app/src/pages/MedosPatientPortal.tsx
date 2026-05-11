import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { medosApi, tenantsApi, type MedNote } from '../lib/api';

type PortalView =
  | 'today'
  | 'notes'
  | 'record'
  | 'forms'
  | 'journal'
  | 'care'
  | 'exams'
  | 'prescriptions'
  | 'messages';

const navItems: Array<{ view: PortalView; label: string; href: string }> = [
  { view: 'today', label: "Aujourd'hui", href: '/dashboard/medos/me' },
  { view: 'notes', label: 'Notes', href: '/dashboard/medos/me/notes' },
  { view: 'record', label: 'Dossier', href: '/dashboard/medos/me/record' },
  { view: 'forms', label: 'Formulaires', href: '/dashboard/medos/me/forms' },
  { view: 'journal', label: 'Journal', href: '/dashboard/medos/me/journal' },
  { view: 'care', label: 'Recommandations', href: '/dashboard/medos/me/care' },
  { view: 'exams', label: 'Examens', href: '/dashboard/medos/me/exams' },
  { view: 'prescriptions', label: 'Ordonnances', href: '/dashboard/medos/me/prescriptions' },
  { view: 'messages', label: 'Messages', href: '/dashboard/medos/me/messages' },
];

const plannedActions = [
  {
    title: 'Remplir le formulaire pre-consultation',
    detail: 'Intake medical, consentement et motif de consultation',
    status: 'A brancher',
  },
  {
    title: 'Envoyer un document',
    detail: "Resultat d'examen, photo, compte rendu ou ordonnance externe",
    status: 'A brancher',
  },
  {
    title: 'Demander un rendez-vous',
    detail: 'Choix du motif, preference de date et teleconsultation',
    status: 'A brancher',
  },
  {
    title: 'Ecrire au praticien',
    detail: 'Question securisee entre deux consultations',
    status: 'A brancher',
  },
];

const plannedNotifications = [
  'Nouvelle note partagee',
  'Formulaire a completer avant RDV',
  'Demande examen : NFS + glycemie',
  'Rappel journal sante du jour',
];

const plannedRecommendations = [
  {
    title: "Hydratation aujourd'hui",
    detail: "Objectif : 1.5 L d'eau, a confirmer dans le journal sante.",
    status: 'Action patient',
  },
  {
    title: 'Repos et sommeil',
    detail: 'Noter la qualite du sommeil pendant 3 jours.',
    status: 'Suivi',
  },
  {
    title: 'Surveillance symptomes',
    detail: "Indiquer severite, localisation et evolution si les symptomes persistent.",
    status: 'Important',
  },
];

function getPortalView(pathname: string): PortalView {
  const match = navItems.find((item) => item.href === pathname);
  return match?.view ?? 'today';
}

function formatDate(value: string | null) {
  if (!value) return 'Non signe';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function StatusPill({ children, tone = 'gray' }: { children: string; tone?: 'gray' | 'green' | 'blue' | 'amber' | 'purple' }) {
  const tones = {
    gray: 'border-gray-200 bg-gray-50 text-gray-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
  };
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function SoapSection({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{value || 'Non renseigne'}</dd>
    </div>
  );
}

function SharedNoteCard({
  note,
  isRead,
  onMarkRead,
}: {
  note: MedNote;
  isRead: boolean;
  onMarkRead: (noteId: string) => void;
}) {
  const [questionOpen, setQuestionOpen] = useState(false);

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs text-gray-400">{note.id}</p>
          <h3 className="mt-1 font-semibold text-gray-900">Consultation partagee</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="purple">Partagee</StatusPill>
          <StatusPill tone={note.is_signed ? 'blue' : 'amber'}>{note.is_signed ? 'Signee' : 'Non signee'}</StatusPill>
          {isRead && <StatusPill tone="green">Lue</StatusPill>}
        </div>
      </div>

      <dl className="grid gap-3 md:grid-cols-2">
        <SoapSection label="S - Subjective" value={note.subjective} />
        <SoapSection label="O - Objective" value={note.objective} />
        <SoapSection label="A - Assessment" value={note.assessment} />
        <SoapSection label="P - Plan" value={note.plan} />
      </dl>

      {note.free_text && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Note libre</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{note.free_text}</p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-400">Signee le {formatDate(note.signed_at)}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onMarkRead(note.id)}
            disabled={isRead}
            className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-60"
          >
            {isRead ? 'Lecture confirmee' : "J'ai lu"}
          </button>
          <button
            type="button"
            onClick={() => setQuestionOpen((value) => !value)}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            Poser une question
          </button>
        </div>
      </div>

      {questionOpen && (
        <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Question au praticien</label>
          <textarea
            className="mt-2 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            placeholder="Cette messagerie sera branchee au module Messages securises."
          />
          <button
            type="button"
            disabled
            className="mt-2 rounded-lg bg-indigo-300 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-70"
          >
            Envoi bientot disponible
          </button>
        </div>
      )}
    </article>
  );
}

function PortalCard({
  title,
  detail,
  status,
  tone = 'gray',
}: {
  title: string;
  detail: string;
  status: string;
  tone?: 'gray' | 'green' | 'blue' | 'amber' | 'purple';
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">{detail}</p>
        </div>
        <StatusPill tone={tone}>{status}</StatusPill>
      </div>
    </div>
  );
}

function PlaceholderPanel({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ title: string; detail: string; status: string }>;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <StatusPill tone="amber">Phase suivante</StatusPill>
        <h2 className="mt-3 text-xl font-bold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <PortalCard key={item.title} {...item} />
        ))}
      </div>
    </section>
  );
}

export function MedosPatientPortal() {
  const location = useLocation();
  const view = getPortalView(location.pathname);
  const queryClient = useQueryClient();
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const notes = useQuery({ queryKey: ['medos-my-shared-notes'], queryFn: medosApi.listMySharedNotes });
  const [readNoteIds, setReadNoteIds] = useState<string[]>([]);
  const readMutation = useMutation({
    mutationFn: medosApi.markMySharedNoteRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medos-my-shared-notes'] });
    },
  });

  const notesErrorMessage = notes.error instanceof Error ? notes.error.message : '';
  const isNetworkError = notesErrorMessage === 'Network Error';
  const unreadNotes = useMemo(
    () => (notes.data ?? []).filter((note) => !note.patient_read_at && !readNoteIds.includes(note.id)).length,
    [notes.data, readNoteIds],
  );

  const markRead = (noteId: string) => {
    setReadNoteIds((current) => (current.includes(noteId) ? current : [...current, noteId]));
    readMutation.mutate(noteId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">{tenant.data?.name ?? 'Cimolace tenant'}</p>
            <h1 className="font-semibold text-gray-900">Espace patient MedOS</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={unreadNotes > 0 ? 'purple' : 'green'}>
              {unreadNotes > 0 ? `${unreadNotes} action${unreadNotes > 1 ? 's' : ''} requise${unreadNotes > 1 ? 's' : ''}` : 'A jour'}
            </StatusPill>
            <Link to="/dashboard/medos" className="text-sm text-indigo-600 hover:underline">
              MedOS praticien
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <nav className="grid gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div>
          {tenant.isError && <p className="mb-4 text-sm text-red-600">{tenant.error.message}</p>}
          {notes.isError && (
            <section className="mb-4 rounded-lg border border-red-200 bg-red-50 p-6">
              <h2 className="font-semibold text-red-950">
                {isNetworkError ? 'API MedOS indisponible' : 'Acces patient requis'}
              </h2>
              <p className="mt-2 text-sm text-red-700">{notesErrorMessage}</p>
            </section>
          )}
          {readMutation.isError && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Lecture confirmee localement. La synchronisation serveur sera retentee apres application de la migration.
            </p>
          )}

          {view === 'today' && (
            <div className="grid gap-6">
              <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <StatusPill tone="green">Portail patient</StatusPill>
                    <h2 className="mt-4 text-2xl font-bold text-gray-900">Aujourd'hui</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                      Votre espace rassemble les notes partagees, les actions a faire, les rappels et les prochaines
                      etapes de soin. Les modules sensibles restent bloques tant que le backend securise n'est pas pret.
                    </p>
                  </div>
                  <div className="grid min-w-48 grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <span className="text-xs uppercase tracking-wide text-gray-400">Notes</span>
                      <span className="mt-1 block text-2xl font-bold text-gray-900">
                        {notes.isLoading ? '...' : notes.data?.length ?? 0}
                      </span>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <span className="text-xs uppercase tracking-wide text-gray-400">A lire</span>
                      <span className="mt-1 block text-2xl font-bold text-gray-900">{notes.isLoading ? '...' : unreadNotes}</span>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
                <section>
                  <h2 className="mb-3 text-lg font-bold text-gray-900">Actions rapides</h2>
                  <div className="grid gap-3">
                    {plannedActions.map((action) => (
                      <PortalCard key={action.title} {...action} tone="amber" />
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <h2 className="font-bold text-gray-900">Notifications</h2>
                  <div className="mt-4 grid gap-3">
                    {plannedNotifications.map((notification, index) => (
                      <div key={notification} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-gray-800">{notification}</p>
                          <StatusPill tone={index === 0 ? 'purple' : 'gray'}>{index === 0 ? 'Nouveau' : 'Pret'}</StatusPill>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900">Dernieres notes partagees</h2>
                  <Link to="/dashboard/medos/me/notes" className="text-sm text-indigo-600 hover:underline">
                    Tout voir
                  </Link>
                </div>
                {notes.isLoading && <p className="text-sm text-gray-500">Chargement des notes partagees...</p>}
                {notes.data && notes.data.length === 0 && (
                  <PortalCard
                    title="Aucune note partagee"
                    detail="Votre praticien pourra partager ici les consultations disponibles pour vous."
                    status="Vide"
                  />
                )}
                {notes.data && notes.data.length > 0 && (
                  <div className="grid gap-4">
                    {notes.data.slice(0, 2).map((note) => (
                      <SharedNoteCard
                        key={note.id}
                        note={note}
                        isRead={Boolean(note.patient_read_at) || readNoteIds.includes(note.id)}
                        onMarkRead={markRead}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {view === 'notes' && (
            <section>
              <div className="mb-5">
                <StatusPill tone="green">Actif</StatusPill>
                <h2 className="mt-3 text-2xl font-bold text-gray-900">Notes cliniques partagees</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Seules les notes explicitement partagees par le praticien sont visibles ici.
                </p>
              </div>
              {notes.isLoading && <p className="text-sm text-gray-500">Chargement des notes partagees...</p>}
              {notes.data && notes.data.length === 0 && (
                <section className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                  <h2 className="font-semibold text-gray-900">Aucune note partagee</h2>
                  <p className="mt-2 text-sm text-gray-500">
                    Votre praticien pourra partager ici les consultations disponibles pour vous.
                  </p>
                </section>
              )}
              {notes.data && notes.data.length > 0 && (
                <div className="grid gap-4">
                  {notes.data.map((note) => (
                    <SharedNoteCard
                      key={note.id}
                      note={note}
                      isRead={Boolean(note.patient_read_at) || readNoteIds.includes(note.id)}
                      onMarkRead={markRead}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {view === 'record' && (
            <PlaceholderPanel
              title="Dossier medical lecture seule"
              description="Le patient doit voir ses informations medicales de base, consentements, allergies et contacts d'urgence sans pouvoir modifier le dossier clinique."
              items={[
                { title: 'Profil medical', detail: 'Identite, date de naissance, groupe sanguin, allergies, traitements courants', status: 'A brancher' },
                { title: 'Consentements', detail: 'Consentement explicite, date, finalite et historique', status: 'Prioritaire' },
                { title: 'Export dossier', detail: 'Demande export RGPD JSON/PDF avec audit', status: 'Plus tard' },
              ]}
            />
          )}

          {view === 'forms' && (
            <PlaceholderPanel
              title="Formulaires a completer"
              description="Les formulaires sont le premier vrai workflow patient : intake, consentement, suivi post-consultation et questionnaires specialises."
              items={[
                { title: 'Intake patient general', detail: 'Antecedents, allergies, motif de consultation', status: 'MVP' },
                { title: 'Consentement eclaire', detail: 'Signature electronique, IP, timestamp et version du texte', status: 'MVP' },
                { title: 'PHQ-9', detail: 'Score automatique et revue praticien', status: 'Phase 2' },
              ]}
            />
          )}

          {view === 'journal' && (
            <PlaceholderPanel
              title="Journal sante"
              description="Le patient doit pouvoir envoyer des signaux utiles entre les consultations : humeur, sommeil, symptomes, vitaux, alimentation et notes."
              items={[
                { title: 'Check-in du jour', detail: 'Humeur, energie, sommeil, symptomes et note libre', status: 'MVP' },
                { title: 'Photos repas ou documents', detail: 'Upload prive vers storage medical', status: 'Phase 2' },
                { title: 'Graphiques de suivi', detail: 'Tendance sommeil, poids, tension, symptomes', status: 'Phase 2' },
              ]}
            />
          )}

          {view === 'care' && (
            <section>
              <div className="mb-5">
                <StatusPill tone="amber">A construire</StatusPill>
                <h2 className="mt-3 text-2xl font-bold text-gray-900">Recommandations et plan de soin</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Ces cartes deviendront des taches suivies par le patient, reliees aux notes, programmes ou demandes du praticien.
                </p>
              </div>
              <div className="grid gap-3">
                {plannedRecommendations.map((item) => (
                  <PortalCard key={item.title} {...item} tone="blue" />
                ))}
              </div>
            </section>
          )}

          {view === 'exams' && (
            <PlaceholderPanel
              title="Demandes d'examen"
              description="Un vrai portail patient doit expliquer ce qui est demande, pourquoi, ou envoyer les resultats, puis afficher le statut de revue praticien."
              items={[
                { title: 'Analyse laboratoire', detail: 'NFS, glycemie, bilan lipidique avec PDF de demande', status: 'MVP' },
                { title: 'Imagerie', detail: 'Demande radio/echo/IRM et consignes', status: 'Phase 2' },
                { title: 'Resultat recu', detail: 'Upload patient, statut revu par praticien', status: 'MVP' },
              ]}
            />
          )}

          {view === 'prescriptions' && (
            <PlaceholderPanel
              title="Ordonnances"
              description="Le patient doit pouvoir consulter, telecharger et relire les instructions des ordonnances signees."
              items={[
                { title: 'Ordonnance PDF signee', detail: 'Telechargement, validite, instructions et audit', status: 'MVP' },
                { title: 'Prescription supplement ou nutrition', detail: 'Dosage, frequence, duree, precautions', status: 'MVP' },
                { title: 'Envoi pharmacie ou labo', detail: 'Email/fax/WhatsApp selon marche', status: 'Plus tard' },
              ]}
            />
          )}

          {view === 'messages' && (
            <PlaceholderPanel
              title="Messagerie securisee"
              description="Le patient doit pouvoir demander une clarification, recevoir des consignes et partager des pieces jointes dans un canal audite."
              items={[
                { title: 'Fil praticien-patient', detail: 'Messages texte, non lus, pieces jointes', status: 'MVP' },
                { title: "Message d'absence", detail: 'Indisponibilite praticien et delai de reponse attendu', status: 'Phase 2' },
                { title: 'Notification email', detail: 'Alerte sans contenu medical sensible dans le mail', status: 'MVP' },
              ]}
            />
          )}
        </div>
      </main>
    </div>
  );
}
