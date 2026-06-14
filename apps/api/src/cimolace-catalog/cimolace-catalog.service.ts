import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type { InfraType } from './dto/apply-template.dto';
import type { UpdateTenantServiceDto } from './dto/update-tenant-service.dto';

// ---------------------------------------------------------------------------
// Catalogue statique — les moteurs / engines Cimolace
// ---------------------------------------------------------------------------

export type EngineCategory =
  | 'ia'
  | 'live_video'
  | 'payment'
  | 'communication'
  | 'content'
  | 'calendar'
  | 'medos'
  | 'mbolo'
  | 'infrastructure';

export interface EngineEntry {
  key: string;
  label: string;
  description: string;
  category: EngineCategory;
}

export const ENGINE_CATALOG: EngineEntry[] = [
  // IA
  {
    key: 'liri_brain',
    label: 'LIRI Brain',
    description: 'Moteur IA central de raisonnement pédagogique',
    category: 'ia',
  },
  {
    key: 'liri_masterclass',
    label: 'LIRI Masterclass',
    description: 'Génération de masterclass complètes par IA',
    category: 'ia',
  },
  {
    key: 'liri_smartboard',
    label: 'LIRI SmartBoard',
    description: 'Tableau interactif augmenté par IA',
    category: 'ia',
  },
  {
    key: 'liri_neuro_recall',
    label: 'LIRI Neuro Recall',
    description: 'Répétition espacée et rappel mémoriel',
    category: 'ia',
  },
  // Live / Vidéo
  {
    key: 'liri_live',
    label: 'LIRI Live',
    description: 'Diffusion live interactive',
    category: 'live_video',
  },
  {
    key: 'liri_replay',
    label: 'LIRI Replay',
    description: 'Replay enrichi des sessions live',
    category: 'live_video',
  },
  {
    key: 'studio_creator',
    label: 'Studio Creator',
    description: 'Studio de création de contenu vidéo',
    category: 'live_video',
  },
  // Paiement
  {
    key: 'pay_engine',
    label: 'Pay Engine',
    description: 'Moteur de paiement unifié',
    category: 'payment',
  },
  {
    key: 'stripe_connect',
    label: 'Stripe Connect',
    description: 'Intégration Stripe Connect marketplace',
    category: 'payment',
  },
  {
    key: 'cinetpay',
    label: 'CinetPay',
    description: 'Paiement mobile money Afrique (CinetPay)',
    category: 'payment',
  },
  // Communication
  {
    key: 'email_engine',
    label: 'Email Engine',
    description: 'Moteur d\'envoi d\'emails transactionnels',
    category: 'communication',
  },
  {
    key: 'sms_engine',
    label: 'SMS Engine',
    description: 'Moteur d\'envoi de SMS',
    category: 'communication',
  },
  {
    key: 'whatsapp_engine',
    label: 'WhatsApp Engine',
    description: 'Moteur d\'envoi de messages WhatsApp',
    category: 'communication',
  },
  {
    key: 'chat_engine',
    label: 'Chat Engine',
    description: 'Messagerie instantanée intégrée',
    category: 'communication',
  },
  // Contenu
  {
    key: 'course_builder',
    label: 'Course Builder',
    description: 'Constructeur de formations en ligne',
    category: 'content',
  },
  {
    key: 'forum',
    label: 'Forum',
    description: 'Forum de discussion communautaire',
    category: 'content',
  },
  {
    key: 'marketing_creator',
    label: 'Marketing Creator',
    description: 'Outils marketing et growth',
    category: 'content',
  },
  // Agenda
  {
    key: 'calendar',
    label: 'Calendar',
    description: 'Calendrier et planification',
    category: 'calendar',
  },
  // MedOS
  {
    key: 'med_ehr',
    label: 'Med EHR',
    description: 'Dossier patient électronique',
    category: 'medos',
  },
  {
    key: 'med_notes',
    label: 'Med Notes',
    description: 'Notes de consultation SOAP',
    category: 'medos',
  },
  {
    key: 'med_prescriptions',
    label: 'Med Prescriptions',
    description: 'Gestion des prescriptions médicales',
    category: 'medos',
  },
  {
    key: 'med_forms',
    label: 'Med Forms',
    description: 'Formulaires médicaux personnalisables',
    category: 'medos',
  },
  {
    key: 'med_health',
    label: 'Med Health',
    description: 'Suivi santé et habitudes de vie',
    category: 'medos',
  },
  {
    key: 'med_programs',
    label: 'Med Programs',
    description: 'Programmes de soin et parcours patient',
    category: 'medos',
  },
  {
    key: 'med_charting',
    label: 'Med Charting',
    description: 'Charting médical assisté par IA',
    category: 'medos',
  },
  {
    key: 'gdpr_engine',
    label: 'GDPR Engine',
    description: 'Conformité RGPD et données de santé',
    category: 'medos',
  },
  // Mbolo
  {
    key: 'mbolo_catalog',
    label: 'Mbolo Catalog',
    description: 'Catalogue produits e-commerce',
    category: 'mbolo',
  },
  {
    key: 'mbolo_cart',
    label: 'Mbolo Cart',
    description: 'Panier d\'achat',
    category: 'mbolo',
  },
  {
    key: 'mbolo_orders',
    label: 'Mbolo Orders',
    description: 'Gestion des commandes',
    category: 'mbolo',
  },
  {
    key: 'mbolo_inventory',
    label: 'Mbolo Inventory',
    description: 'Gestion des stocks',
    category: 'mbolo',
  },
  {
    key: 'mbolo_storefront',
    label: 'Mbolo Storefront',
    description: 'Vitrine e-commerce personnalisable',
    category: 'mbolo',
  },
  {
    key: 'mbolo_admin',
    label: 'Mbolo Admin',
    description: 'Back-office marchand',
    category: 'mbolo',
  },
  // Infrastructure
  {
    key: 'workflow_engine',
    label: 'Workflow Engine',
    description: 'Moteur de workflows et automatisations',
    category: 'infrastructure',
  },
  {
    key: 'webhook_engine',
    label: 'Webhook Engine',
    description: 'Gestion des webhooks sortants',
    category: 'infrastructure',
  },
  {
    key: 'activity_stream',
    label: 'Activity Stream',
    description: 'Fil d\'activité et audit trail',
    category: 'infrastructure',
  },
  {
    key: 'template_engine',
    label: 'Template Engine',
    description: 'Moteur de templates (emails, pages, docs)',
    category: 'infrastructure',
  },
  {
    key: 'notif_engine',
    label: 'Notification Engine',
    description: 'Moteur de notifications multi-canal',
    category: 'infrastructure',
  },
];

