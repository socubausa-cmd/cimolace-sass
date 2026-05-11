import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Portail patient</p>
          <h2>Votre dossier MedOS</h2>
          <p>
            Consultez les notes partagées par votre praticien et gardez un accès clair aux informations de suivi.
          </p>
        </div>
        <Link className="primary-action" to="/notes">
          Voir mes notes
        </Link>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Accès</span>
          <strong>Privé</strong>
          <p>Connexion patient et isolation par tenant.</p>
        </article>
        <article className="metric-card">
          <span>Notes</span>
          <strong>Partagées</strong>
          <p>Seulement les consultations publiées par le praticien.</p>
        </article>
        <article className="metric-card">
          <span>Suivi</span>
          <strong>Phase 1B</strong>
          <p>Journal santé et formulaires seront ajoutés après validation.</p>
        </article>
      </section>
    </div>
  )
}
