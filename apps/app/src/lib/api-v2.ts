/**
 * ISNA V2 — API Client complet
 * 
 * Client unifié pour tous les modules backend NestJS.
 * Remplace les appels supabase.from() directs.
 * 
 * Usage: import { api } from './api-v2'
 */

import axios from 'axios';
import { getApiBaseUrl } from './apiBase';
import { authStore } from './auth-store';

// ── Axios instance ──────────────────────────────────────────────────────────

export const apiV2 = axios.create({ baseURL: getApiBaseUrl() });

apiV2.interceptors.request.use((config) => {
  const token = authStore.getToken();
  const slug = authStore.getTenantSlug();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (slug) config.headers['X-Tenant-Slug'] = slug;
  return config;
});

apiV2.interceptors.response.use(
  (r) => r,
  (err: unknown) => {
    if (axios.isAxiosError(err) && err.response) {
      const data = err.response.data as { error?: { code?: string; message?: string } } | undefined;
      const msg = data?.error?.message ?? err.message;
      return Promise.reject(new Error(msg));
    }
    return Promise.reject(err);
  },
);

// ── Helpers ─────────────────────────────────────────────────────────────────

type ApiEnvelope<T> = { data: T };

function unwrap<T>(response: { data: ApiEnvelope<T> }): T {
  return response.data.data;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  me: () => apiV2.get<ApiEnvelope<any>>('/auth/me').then(unwrap),
};

// ── Tenant ──────────────────────────────────────────────────────────────────

export const tenantsApi = {
  create: (body: { name: string; slug: string }) =>
    apiV2.post<ApiEnvelope<any>>('/tenants', body).then(unwrap),
  current: () => apiV2.get<ApiEnvelope<any>>('/tenants/current').then(unwrap),
  updateBranding: (body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>('/tenants/current/branding', body).then(unwrap),
  mine: () => apiV2.get<ApiEnvelope<any[]>>('/tenants/mine').then(unwrap),
  dashboard: () => apiV2.get<ApiEnvelope<any>>('/tenants/current/dashboard').then(unwrap),
  listMembers: () => apiV2.get<ApiEnvelope<any[]>>('/tenants/current/members').then(unwrap),
  inviteMember: (email: string, role: string) =>
    apiV2.post<ApiEnvelope<any>>('/tenants/current/members', { email, role }).then(unwrap),
  updateMemberRole: (userId: string, role: string) =>
    apiV2.patch<ApiEnvelope<any>>(`/tenants/current/members/${userId}`, { role }).then(unwrap),
  removeMember: (userId: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/tenants/current/members/${userId}`).then(unwrap),
};

// ── Lives ───────────────────────────────────────────────────────────────────

export const livesApi = {
  list: (limit = 20, offset = 0) =>
    apiV2.get<ApiEnvelope<any[]>>(`/lives?limit=${limit}&offset=${offset}`).then(unwrap),
  get: (id: string) => apiV2.get<ApiEnvelope<any>>(`/lives/${id}`).then(unwrap),
  create: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/lives', body).then(unwrap),
  getToken: (id: string) =>
    apiV2.get<ApiEnvelope<{ token: string; roomName: string }>>(`/lives/${id}/token`).then(unwrap),
  // Chat
  sendChat: (id: string, content: string) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/${id}/chat`, { content }).then(unwrap),
  getChat: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/lives/${id}/chat`).then(unwrap),
  // Questions
  askQuestion: (id: string, content: string) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/${id}/questions`, { content }).then(unwrap),
  getQuestions: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/lives/${id}/questions`).then(unwrap),
  answerQuestion: (id: string, qid: string, answer: string) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/${id}/questions/${qid}/answer`, { answer }).then(unwrap),
  // Transcript
  getTranscript: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/lives/${id}/transcript`).then(unwrap),
  // Participants
  getParticipants: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/lives/${id}/participants`).then(unwrap),
  // Scripts
  saveScript: (id: string, sections: unknown[]) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/${id}/scripts`, { sections }).then(unwrap),
  getScript: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/lives/${id}/scripts`).then(unwrap),
  // Waiting room
  getWaitingRoom: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/lives/${id}/waiting-room`).then(unwrap),
  admitToRoom: (id: string, userId: string) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/${id}/waiting-room/admit`, { userId }).then(unwrap),
  // Debate
  createDebate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/lives/debates', body).then(unwrap),
  listDebates: () =>
    apiV2.get<ApiEnvelope<any[]>>('/lives/debates').then(unwrap),
  getDebate: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/lives/debates/${id}`).then(unwrap),
  submitVote: (id: string, side: string) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/debates/${id}/vote`, { side }).then(unwrap),
  getDebateResults: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/lives/debates/${id}/results`).then(unwrap),
};

// ── Checkout ────────────────────────────────────────────────────────────────

export const checkoutApi = {
  createSession: (liveSessionId: string) =>
    apiV2.post<ApiEnvelope<{ checkoutUrl: string }>>('/checkout/sessions', { liveSessionId }).then(unwrap),
  createPawaPay: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/checkout/sessions/pawapay', body).then(unwrap),
  getPawaPayStatus: (depositId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/checkout/sessions/pawapay/${depositId}/status`).then(unwrap),
  getPawaPayProviders: () =>
    apiV2.get<ApiEnvelope<any[]>>('/checkout/pawapay/providers').then(unwrap),
  getStripeConnectOnboarding: (returnUrl?: string) =>
    apiV2.post<ApiEnvelope<{ url: string; accountId: string }>>('/checkout/stripe-connect/onboarding', { return_url: returnUrl }).then(unwrap),
};