// ---------------------------------------------------------------------------
// Templates d'infrastructure
// ---------------------------------------------------------------------------

export interface InfraTemplate {
  type: InfraType;
  label: string;
  description: string;
  engines: string[];
}

export const INFRA_TEMPLATES: InfraTemplate[] = [
  {
    type: 'school',
    label: 'École / ISNA',
    description: 'Formation en ligne, lives, replay, studio, marketing, calendrier, paiement',
    // Aligné sur le pack école canonique (school-engine-manifest.ts) : 6 core + 5 recommended.
    // Masterclass (liri_masterclass) reste un addon non activé par défaut.
    engines: [
      // core
      'liri_smartboard',
      'liri_live',
      'liri_replay',
      'marketing_creator',
      'calendar',
      'course_builder',
      // recommended
      'studio_creator',
      'liri_neuro_recall',
      'pay_engine',
      'chat_engine',
      'notif_engine',
    ],
  },
  {
    type: 'medos',
    label: 'MedOS — Santé',
    description: 'Dossier patient, consultations, prescriptions, programmes de soin',
    engines: [
      'med_ehr',
      'med_notes',
      'med_prescriptions',
      'med_forms',
      'med_health',
      'med_programs',
      'med_charting',
      'gdpr_engine',
    ],
  },
  {
    type: 'mbolo',
    label: 'Mbolo / VirtuelMbolo',
    description: 'E-commerce, mobile money, notifications',
    engines: [
      'pay_engine',
      'cinetpay',
      'sms_engine',
      'whatsapp_engine',
      'notif_engine',
      'mbolo_catalog',
      'mbolo_cart',
      'mbolo_orders',
      'mbolo_inventory',
      'mbolo_storefront',
      'mbolo_admin',
    ],
  },
  {
    type: 'wellness',
    label: 'Wellness / Bien-être',
    description: 'Programmes bien-être, suivi santé, calendrier, chat, forum',
    engines: [
      'med_programs',
      'med_health',
      'calendar',
      'chat_engine',
      'forum',
    ],
  },
  {
    type: 'creator',
    label: 'Creator / Créateur',
    description: 'Studio, live, replay, paiement, marketing',
    engines: [
      'studio_creator',
      'liri_live',
      'liri_replay',
      'pay_engine',
      'marketing_creator',
    ],
  },
  {
    type: 'temple',
    label: 'Temple / Spiritualité',
    description: 'Live, calendrier, forum, paiement, chat',
    engines: [
      'liri_live',
      'calendar',
      'forum',
      'pay_engine',
      'chat_engine',
    ],
  },
  {
    type: 'community',
    label: 'Community / Communauté',
    description: 'Forum, chat, calendrier, paiement, notifications',
    engines: [
      'forum',
      'chat_engine',
      'calendar',
      'pay_engine',
      'notif_engine',
    ],
  },
];

