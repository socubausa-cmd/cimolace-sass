import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001'
const TOKEN_KEY = 'isna-v2-debug-api-bearer'
const TENANT_KEY = 'isna-v2-tenant-slug'

export const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  const tenantSlug = localStorage.getItem(TENANT_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (tenantSlug) config.headers['X-Tenant-Slug'] = tenantSlug
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response) {
      const data = error.response.data as { error?: { message?: string } } | undefined
      return Promise.reject(new Error(data?.error?.message ?? error.message))
    }
    return Promise.reject(error)
  },
)

export function setAuth(token: string, tenantSlug: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TENANT_KEY, tenantSlug)
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  api.defaults.headers.common['X-Tenant-Slug'] = tenantSlug
}

export interface MedNote {
  id: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  free_text: string | null
  is_shared_with_patient: boolean
  is_signed: boolean
  signed_at: string | null
  created_at: string
}

type ApiEnvelope<T> = { data: T }

function unwrap<T>(response: { data: ApiEnvelope<T> }): T {
  return response.data.data
}

// Patient records (own only)
export const recordsApi = {
  getMine: (id: string) => api.get(`/med/patients/${id}`),
}

// Shared notes
export const notesApi = {
  listByPatient: (patientId: string) => api.get(`/med/patients/${patientId}/notes`),
  listMine: () => api.get<ApiEnvelope<MedNote[]>>('/med/me/notes').then(unwrap),
}