// ── Offering checkout (PawaPay) — abonnement mentorat / consultation / offrande ──
export const offeringCheckoutApi = {
  createMobileMoney: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/mobile-money', body).then(unwrap),
  /** Paiement CARTE (Stripe Checkout) → renvoie { checkoutUrl } à ouvrir (redirect). */
  createCard: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/card', body).then(unwrap),
  getStatus: (depositId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/offering-checkout/mobile-money/${depositId}/status`).then(unwrap),
  getProviders: (country?: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/offering-checkout/providers${country ? `?country=${encodeURIComponent(country)}` : ''}`).then(unwrap),
  /** Accès GRATUIT (service free/community) → débloque sans paiement, renvoie { ok }. */
  claimFree: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/claim-free', body).then(unwrap),
};

// ── Marketing ───────────────────────────────────────────────────────────────

export const marketingApi = {
  // Promo codes
  listPromos: () => apiV2.get<ApiEnvelope<any[]>>('/marketing/promo-codes').then(unwrap),
  createPromo: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/marketing/promo-codes', body).then(unwrap),
  updatePromo: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/marketing/promo-codes/${id}`, body).then(unwrap),
  deletePromo: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/marketing/promo-codes/${id}`).then(unwrap),
  // Popups
  listPopups: () => apiV2.get<ApiEnvelope<any[]>>('/marketing/popups').then(unwrap),
  createPopup: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/marketing/popups', body).then(unwrap),
  updatePopup: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/marketing/popups/${id}`, body).then(unwrap),
  deletePopup: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/marketing/popups/${id}`).then(unwrap),
  // Banners
  listBanners: () => apiV2.get<ApiEnvelope<any[]>>('/marketing/banners').then(unwrap),
  createBanner: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/marketing/banners', body).then(unwrap),
  updateBanner: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/marketing/banners/${id}`, body).then(unwrap),
  deleteBanner: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/marketing/banners/${id}`).then(unwrap),
};

// ── Forum ───────────────────────────────────────────────────────────────────

export const forumApi = {
  listCategories: () => apiV2.get<ApiEnvelope<any[]>>('/forum/categories').then(unwrap),
  listTopics: (params?: Record<string, string>) =>
    apiV2.get<ApiEnvelope<any[]>>('/forum/topics', { params }).then(unwrap),
  searchTopics: (q: string) =>
    apiV2.get<ApiEnvelope<any[]>>('/forum/topics/search', { params: { q } }).then(unwrap),
  getTopic: (id: string) => apiV2.get<ApiEnvelope<any>>(`/forum/topics/${id}`).then(unwrap),
  createTopic: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/forum/topics', body).then(unwrap),
  deleteTopic: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/forum/topics/${id}`).then(unwrap),
  listPosts: (topicId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/forum/topics/${topicId}/posts`).then(unwrap),
  createPost: (topicId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/forum/topics/${topicId}/posts`, body).then(unwrap),
  deletePost: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/forum/posts/${id}`).then(unwrap),
};

// ── Notifications ───────────────────────────────────────────────────────────

export const notificationsApi = {
  list: () => apiV2.get<ApiEnvelope<any[]>>('/notifications').then(unwrap),
  send: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/notifications/send', body).then(unwrap),
  markRead: (id: string) =>
    apiV2.patch<ApiEnvelope<any>>(`/notifications/${id}/read`).then(unwrap),
  getPreferences: () =>
    apiV2.get<ApiEnvelope<any>>('/notifications/preferences').then(unwrap),
  updatePreferences: (body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>('/notifications/preferences', body).then(unwrap),
};

// ── Booking ─────────────────────────────────────────────────────────────────

export const bookingApi = {
  createSlot: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/booking/slots', body).then(unwrap),
  listSlots: (params?: Record<string, string>) =>
    apiV2.get<ApiEnvelope<any[]>>('/booking/slots', { params }).then(unwrap),
  getSlot: (id: string) => apiV2.get<ApiEnvelope<any>>(`/booking/slots/${id}`).then(unwrap),
  deleteSlot: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/booking/slots/${id}`).then(unwrap),
  createAppointment: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/booking/appointments', body).then(unwrap),
  listAppointments: () =>
    apiV2.get<ApiEnvelope<any[]>>('/booking/appointments').then(unwrap),
  getAppointment: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/booking/appointments/${id}`).then(unwrap),
  updateAppointment: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/booking/appointments/${id}`, body).then(unwrap),
  submitFeedback: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/booking/feedback', body).then(unwrap),
  getFeedback: (appointmentId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/booking/feedback/${appointmentId}`).then(unwrap),
};

