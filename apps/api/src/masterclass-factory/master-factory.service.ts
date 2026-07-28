import { Injectable } from '@nestjs/common';
import type { SourceType } from './pivot.types';
import { ComprehensionService } from './comprehension.service';
import { CourseJobService } from './course-job.service';
import { RenderPivotService } from './render-pivot.service';
import { SourceAdaptersService } from './source-adapters.service';

/**
 * MASTER FACTORY — façade d'orchestration.
 *
 * Ce service ne remplace pas les moteurs existants : il devient leur porte
 * d'entrée officielle. Les anciens endpoints peuvent continuer à vivre, mais
 * ils doivent progressivement appeler cette façade au lieu de relire une source
 * et de refaire leur propre intelligence.
 *
 * Chaîne cible :
 *   Source → Comprehension → Master Script → SmartBoard → Live / Cours / Replay
 */
@Injectable()
export class MasterFactoryService {
  constructor(
    private readonly sources: SourceAdaptersService,
    private readonly comprehension: ComprehensionService,
    private readonly courseJobs: CourseJobService,
    private readonly renderPivot: RenderPivotService,
  ) {}

  /** Inventaire des sources prêtes ou à préparer pour l'atelier unifié. */
  listSources(tenantId: string, sourceType: SourceType) {
    return this.sources.listSources(tenantId, sourceType);
  }

  /**
   * Étape 1 : comprendre une source. C'est le seul endroit autorisé à produire
   * le fond invariant (`kind = comprehension`).
   */
  understandSource(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    return this.comprehension.build(tenantId, sourceType, sourceId, opts);
  }

  /**
   * Étape 2-A : demander un cours écrit/parcours. Le worker actuel reste le
   * producteur réel, mais l'appel passe par la façade pour figer la direction.
   */
  requestWrittenCourse(
    tenantId: string,
    userId: string,
    sourceType: SourceType,
    sourceId: string,
    opts: { force?: boolean } = {},
  ) {
    return this.courseJobs.requestAny(tenantId, userId, sourceType, sourceId, opts);
  }

  /** État des formes/rendus déjà disponibles pour une source. */
  status(tenantId: string, sourceType: SourceType, sourceId: string) {
    return this.renderPivot.status(tenantId, sourceType, sourceId);
  }

  /** Rendu PDF gratuit depuis le pivot écrit, sans nouveau coût IA. */
  renderPdf(tenantId: string, sourceType: SourceType, sourceId: string) {
    return this.renderPivot.renderPdf(tenantId, sourceType, sourceId);
  }
}
