import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { patientsApi, notesApi } from '../../lib/api'

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>()
  const [patient, setPatient] = useState<any>(null)
  const [notes, setNotes] = useState<any[]>([])

  useEffect(() => {
    if (id) {
      patientsApi.get(id).then(r => setPatient(r.data.data))
      notesApi.listByPatient(id).then(r => setNotes(r.data.data || []))
    }
  }, [id])

  if (!patient) return <p>Chargement...</p>

  return (
    <div>
      <h1>{patient.last_name} {patient.first_name}</h1>
      <p>Date de naissance : {patient.date_of_birth || '—'}</p>
      <p>Genre : {patient.gender || '—'}</p>
      <p>Statut : {patient.status}</p>

      <h2>Notes de consultation</h2>
      <Link to={`/patients/${id}/notes/new`}>+ Nouvelle note</Link>
      <ul>
        {notes.map((n: any) => (
          <li key={n.id}>
            {n.subjective?.slice(0, 80)} — {n.is_signed ? '✅ Signée' : '📝 Brouillon'}
          </li>
        ))}
      </ul>
    </div>
  )
}