// ── LIRI Brain ──────────────────────────────────────────────────────────────

export const liriApi = {
  getModels: () => apiV2.get<ApiEnvelope<any[]>>('/liri/brain/models').then(unwrap),
  listConversations: () =>
    apiV2.get<ApiEnvelope<any[]>>('/liri/brain/conversations').then(unwrap),
  getConversation: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/liri/brain/conversations/${id}`).then(unwrap),
  streamChat: (message: string, model: string, conversationId?: string) => {
    const base = getApiBaseUrl();
    const token = authStore.getToken();
    const slug = authStore.getTenantSlug();
    const params = new URLSearchParams({ message, model });
    if (conversationId) params.set('conversationId', conversationId);
    return fetch(`${base}/liri/brain/chat?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': slug,
        Accept: 'text/event-stream',
      },
    });
  },
};

// ── Course Builder ──────────────────────────────────────────────────────────

export const courseBuilderApi = {
  createPipeline: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/pipelines', body).then(unwrap),
  listPipelines: () =>
    apiV2.get<ApiEnvelope<any[]>>('/course-builder/pipelines').then(unwrap),
  autoSegment: (id: string) =>
    apiV2.post<ApiEnvelope<any>>(`/course-builder/pipelines/${id}/segment`).then(unwrap),
  listSegments: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/course-builder/pipelines/${id}/segments`).then(unwrap),
  enqueueRender: (id: string) =>
    apiV2.post<ApiEnvelope<any>>(`/course-builder/pipelines/${id}/render`).then(unwrap),
  getRenderJobs: () =>
    apiV2.get<ApiEnvelope<any[]>>('/course-builder/render-jobs').then(unwrap),
  getRenderStatus: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/course-builder/render-jobs/${id}`).then(unwrap),
  segmentAiGenerate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/segment-ai-generate', body).then(unwrap),
  listSegmentAi: (contentId: string) =>
    apiV2.get<ApiEnvelope<any>>('/course-builder/segment-ai', { params: { contentId } }).then(unwrap),
  segmentAiApprove: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/segment-ai-approve', body).then(unwrap),
  postprodVersionSave: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/postprod-version-save', body).then(unwrap),
  postprodVersionList: (contentId: string) =>
    apiV2.get<ApiEnvelope<any>>('/course-builder/postprod-version-list', { params: { contentId } }).then(unwrap),
  postprodVersionRestore: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/postprod-version-restore', body).then(unwrap),
  pipelineAutoSegment: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/pipeline-auto-segment', body).then(unwrap),
  pipelineMasterScript: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/pipeline-master-script', body).then(unwrap),
  segmentIllustrationRegenerate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/segment-illustration-regenerate', body).then(unwrap),
  renderEnqueue: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/render-enqueue', body).then(unwrap),
  renderStatus: (contentId: string) =>
    apiV2.get<ApiEnvelope<any>>('/course-builder/render-status', { params: { contentId } }).then(unwrap),
};

// ── Courses ─────────────────────────────────────────────────────────────────

export const coursesApi = {
  create: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/courses', body).then(unwrap),
  list: () => apiV2.get<ApiEnvelope<any[]>>('/courses').then(unwrap),
  get: (id: string) => apiV2.get<ApiEnvelope<any>>(`/courses/${id}`).then(unwrap),
  update: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/courses/${id}`, body).then(unwrap),
  delete: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/courses/${id}`).then(unwrap),
  createModule: (courseId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/courses/${courseId}/modules`, body).then(unwrap),
  listModules: (courseId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/courses/${courseId}/modules`).then(unwrap),
  createLesson: (moduleId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/courses/modules/${moduleId}/lessons`, body).then(unwrap),
  listLessons: (moduleId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/courses/modules/${moduleId}/lessons`).then(unwrap),
  updateProgress: (lessonId: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/courses/progress/${lessonId}`, body).then(unwrap),
  getProgress: (courseId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/courses/${courseId}/progress`).then(unwrap),
};

// ── Messaging ───────────────────────────────────────────────────────────────