// Types DB
type TenantServiceRow = {
  id: string;
  tenant_id: string;
  service_key: string;
  active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const STAFF_ROLES = ['owner', 'admin'];

@Injectable()
export class CimolaceCatalogService {
  private readonly logger = new Logger(CimolaceCatalogService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // -----------------------------------------------------------------------
  // Lecture catalogue (public pour tout membre du tenant)
  // -----------------------------------------------------------------------

  getEngines(): EngineEntry[] {
    return ENGINE_CATALOG;
  }

  getTemplates(): InfraTemplate[] {
    return INFRA_TEMPLATES;
  }

  // -----------------------------------------------------------------------
  // Services actifs du tenant
  // -----------------------------------------------------------------------

  async getTenantServices(tenantId: string): Promise<TenantServiceRow[]> {
    const { data, error } = await this.supabase.client
      .from('tenant_services')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('service_key', { ascending: true });

    if (error) {
      this.logger.error('getTenantServices', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as unknown as TenantServiceRow[];
  }

  // -----------------------------------------------------------------------
  // Activer / désactiver un service (owner/admin seulement)
  // -----------------------------------------------------------------------

  async upsertTenantService(
    tenant: TenantContext,
    dto: UpdateTenantServiceDto,
  ): Promise<TenantServiceRow> {
    if (!STAFF_ROLES.includes(tenant.userRole)) {
      throw new ForbiddenException(
        'Seuls owner et admin peuvent gérer les services du tenant',
      );
    }

    // Vérifier que le service_key est dans le catalogue
    const known = ENGINE_CATALOG.find((e) => e.key === dto.service_key);
    if (!known) {
      throw new BadRequestException(
        `Service "${dto.service_key}" inconnu dans le catalogue`,
      );
    }

    const { data, error } = await this.supabase.client
      .from('tenant_services')
      .upsert(
        {
          tenant_id: tenant.id,
          service_key: dto.service_key,
          active: dto.active,
          settings: (dto.settings ?? {}) as any,
        },
        { onConflict: 'tenant_id,service_key' },
      )
      .select('*')
      .single();

    if (error) {
      this.logger.error('upsertTenantService', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return data as unknown as TenantServiceRow;
  }

  // -----------------------------------------------------------------------
  // Appliquer un template d'infrastructure
  // -----------------------------------------------------------------------

  async applyTemplate(
    tenant: TenantContext,
    infraType: InfraType,
  ): Promise<{
    infrastructure_type: string;
    services: TenantServiceRow[];
  }> {
    if (!STAFF_ROLES.includes(tenant.userRole)) {
      throw new ForbiddenException(
        'Seuls owner et admin peuvent changer l\'infrastructure du tenant',
      );
    }

    const template = INFRA_TEMPLATES.find((t) => t.type === infraType);
    if (!template) {
      throw new BadRequestException(
        `Template "${infraType}" introuvable`,
      );
    }

    // 1. Upsert tous les services du template — si un seul échoue, on throw
    const results: TenantServiceRow[] = [];
    for (const key of template.engines) {
      const { data, error } = await this.supabase.client
        .from('tenant_services')
        .upsert(
          {
            tenant_id: tenant.id,
            service_key: key,
            active: true,
            settings: {} as any,
          },
          { onConflict: 'tenant_id,service_key' },
        )
        .select('*')
        .single();

      if (error) {
        this.logger.error(
          `applyTemplate: échec upsert service "${key}" pour tenant ${tenant.id}`,
          error.message,
        );
        throw new InternalServerErrorException(
          `Échec d'activation du service "${key}" — le template n'a pas été appliqué`,
        );
      }
      results.push(data as unknown as TenantServiceRow);
    }

    // 2. Tous les services sont OK → mettre à jour infrastructure_type
    const { error: infraErr } = await this.supabase.client
      .from('tenants')
      .update({ infrastructure_type: infraType })
      .eq('id', tenant.id);

    if (infraErr) {
      this.logger.error(
        'applyTemplate: échec update infrastructure_type',
        infraErr.message,
      );
      throw new InternalServerErrorException(
        'Échec de mise à jour de l\'infrastructure — les services ont été activés mais le type d\'infrastructure n\'a pas pu être enregistré',
      );
    }

    return { infrastructure_type: infraType, services: results };
  }
}
