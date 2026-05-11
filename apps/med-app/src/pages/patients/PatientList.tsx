import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { patientsApi } from '../../lib/api'

export default function PatientList() {
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    patientsApi.list().then(r => {
      setPatients(r.data.data || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Chargement...</p>

  return (
    <div>
      <h1>Patients</h1>
      <ul>
        {patients.map((p: any) => (
          <li key={p.id}>
            <Link to={`/patients/${p.id}`}>{p.last_name} {p.first_name}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