export const messagingApi = {
  send: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/messaging/send', body).then(unwrap),
  listConversations: () =>
    apiV2.get<ApiEnvelope<any[]>>('/messaging/conversations').then(unwrap),
  getConversation: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/messaging/conversations/${id}`).then(unwrap),
  createGroup: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/messaging/groups', body).then(unwrap),
  addGroupMember: (groupId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/messaging/groups/${groupId}/members`, body).then(unwrap),
  editMessage: (id: string, content: string) =>
    apiV2.patch<ApiEnvelope<any>>(`/messaging/messages/${id}`, { content }).then(unwrap),
  deleteMessage: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/messaging/messages/${id}`).then(unwrap),
  markRead: (conversationId: string) =>
    apiV2.post<ApiEnvelope<any>>(`/messaging/conversations/${conversationId}/read`, {}).then(unwrap),

  // ── Sujets (topics) — socle « forum connecté » greffé sur la messagerie ──────
  // Type de conversation `kind='topic'` (Phase A). Chemin de données PARALLÈLE au DM :
  // un sujet est un groupe (sans pair fixe) → il ne passe PAS par le regroupement par
  // pair de useRealtimeMessaging. Sous-module backend `messaging/topics`.
  listTopics: (params?: Record<string, string>) =>
    apiV2.get<ApiEnvelope<any[]>>('/messaging/topics', { params }).then(unwrap),
  getTopic: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/messaging/topics/${id}`).then(unwrap),
  getTopicMessages: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/messaging/topics/${id}/messages`).then(unwrap),
  createTopic: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/messaging/topics', body).then(unwrap),
  sendTopicMessage: (id: string, content: string) =>
    apiV2.post<ApiEnvelope<any>>(`/messaging/topics/${id}/messages`, { content }).then(unwrap),
  closeTopic: (id: string) =>
    apiV2.post<ApiEnvelope<any>>(`/messaging/topics/${id}/close`, {}).then(unwrap),
  reopenTopic: (id: string) =>
    apiV2.post<ApiEnvelope<any>>(`/messaging/topics/${id}/reopen`, {}).then(unwrap),
};

// ── Chat Engine ─────────────────────────────────────────────────────────────

export const chatEngineApi = {
  createRoom: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/chat-engine/rooms', body).then(unwrap),
  listRooms: () => apiV2.get<ApiEnvelope<any[]>>('/chat-engine/rooms').then(unwrap),
  joinRoom: (id: string) =>
    apiV2.post<ApiEnvelope<any>>(`/chat-engine/rooms/${id}/join`).then(unwrap),
  sendMessage: (id: string, content: string) =>
    apiV2.post<ApiEnvelope<any>>(`/chat-engine/rooms/${id}/messages`, { content }).then(unwrap),
  getMessages: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/chat-engine/rooms/${id}/messages`).then(unwrap),
  getOnline: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/chat-engine/rooms/${id}/online`).then(unwrap),
};

// ── MedOS ───────────────────────────────────────────────────────────────────

export const medosApi = {
  // Patients
  listPatients: () => apiV2.get<ApiEnvelope<any[]>>('/med/patients').then(unwrap),
  getPatient: (id: string) => apiV2.get<ApiEnvelope<any>>(`/med/patients/${id}`).then(unwrap),
  createPatient: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/med/patients', body).then(unwrap),
  updatePatient: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/med/patients/${id}`, body).then(unwrap),
  // Notes
  listNotes: (patientId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/med/patients/${patientId}/notes`).then(unwrap),
  createNote: (patientId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/med/patients/${patientId}/notes`, body).then(unwrap),
  updateNote: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/med/notes/${id}`, body).then(unwrap),
  signNote: (id: string) => apiV2.post<ApiEnvelope<any>>(`/med/notes/${id}/sign`).then(unwrap),
  shareNote: (id: string, shared: boolean) =>
    apiV2.post<ApiEnvelope<any>>(`/med/notes/${id}/share`, { is_shared: shared }).then(unwrap),
  // Patient self
  mySharedNotes: () => apiV2.get<ApiEnvelope<any[]>>('/med/me/notes').then(unwrap),
  markNoteRead: (noteId: string) =>
    apiV2.post<ApiEnvelope<any>>(`/med/me/notes/${noteId}/read`).then(unwrap),
  // Forms
  listForms: () => apiV2.get<ApiEnvelope<any[]>>('/med/forms').then(unwrap),
  getForm: (id: string) => apiV2.get<ApiEnvelope<any>>(`/med/forms/${id}`).then(unwrap),
  createForm: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/med/forms', body).then(unwrap),
  submitFormResponse: (formId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/med/forms/${formId}/responses`, body).then(unwrap),
  getFormResponses: (formId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/med/forms/${formId}/responses`).then(unwrap),
  // Health
  createHealthEntry: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/med/health', body).then(unwrap),
  getHealthEntries: (patientId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/med/health/patient/${patientId}`).then(unwrap),
};

