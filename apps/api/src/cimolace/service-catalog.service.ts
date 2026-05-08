import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

// All available engines across 8 categories
export const ENGINE_CATALOG = [
  { key: "liri_brain", name: "LIRI Brain", cat: "IA", desc: "IA conversationnelle SSE streaming", free: true },
  { key: "liri_masterclass", name: "Masterclass Factory", cat: "IA", desc: "Texte → formation complète", free: false },
  { key: "liri_smartboard", name: "SmartBoard", cat: "IA", desc: "Génération slides IA", free: false },
  { key: "liri_neuro_recall", name: "Neuro Recall", cat: "IA", desc: "Rappels mnémotechniques", free: false },
  { key: "liri_live", name: "LIRI Live", cat: "Live", desc: "Broadcast LiveKit", free: false },
  { key: "liri_replay", name: "Replay VOD", cat: "Live", desc: "Mux/Cloudflare Stream", free: false },
  { key: "studio_creator", name: "Studio Créateur", cat: "Live", desc: "Production live avancée", free: false },
  { key: "pay_engine", name: "Pay Engine", cat: "Paiement", desc: "Orchestrateur paiement universel", free: true },
  { key: "stripe_connect", name: "Stripe Connect", cat: "Paiement", desc: "Compte Stripe par tenant", free: false },
  { key: "cinetpay", name: "CinetPay", cat: "Paiement", desc: "Mobile Money Afrique", free: false },
  { key: "email_engine", name: "Email Engine", cat: "Communication", desc: "Transactionnel + campagnes", free: true },
  { key: "sms_engine", name: "SMS Engine", cat: "Communication", desc: "Twilio/Orange/MTN", free: false },
  { key: "whatsapp_engine", name: "WhatsApp Engine", cat: "Communication", desc: "Meta API", free: false },
  { key: "chat_engine", name: "Chat Engine", cat: "Communication", desc: "Messagerie privée + groupes", free: true },
  { key: "course_builder", name: "Course Builder", cat: "Contenu", desc: "Constructeur de formation", free: false },
  { key: "forum", name: "Forum", cat: "Contenu", desc: "Discussions + modération", free: true },
  { key: "marketing_creator", name: "Marketing Creator", cat: "Contenu", desc: "Promos, popups, bannières", free: false },
  { key: "calendar", name: "Calendar", cat: "Agenda", desc: "Disponibilités + RDV", free: false },
  { key: "med_ehr", name: "EHR", cat: "Santé", desc: "Dossiers patients", free: false },
  { key: "med_notes", name: "Notes SOAP", cat: "Santé", desc: "Consultation notes", free: false },
  { key: "med_prescriptions", name: "Prescriptions", cat: "Santé", desc: "Ordonnances numériques", free: false },
  { key: "med_forms", name: "Medical Forms", cat: "Santé", desc: "Formulaires médicaux", free: false },
  { key: "med_health", name: "Health Tracking", cat: "Santé", desc: "Suivi habitudes", free: false },
  { key: "med_programs", name: "Care Programs", cat: "Santé", desc: "Programmes de soins", free: false },
  { key: "med_charting", name: "AI Charting", cat: "Santé", desc: "Transcription + Claude", free: false },
  { key: "gdpr_engine", name: "GDPR Engine", cat: "Santé", desc: "Conformité RGPD", free: true },
  { key: "workflow_engine", name: "Workflow Engine", cat: "Infra", desc: "Automation no-code", free: true },
  { key: "webhook_engine", name: "Webhook Engine", cat: "Infra", desc: "HMAC sortants", free: true },
  { key: "activity_stream", name: "Activity Stream", cat: "Infra", desc: "Journal global", free: true },
  { key: "template_engine", name: "Template Engine", cat: "Infra", desc: "Templates multi-canaux", free: true },
  { key: "notif_engine", name: "Notification Engine", cat: "Infra", desc: "In-app + push", free: true },
];

// Infrastructure templates
export const INFRA_TEMPLATES = [
  { type: "school", name: "École en ligne", icon: "🏫", planDefault: "starter", engines: ["liri_smartboard","liri_live","liri_replay","marketing_creator","calendar"] },
  { type: "medos", name: "MedOS — Santé", icon: "🏥", planDefault: "solo", engines: ["med_ehr","med_notes","med_prescriptions","med_forms","med_health","med_programs","med_charting","gdpr_engine"] },
  { type: "wellness", name: "Bien-être & Coaching", icon: "🌿", planDefault: "starter", engines: ["med_programs","med_health","calendar","chat_engine","forum"] },
  { type: "creator", name: "Créateur de contenu", icon: "🎬", planDefault: "starter", engines: ["studio_creator","liri_live","liri_replay","pay_engine","marketing_creator"] },
  { type: "mbolo", name: "Boutique Mbolo", icon: "🛒", planDefault: "starter", engines: ["pay_engine","cinetpay","sms_engine","whatsapp_engine","notif_engine"] },
  { type: "temple", name: "Temple & Spiritualité", icon: "🕌", planDefault: "starter", engines: ["liri_live","calendar","forum","pay_engine","chat_engine"] },
  { type: "community", name: "Communauté", icon: "👥", planDefault: "starter", engines: ["forum","chat_engine","calendar","pay_engine","notif_engine"] },
];

@Injectable()
export class ServiceCatalogService {
  constructor(private auth: AuthService) {}

  getCatalog() {
    return ENGINE_CATALOG;
  }

  getTemplates() {
    return INFRA_TEMPLATES;
  }

  async getTenantServices(tenantId: string) {
    const supabase = this.auth.getClient();
    const { data } = await supabase.from("tenant_services").select("service_key, active").eq("tenant_id", tenantId);
    return data ?? [];
  }

  async toggleService(tenantId: string, serviceKey: string, active: boolean) {
    const supabase = this.auth.getClient();
    const { data } = await supabase.from("tenant_services").upsert({ tenant_id: tenantId, service_key: serviceKey, active }, { onConflict: "tenant_id,service_key" }).select().single();
    return data;
  }
}
