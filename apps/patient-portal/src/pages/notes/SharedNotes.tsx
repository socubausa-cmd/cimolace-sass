import { useEffect, useState } from 'react'
import { type MedNote, notesApi } from '../../lib/api'

type LoadState = 'loading' | 'ready' | 'error'

function formatDate(value: string | null) {
  if (!value) return 'Non signé'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function SharedNotes() {
  const [state, setState] = useState<LoadState>('loading')
  const [notes, setNotes] = useState<MedNote[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    notesApi
      .listMine()
      .then((data) => {
        setNotes(data)
        setState('ready')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Impossible de charger les notes.')
        setState('error')
      })
  }, [])

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Consultations</p>
          <h2>Notes partagées</h2>
        </div>
        <span className="count-pill">{notes.length} note{notes.length > 1 ? 's' : ''}</span>
      </header>

      {state === 'loading' && <section className="empty-panel">Chargement des notes...</section>}

      {state === 'error' && (
        <section className="notice-panel">
          <strong>Accès patient requis</strong>
          <p>{error}</p>
        </section>
      )}

      {state === 'ready' && notes.length === 0 && (
        <section className="empty-panel">
          <strong>Aucune note partagée</strong>
          <p>Votre praticien partagera ici les consultations disponibles pour vous.</p>
        </section>
      )}

      {state === 'ready' && notes.length > 0 && (
        <section className="notes-list">
          {notes.map((note) => (
            <article className="note-card" key={note.id}>
              <div className="note-card__top">
                <span className="mono">{note.id.slice(0, 8)}...</span>
                <span className={note.is_signed ? 'status signed' : 'status'}>{note.is_signed ? 'Signée' : 'Brouillon'}</span>
              </div>
              <dl className="soap-grid">
                <div>
                  <dt>S</dt>
                  <dd>{note.subjective || 'Non renseigné'}</dd>
                </div>
                <div>
                  <dt>O</dt>
                  <dd>{note.objective || 'Non renseigné'}</dd>
                </div>
                <div>
                  <dt>A</dt>
                  <dd>{note.assessment || 'Non renseigné'}</dd>
                </div>
                <div>
                  <dt>P</dt>
                  <dd>{note.plan || 'Non renseigné'}</dd>
                </div>
              </dl>
              <p className="note-meta">Signée le {formatDate(note.signed_at)}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