// ── Secretariat ─────────────────────────────────────────────────────────────

export const secretariatApi = {
  createEnrollment: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/secretariat/enrollments', body).then(unwrap),
  listEnrollments: () => apiV2.get<ApiEnvelope<any[]>>('/secretariat/enrollments').then(unwrap),
  updateEnrollment: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/secretariat/enrollments/${id}`, body).then(unwrap),
  assignTeacher: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/secretariat/assign-teacher', body).then(unwrap),
  listAssignments: () => apiV2.get<ApiEnvelope<any[]>>('/secretariat/assignments').then(unwrap),
  createDocument: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/secretariat/documents', body).then(unwrap),
  listDocuments: () => apiV2.get<ApiEnvelope<any[]>>('/secretariat/documents').then(unwrap),
  getWorkflow: () => apiV2.get<ApiEnvelope<any[]>>('/secretariat/workflow').then(unwrap),
  updateWorkflow: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/secretariat/workflow/${id}`, body).then(unwrap),
};

// ── Growth ──────────────────────────────────────────────────────────────────

export const growthApi = {
  getStats: () => apiV2.get<ApiEnvelope<any>>('/growth/stats').then(unwrap),
  listLeads: () => apiV2.get<ApiEnvelope<any[]>>('/growth/leads').then(unwrap),
  createLead: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/growth/leads', body).then(unwrap),
  updateLeadScore: (id: string, score: number) =>
    apiV2.patch<ApiEnvelope<any>>(`/growth/leads/${id}/score`, { score }).then(unwrap),
};

// ── IRI ─────────────────────────────────────────────────────────────────────

export const iriApi = {
  listPages: () => apiV2.get<ApiEnvelope<any[]>>('/iri/pages').then(unwrap),
  getPage: (slug: string) => apiV2.get<ApiEnvelope<any>>(`/iri/pages/${slug}`).then(unwrap),
  createPage: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/iri/pages', body).then(unwrap),
  updatePage: (slug: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/iri/pages/${slug}`, body).then(unwrap),
  publishPage: (slug: string) =>
    apiV2.post<ApiEnvelope<any>>(`/iri/pages/${slug}/publish`).then(unwrap),
  deletePage: (slug: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/iri/pages/${slug}`).then(unwrap),
  getPublicPage: (slug: string) => apiV2.get<ApiEnvelope<any>>(`/iri/p/${slug}`).then(unwrap),
};

// ── Masterclass Factory ─────────────────────────────────────────────────────

export const masterclassApi = {
  generate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/masterclass-factory/generate', body).then(unwrap),
  list: () => apiV2.get<ApiEnvelope<any[]>>('/masterclass-factory').then(unwrap),
  get: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/masterclass-factory/${id}`).then(unwrap),
  analyzeDoc: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/masterclass-factory/analyze', body).then(unwrap),
};

// ── Mbolo ───────────────────────────────────────────────────────────────────

export const mboloApi = {
  listProducts: () => apiV2.get<ApiEnvelope<any[]>>('/mbolo/products').then(unwrap),
  getProduct: (id: string) => apiV2.get<ApiEnvelope<any>>(`/mbolo/products/${id}`).then(unwrap),
  createProduct: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/mbolo/products', body).then(unwrap),
  getCart: () => apiV2.get<ApiEnvelope<any[]>>('/mbolo/cart').then(unwrap),
  addToCart: (productId: string, quantity: number) =>
    apiV2.post<ApiEnvelope<any>>('/mbolo/cart', { productId, quantity }).then(unwrap),
  removeFromCart: (productId: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/mbolo/cart/${productId}`).then(unwrap),
  createOrder: () => apiV2.post<ApiEnvelope<any>>('/mbolo/orders').then(unwrap),
  listOrders: () => apiV2.get<ApiEnvelope<any[]>>('/mbolo/orders').then(unwrap),
  getOrder: (id: string) => apiV2.get<ApiEnvelope<any>>(`/mbolo/orders/${id}`).then(unwrap),
};

// ── Neuro Recall ────────────────────────────────────────────────────────────

