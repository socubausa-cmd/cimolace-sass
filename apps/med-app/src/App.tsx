import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/dashboard/Dashboard'
import PatientList from './pages/patients/PatientList'
import PatientDetail from './pages/patients/PatientDetail'
import NoteEditor from './pages/notes/NoteEditor'

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <nav style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
        <Link to="/dashboard">Tableau de bord</Link>
        <Link to="/patients">Patients</Link>
      </nav>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/patients" element={<PatientList />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/patients/:id/notes/new" element={<NoteEditor />} />
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </div>
  )
}
