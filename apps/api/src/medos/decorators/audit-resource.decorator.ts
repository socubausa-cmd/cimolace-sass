import { SetMetadata } from '@nestjs/common';

export const AUDIT_RESOURCE_KEY = 'medos:audit-resource';

export type AuditResourceType =
  | 'patient'
  | 'note'
  | 'form'
  | 'form_response'
  | 'health_entry'
  | 'prescription'
  | 'program'
  | 'charting_job'
  | 'appointment'
  // Bio Digital Twin (v2)
  | 'twin_state'
  | 'twin_biomarkers'
  | 'twin_lab_document'
  | 'twin_extraction'
  | 'twin_organ_assistant'
  | 'twin_analysis';

export type AuditAction =
  | 'create'
  | 'read'
  | 'list'
  | 'update'
  | 'delete'
  | 'sign'
  | 'share'
  | 'transcribe'
  | 'generate';

export type AuditResourceConfig = {
  /** Type de ressource médicale concernée */
  resource: AuditResourceType;
  /** Action métier (create/read/sign/share/...) — peut être déduite du verbe HTTP si absent */
  action?: AuditAction;
  /** Nom du param de route contenant l'UUID de la ressource (ex: 'id', 'patientId'). null = collection */
  idParam?: string | null;
};

/**
 * Marque un endpoint pour audit logging MEDOS automatique.
 *
 * Le MedAuditInterceptor lit cette métadonnée et écrit une entrée dans
 * `med_audit_log` après chaque appel réussi.
 *
 * @example
 * ```ts
 * @Get(':id')
 * @AuditResource({ resource: 'patient', action: 'read', idParam: 'id' })
 * getPatient(@Param('id') id: string) { ... }
 * ```
 */
export const AuditResource = (config: AuditResourceConfig) =>
  SetMetadata(AUDIT_RESOURCE_KEY, config);