export const neuroRecallApi = {
  createDeck: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/neuro-recall/decks', body).then(unwrap),
  listDecks: () => apiV2.get<ApiEnvelope<any[]>>('/neuro-recall/decks').then(unwrap),
  getDueCards: (deckId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/neuro-recall/decks/${deckId}/due`).then(unwrap),
  reviewCard: (cardId: string, quality: number) =>
    apiV2.post<ApiEnvelope<any>>(`/neuro-recall/cards/${cardId}/review`, { quality }).then(unwrap),
  getStats: () => apiV2.get<ApiEnvelope<any>>('/neuro-recall/stats').then(unwrap),
};

// ── Pay Engine ──────────────────────────────────────────────────────────────

export const payEngineApi = {
  getProviders: () => apiV2.get<ApiEnvelope<any[]>>('/pay-engine/providers').then(unwrap),
  enableProvider: (provider: string, enabled: boolean) =>
    apiV2.patch<ApiEnvelope<any>>(`/pay-engine/providers/${provider}`, { enabled }).then(unwrap),
  createCinetPay: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/pay-engine/pay/cinetpay', body).then(unwrap),
  getTransactions: () =>
    apiV2.get<ApiEnvelope<any[]>>('/pay-engine/transactions').then(unwrap),
};

// ── Replay ──────────────────────────────────────────────────────────────────

export const replayApi = {
  listRecordings: () => apiV2.get<ApiEnvelope<any[]>>('/replay/recordings').then(unwrap),
  getRecording: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/replay/recordings/${id}`).then(unwrap),
  getPlayback: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/replay/recordings/${id}/playback`).then(unwrap),
  listReplays: () => apiV2.get<ApiEnvelope<any[]>>('/replay').then(unwrap),
};

// ── Video Engine ────────────────────────────────────────────────────────────

export const videoEngineApi = {
  listAssets: () => apiV2.get<ApiEnvelope<any[]>>('/video-engine/assets').then(unwrap),
  getAsset: (id: string) => apiV2.get<ApiEnvelope<any>>(`/video-engine/assets/${id}`).then(unwrap),
  createAsset: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/video-engine/assets', body).then(unwrap),
  deleteAsset: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/video-engine/assets/${id}`).then(unwrap),
};

// ── Email Engine ────────────────────────────────────────────────────────────

export const emailEngineApi = {
  listTemplates: () => apiV2.get<ApiEnvelope<any[]>>('/email-engine/templates').then(unwrap),
  createTemplate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/email-engine/templates', body).then(unwrap),
  send: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/email-engine/send', body).then(unwrap),
  sendCampaign: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/email-engine/campaigns', body).then(unwrap),
  listCampaigns: () => apiV2.get<ApiEnvelope<any[]>>('/email-engine/campaigns').then(unwrap),
};

// ── SMS Engine ──────────────────────────────────────────────────────────────

export const smsEngineApi = {
  sendSms: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/sms-engine/send', body).then(unwrap),
  sendWhatsApp: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/sms-engine/whatsapp', body).then(unwrap),
  getLogs: (channel?: string) =>
    apiV2.get<ApiEnvelope<any[]>>('/sms-engine/logs', { params: { channel } }).then(unwrap),
};

// ── AI Worker ───────────────────────────────────────────────────────────────

export const aiWorkerApi = {
  enqueue: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/ai-worker/jobs', body).then(unwrap),
  listJobs: () => apiV2.get<ApiEnvelope<any[]>>('/ai-worker/jobs').then(unwrap),
  getJob: (id: string) => apiV2.get<ApiEnvelope<any>>(`/ai-worker/jobs/${id}`).then(unwrap),
};

// ── AI Utils (programme annuel, reformulation, ad-copy) ──────────────────────

