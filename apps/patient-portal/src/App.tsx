import { NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/dashboard/Dashboard'
import HealthJournal from './pages/journal/HealthJournal'
import SharedNotes from './pages/notes/SharedNotes'
import PatientRecords from './pages/records/PatientRecords'

const navItems = [
  { to: '/dashboard', label: 'Accueil' },
  { to: '/records', label: 'Dossier' },
  { to: '/notes', label: 'Notes' },
  { to: '/journal', label: 'Journal' },
]

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">MedOS Patient</p>
          <h1>Espace santé</h1>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/records" element={<PatientRecords />} />
          <Route path="/notes" element={<SharedNotes />} />
          <Route path="/journal" element={<HealthJournal />} />
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  )
}
