import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const api = axios.create({ baseURL: API_URL })

export function setAuth(token: string, tenantSlug: string) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  api.defaults.headers.common['X-Tenant-Slug'] = tenantSlug
}

// Patients
export const patientsApi = {
  list: () => api.get('/med/patients'),
  get: (id: string) => api.get(`/med/patients/${id}`),
  create: (data: Record<string, unknown>) => api.post('/med/patients', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/med/patients/${id}`, data),
}

// Notes
export const notesApi = {
  listByPatient: (patientId: string) => api.get(`/med/patients/${patientId}/notes`),
  create: (patientId: string, data: Record<string, unknown>) => api.post(`/med/patients/${patientId}/notes`, data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/med/notes/${id}`, data),
  sign: (id: string) => api.post(`/med/notes/${id}/sign`),
  share: (id: string, shared: boolean) => api.post(`/med/notes/${id}/share`, { is_shared: shared }),
}