export const aiUtilsApi = {
  generateAnnualProgram: (body: Record<string, unknown>, config?: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/ai-utils/annual-program/generate', body, config).then(unwrap),
  reformulate: (body: { text: string; context?: string }) =>
    apiV2.post<ApiEnvelope<any>>('/ai-utils/reformulate', body).then(unwrap),
};

// ── Cimolace Backoffice ─────────────────────────────────────────────────────

export const cimolaceBackofficeApi = {
  getStats: () => apiV2.get<ApiEnvelope<any>>('/cimolace-backoffice/stats').then(unwrap),
  listClients: () => apiV2.get<ApiEnvelope<any[]>>('/cimolace-backoffice/clients').then(unwrap),
  createClient: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/cimolace-backoffice/clients', body).then(unwrap),
  updateClient: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${id}`, body).then(unwrap),
  getClientControlPlane: (clientId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/control-plane`).then(unwrap),
  getClientDiagnostics: (clientId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/diagnostics`).then(unwrap),
  runTenantOperation: (clientId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/operations`, body).then(unwrap),
  updateAppTenantBranding: (clientId: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/app-tenant/branding`, body).then(unwrap),
  activateSchoolModelEngines: (clientId: string, body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/school-model/activate-engines`, body).then(unwrap),
  prepareSchoolModel: (clientId: string, body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/school-model/prepare`, body).then(unwrap),
  applySchoolModelQuotas: (clientId: string, body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/school-model/apply-quotas`, body).then(unwrap),
  prepareSchoolModelProviders: (clientId: string, body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/school-model/prepare-providers`, body).then(unwrap),
  getProviderDetail: (clientId: string, providerKey: string) =>
    apiV2.get<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/providers/${providerKey}`).then(unwrap),
  runProviderHealthCheck: (clientId: string, providerKey: string) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/providers/${providerKey}/health-check`, {}).then(unwrap),
  getMonitoringOverview: () =>
    apiV2.get<ApiEnvelope<any>>('/cimolace-backoffice/monitoring/overview').then(unwrap),
  runAllHealthChecks: () =>
    apiV2.post<ApiEnvelope<any>>('/cimolace-backoffice/monitoring/run-all', {}).then(unwrap),
  listSchoolProvisionings: () =>
    apiV2.get<ApiEnvelope<any[]>>('/cimolace-backoffice/provision-school').then(unwrap),
  previewProvisionSchool: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/cimolace-backoffice/provision-school/preview', body).then(unwrap),
  provisionSchoolFromTemplate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/cimolace-backoffice/provision-school', body).then(unwrap),
  updateTenantService: (clientId: string, serviceId: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/services/${serviceId}`, body).then(unwrap),
  /**
   * Admin marketplace — toggle on/off d'un service Cimolace (ex: 'twin')
   * sur un tenant. Réservé au staff Cimolace côté backend.
   */
  toggleTenantService: (tenantId: string, serviceKey: string, active: boolean) =>
    apiV2
      .post<ApiEnvelope<any>>(`/admin/tenants/${tenantId}/services/${serviceKey}/toggle`, { active })
      .then(unwrap),
  /**
   * Active l'abonnement forfaitaire d'un tenant : crée la ligne
   * billing_subscriptions active (depuis billing_plans) et arme le gating de la
   * clé tenant. Réservé au staff Cimolace côté backend.
   */
  activateTenantForfait: (tenantId: string, plan = 'zahir-forfait') =>
    apiV2
      .post<ApiEnvelope<any>>(`/admin/billing/tenants/${tenantId}/activate`, { plan })
      .then(unwrap),
  createCredentialReference: (clientId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/credentials`, body).then(unwrap),
  rotateCredential: (clientId: string, credentialId: string, body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/credentials/${credentialId}/rotate`, body).then(unwrap),
  createTenantTicket: (clientId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/tickets`, body).then(unwrap),
  createTenantInvoice: (clientId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/invoices`, body).then(unwrap),
  listSites: () => apiV2.get<ApiEnvelope<any[]>>('/cimolace-backoffice/sites').then(unwrap),
  createSite: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/cimolace-backoffice/sites', body).then(unwrap),
  updateSite: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/cimolace-backoffice/sites/${id}`, body).then(unwrap),
  deleteSite: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/cimolace-backoffice/sites/${id}`).then(unwrap),
  getClientSites: (clientId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/cimolace-backoffice/clients/${clientId}/sites`).then(unwrap),
};

// ── School Onboarding (self-service) ────────────────────────────────────────

export const schoolOnboardingApi = {
  getEngineManifest: () =>
    apiV2.get<ApiEnvelope<any>>('/school-onboarding/engines').then(unwrap),
  previewProvision: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/school-onboarding/provision/preview', body).then(unwrap),
  provision: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/school-onboarding/provision', body).then(unwrap),
  initiateCheckout: (body: { slug: string; plan: string; provider?: 'stripe' | 'chariow' | 'cinetpay' | 'pawapay'; phoneNumber?: string; pawapayProvider?: string; country?: string; success_url?: string; cancel_url?: string }) =>
    apiV2.post<ApiEnvelope<{ checkoutUrl: string; provider: string; plan: string; amountCents: number; currency: string; depositId?: string; status?: string }>>('/school-onboarding/checkout', body).then(unwrap),
};

// ── Catalog ─────────────────────────────────────────────────────────────────

export const catalogApi = {
  getEngines: () => apiV2.get<ApiEnvelope<any[]>>('/catalog/engines').then(unwrap),
  getTemplates: () => apiV2.get<ApiEnvelope<any[]>>('/catalog/templates').then(unwrap),
  getTenantServices: () => apiV2.get<ApiEnvelope<any[]>>('/catalog/tenant-services').then(unwrap),
  createTenantService: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/catalog/tenant-services', body).then(unwrap),
  applyTemplate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/catalog/apply-template', body).then(unwrap),
};

// ── Moyens de paiement (config par tenant) ──────────────────────────────────
//
// Back-office → Paramètres → Paiements. Chaque tenant configure SES clés pour
// Stripe (carte) / PawaPay (mobile money) / Chariow (produits). Les secrets
// partent EN CLAIR au backend (chiffrés AES-256-GCM côté serveur) et ne
// reviennent JAMAIS en clair : la liste renvoie un masque { set, last4 } par
// champ. Tenant résolu via le header X-Tenant-Slug (déjà injecté par l'intercepteur).

/** Provider supporté — aligné sur le CHECK SQL + le DTO backend. */
export type PaymentProvider =
  | 'stripe'
  | 'pawapay'
  | 'chariow'
  | 'paypal'
  | 'cinetpay';

/** Champ secret masqué tel que renvoyé par la liste/upsert. */
export interface MaskedSecretField {
  set: boolean;
  last4: string;
}

/** Vue masquée d'un moyen de paiement configuré (aucun secret en clair). */
export interface MaskedPaymentMethod {
  provider: PaymentProvider;
  enabled: boolean;
  mode: string | null;
  credentials: Record<string, MaskedSecretField>;
  productMap: Record<string, string> | null;
  lastTest: {
    at: string | null;
    ok: boolean | null;
    message: string | null;
  };
  updatedAt: string | null;
}

/** Corps d'upsert — credentials EN CLAIR (chiffrés côté serveur). */
export interface SavePaymentMethodBody {
  provider: PaymentProvider;
  mode?: string;
  credentials: Record<string, string>;
  productMap?: Record<string, string>;
}

export const paymentMethodsApi = {
  /** Liste des moyens configurés du tenant (credentials masqués). */
  list: () =>
    apiV2
      .get<ApiEnvelope<{ providers: MaskedPaymentMethod[] }>>('/billing/payment-methods')
      .then(unwrap),
  /** Upsert d'un moyen : chiffre les credentials → enabled=true → renvoie le masque. */
  save: (body: SavePaymentMethodBody) =>
    apiV2
      .post<ApiEnvelope<MaskedPaymentMethod>>('/billing/payment-methods', body)
      .then(unwrap),
  /** Test de connexion RÉEL côté serveur ; met à jour last_test_* et renvoie {ok, message}. */
  test: (provider: PaymentProvider) =>
    apiV2
      .post<ApiEnvelope<{ ok: boolean; message: string }>>(
        `/billing/payment-methods/${provider}/test`,
        {},
      )
      .then(unwrap),
  /** Active / désactive un moyen. */
  toggle: (provider: PaymentProvider, enabled: boolean) =>
    apiV2
      .patch<ApiEnvelope<MaskedPaymentMethod>>(`/billing/payment-methods/${provider}`, {
        enabled,
      })
      .then(unwrap),
  /** Supprime la config d'un moyen. */
  remove: (provider: PaymentProvider) =>
    apiV2
      .delete<ApiEnvelope<{ ok: true; provider: PaymentProvider }>>(
        `/billing/payment-methods/${provider}`,
      )
      .then(unwrap),
};

// ── Catalogue & tarifs (services + prix par tenant) ─────────────────────────
//
// Back-office → Catalogue & tarifs. Chaque tenant déclare SES services
// vendables (cycles école, temple, consultations, mentorat, custom) avec leur
// prix. Source de vérité pour la vitrine, le hub et le checkout élève. CRUD via
// /billing/catalog. Tenant résolu par le header X-Tenant-Slug (intercepteur).
//
// NB : nommé `billingCatalogApi` car `catalogApi` (engines/templates) existe
// déjà plus haut. Les méthodes gardent la forme list/create/update/remove.

/** Catégorie de service — alignée sur le CHECK SQL + le DTO backend. */
export type ServiceCategory =
  | 'cycle'
  | 'temple'
  | 'consultation'
  | 'mentorat'
  | 'custom';

/** Service du catalogue tel que renvoyé/écrit (camelCase). */
export interface CatalogService {
  key: string;
  category: ServiceCategory;
  label: string;
  tagline: string | null;
  description: string | null;
  priceCents: number;
  currency: string;
  billingCycle: string; // 'month' | 'one_time' | 'year' (libre côté backend)
  isActive: boolean;
  sortOrder: number;
  features: string[] | null;
  metadata: Record<string, unknown> | null;
}

/** Corps de création — `key` peut être dérivé du label côté serveur. */
export type CreateCatalogServiceBody = Partial<CatalogService> &
  Pick<CatalogService, 'category' | 'label'>;

export const billingCatalogApi = {
  /** Liste des services du tenant (tous statuts confondus). */
  list: () =>
    apiV2.get<ApiEnvelope<CatalogService[]>>('/billing/catalog').then(unwrap),
  /** Crée un service. */
  create: (body: CreateCatalogServiceBody) =>
    apiV2.post<ApiEnvelope<CatalogService>>('/billing/catalog', body).then(unwrap),
  /** Met à jour un service (PATCH partiel : prix, statut, libellés…). */
  update: (key: string, body: Partial<CatalogService>) =>
    apiV2
      .patch<ApiEnvelope<CatalogService>>(`/billing/catalog/${key}`, body)
      .then(unwrap),
  /** Supprime un service. */
  remove: (key: string) =>
    apiV2
      .delete<ApiEnvelope<{ ok: true; key: string }>>(`/billing/catalog/${key}`)
      .then(unwrap),
};
