import { Link } from 'react-router-dom'

export default function PatientRecords() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Dossier médical</p>
          <h2>Vue patient</h2>
        </div>
      </header>
      <section className="notice-panel">
        <strong>Lecture patient limitée en Phase 1A</strong>
        <p>
          Les notes partagées sont disponibles maintenant. La fiche complète du dossier patient sera branchée avec
          l'écran dédié de la Phase 1B.
        </p>
        <Link className="secondary-action" to="/notes">
          Ouvrir les notes
        </Link>
      </section>
    </div>
  )
}
