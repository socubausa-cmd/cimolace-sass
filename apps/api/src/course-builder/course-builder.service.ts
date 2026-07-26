import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SupabaseService } from '../supabase/supabase.service';
import { AiUtilsService } from '../ai-utils/ai-utils.service';
import { TopicsService } from '../messaging/topics.service';
import { cycleCan, resolveMemberCycle } from '../billing/member-tier';
import type { TenantContext } from '../tenant/tenant.types';

/** Bucket PRIVÉ des captures de tableau (cf. migration 20260715160000). */
const SMARTBOARD_CANVAS_BUCKET = 'smartboard-canvas';
/** Bucket des vidéos sources de cours (privé lui aussi). */
const VIDEOS_BUCKET = 'videos';
/**
 * Durée de vie de l'URL présignée du MP4 rendu (R2 privé).
 *
 * ALIGNÉE sur celle de la vidéo SOURCE (CoursesService.signCourseVideoUrl signe 3600 s).
 * Elle était à 6 h : le MONTAGE — c'est-à-dire le cours ENTIER — restait donc
 * téléchargeable et repartageable HORS application six fois plus longtemps que
 * l'original qu'il contient. Un lien de partage a la valeur du contenu qu'il ouvre.
 */
const RENDER_OUTPUT_SIGN_TTL_SECONDS = 3600;
/**
 * Durée d'affichage d'une slide quand RIEN ne permet de la calculer (ni chapitre
 * exploitable, ni durée de source connue). Dernier recours volontairement lisible :
 * une slide d'1 s défile trop vite pour être lue par la classe.
 */
const DEFAULT_SLIDE_SECONDS = 4;
/** Rôles considérés comme « encadrement » — même liste que CoursesService. */
const STAFF_ROLES = ['owner', 'admin', 'teacher', 'creator', 'secretariat'];

@Injectable()
export class CourseBuilderService {
  private readonly logger = new Logger(CourseBuilderService.name);
  constructor(
    private readonly supabase: SupabaseService,
    private readonly aiUtils: AiUtilsService,
    private readonly config: ConfigService,
    private readonly topics: TopicsService,
  ) {}

  async createPipeline(tenantId: string, name: string, sourceText: string) {
    const { data } = await (this.supabase.client as any).from('course_pipelines').insert({
      tenant_id: tenantId, name, source_text: sourceText, status: 'pending',
    }).select('*').single();
    return data;
  }

  async listPipelines(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('course_pipelines').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async autoSegment(tenantId: string, pipelineId: string) {
    const { data: pipeline } = await (this.supabase.client as any).from('course_pipelines').select('*').eq('id', pipelineId).single();
    if (!pipeline) return { error: 'Pipeline introuvable' };
    const segments = this.naiveSegment(pipeline.source_text);
    for (const seg of segments) {
      await (this.supabase.client as any).from('pipeline_segments').insert({ tenant_id: tenantId, pipeline_id: pipelineId, title: seg.title, content: seg.content, order_index: seg.index });
    }
    await (this.supabase.client as any).from('course_pipelines').update({ status: 'segmented', segment_count: segments.length }).eq('id', pipelineId);
    return { segments: segments.length };
  }

  async listSegments(tenantId: string, pipelineId: string) {
    const { data } = await (this.supabase.client as any).from('pipeline_segments').select('*').eq('pipeline_id', pipelineId).order('order_index');
    return data ?? [];
  }

  async enqueueRender(tenantId: string, pipelineId: string) {
    await (this.supabase.client as any).from('course_pipelines').update({ status: 'rendering' }).eq('id', pipelineId);
    await (this.supabase.client as any).from('render_jobs').insert({ tenant_id: tenantId, pipeline_id: pipelineId, status: 'queued' });
    return { status: 'queued' };
  }

  async getRenderJobs(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('render_jobs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async getRenderStatus(tenantId: string, jobId: string) {
    const { data } = await (this.supabase.client as any).from('render_jobs').select('*').eq('id', jobId).eq('tenant_id', tenantId).single();
    return data ?? { status: 'unknown' };
  }

  // ── Segment AI (« tableau IA » par chapitre — classe numérique) ────────────

  /**
   * Génère le contenu IA d'un (ou tous les) chapitre(s) : découpe le transcript
   * sur la fenêtre temporelle du chapitre, reformule via AiUtilsService, et
   * upsert dans course_segment_ai_content. Renvoie { rows } (le front fusionne
   * ces lignes même si la table manque — dégradation gracieuse).
   * Remplace l'ancien edge /.netlify/functions/course-builder-segment-ai-generate (404).
   */
  async generateSegmentAi(
    tenantId: string,
    userId: string,
    dto: { contentId: string; segmentIndex?: number; applyAll?: boolean; mode?: string; chapters?: any[]; transcript?: any[] },
  ) {
    const chapters: any[] = Array.isArray(dto.chapters) ? dto.chapters : [];
    const transcript: any[] = Array.isArray(dto.transcript) ? dto.transcript : [];
    const targets = dto.applyAll ? chapters.map((_c, i) => i) : [Number(dto.segmentIndex) || 0];
    const rows: any[] = [];

    for (const idx of targets) {
      const ch = chapters[idx];
      if (!ch) continue;
      const start = Number(ch.startSeconds) || 0;
      const end = Number(ch.endSeconds) || Number.MAX_SAFE_INTEGER;
      const text = transcript
        .filter((l) => { const t = Number(l?.timeSeconds); return t >= start && t < end; })
        .map((l) => String(l?.text ?? ''))
        .join(' ')
        .trim()
        .slice(0, 4000);

      let reformulation = '';
      if (text) {
        try {
          const r: any = await this.aiUtils.reformulate(tenantId, {
            text,
            context: 'Reformulation pédagogique synthétique pour le tableau d’un segment de cours (classe numérique).',
          });
          reformulation = String(r?.result ?? '').trim();
        } catch (e) {
          this.logger.warn(`reformulate échec (segment ${idx}): ${String(e)}`);
        }
      }

      const row: Record<string, any> = {
        tenant_id: tenantId,
        content_id: dto.contentId,
        segment_index: idx,
        status: 'draft',
        reformulation_text: reformulation || null,
        created_by: userId || null,
      };
      try {
        const { data } = await (this.supabase.client as any)
          .from('course_segment_ai_content')
          .upsert(row, { onConflict: 'content_id,segment_index' })
          .select('*')
          .single();
        rows.push(data ?? row);
      } catch {
        rows.push(row);
      }
    }
    return { rows };
  }

  async listSegmentAi(tenantId: string, contentId: string) {
    const { data } = await (this.supabase.client as any)
      .from('course_segment_ai_content')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('content_id', contentId)
      .order('segment_index');
    return { rows: data ?? [] };
  }

  /** Approuve / rejette le contenu IA d'un segment. Remplace l'edge course-builder-segment-ai-approve (404). */
  async approveSegmentAi(tenantId: string, dto: { contentId: string; segmentIndex?: number; approved?: boolean }) {
    const status = dto.approved === false ? 'rejected' : 'approved';
    const { data } = await (this.supabase.client as any)
      .from('course_segment_ai_content')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('content_id', dto.contentId)
      .eq('segment_index', Number(dto.segmentIndex) || 0)
      .select('*')
      .single();
    return { ok: true, status, row: data ?? null };
  }

  // ── Versions / snapshots post-production ───────────────────────────────────

  /** Enregistre un snapshot de l'état post-prod. Remplace l'edge postprod-version-save (404). */
  async saveVersion(
    tenant: TenantContext,
    userId: string,
    dto: { contentId: string; snapshotLabel?: string; snapshot?: any },
  ) {
    // CLOISON TENANT — une version post-prod est une TRACE DE PROPRIÉTÉ : c'est elle
    // que `resolveContentTenantId` consulte pour un contenu standalone. La laisser
    // s'écrire sur le contenu d'un autre espace permettrait de FABRIQUER cette trace
    // (puis de faire rendre, donc de télécharger, la vidéo d'autrui). Fail-soft quand
    // le propriétaire est inconnu : la toute première version d'un contenu standalone
    // doit rester possible, c'est justement elle qui établit la propriété.
    if (dto.contentId) {
      const content = await this.loadFormationContent(dto.contentId);
      const ownerTenantId = content
        ? await this.resolveContentTenantId(content.day_id, dto.contentId, content.tenant_id)
        : null;
      if (ownerTenantId && ownerTenantId !== tenant.id) {
        this.logger.warn(
          `postprod-version-save CROSS-TENANT refusé: content ${dto.contentId} (tenant ${ownerTenantId}) demandé par ${tenant.id}`,
        );
        throw new ForbiddenException('Ce contenu appartient à un autre espace.');
      }
    }

    const { data } = await (this.supabase.client as any)
      .from('course_postprod_versions')
      .insert({
        tenant_id: tenant.id,
        content_id: dto.contentId,
        label: dto.snapshotLabel ?? null,
        snapshot: dto.snapshot ?? {},
        created_by: userId || null,
      })
      .select('*')
      .single();

    // LOT 3(b) — la post-prod du cours est finalisée (snapshot sauvegardé) : on
    // alimente (idempotent) le Sujet de forum du COURS porteur (conversations
    // kind='topic', context_type='course'). Effet de bord NON BLOQUANT : un échec
    // (chaîne studio rompue, contenu non rattaché à un cours, etc.) ne doit jamais
    // faire échouer la sauvegarde post-prod — on log et on continue. Réutilise le
    // get-or-create idempotent de TopicsService (aucun doublon sur re-save).
    if (dto.contentId) {
      try {
        const res = await this.topics.publishCourseContentTopic(
          tenant,
          userId,
          dto.contentId,
        );
        if (res.skipped) {
          this.logger.debug(
            `post-prod topic non publié (content ${dto.contentId}): ${res.skipped}`,
          );
        }
      } catch (e) {
        this.logger.warn(
          `publishCourseContentTopic échec (content ${dto.contentId}): ${String(e)}`,
        );
      }
    }

    return { ok: true, version: data ?? null };
  }

  async listVersions(tenantId: string, contentId: string) {
    const { data } = await (this.supabase.client as any)
      .from('course_postprod_versions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('content_id', contentId)
      .order('created_at', { ascending: false });
    return { rows: data ?? [] };
  }

  /** Restaure un snapshot : réécrit formation_day_contents.data avec l'état sauvegardé. */
  async restoreVersion(tenantId: string, dto: { versionId: string }) {
    const { data: v } = await (this.supabase.client as any)
      .from('course_postprod_versions')
      .select('*')
      .eq('id', dto.versionId)
      .eq('tenant_id', tenantId)
      .single();
    if (!v) return { ok: false, error: 'Version introuvable' };
    const snap = v.snapshot || {};
    const { data: content } = await (this.supabase.client as any)
      .from('formation_day_contents')
      .select('data')
      .eq('id', v.content_id)
      .single();
    const newData = {
      ...((content && content.data) || {}),
      ...(snap.transcript !== undefined ? { transcript: snap.transcript } : {}),
      ...(snap.chapters !== undefined ? { chapters: snap.chapters } : {}),
      ...(snap.timestamps !== undefined ? { timestamps: snap.timestamps } : {}),
      ...(snap.dataPatch && typeof snap.dataPatch === 'object' ? snap.dataPatch : {}),
    };
    await (this.supabase.client as any)
      .from('formation_day_contents')
      .update({ data: newData })
      .eq('id', v.content_id);
    return { ok: true, contentId: v.content_id };
  }

  // ── Pipeline (segmentation + master script) ────────────────────────────────

  /** Segmentation auto depuis un texte. Remplace l'edge course-builder-pipeline-auto-segment (404). */
  async pipelineAutoSegment(_tenantId: string, dto: { contentId?: string; transcriptText?: string }) {
    const text = String(dto.transcriptText ?? '');
    return { segments: this.naiveSegment(text), transcript: text };
  }

  /** Master script : reformule chaque segment en discours pédagogique. Remplace l'edge ...-master-script (404). */
  async pipelineMasterScript(
    tenantId: string,
    dto: { segments?: any[]; transcript?: string; courseTitle?: string },
  ) {
    const segs = Array.isArray(dto.segments) ? dto.segments.slice(0, 12) : [];
    const sections: any[] = [];
    for (const s of segs) {
      const content = String(
        s?.content ?? (Array.isArray(s?.points) ? s.points.join('. ') : '') ?? '',
      ).slice(0, 4000);
      let discourse = content;
      if (content) {
        try {
          const r: any = await this.aiUtils.reformulate(tenantId, {
            text: content,
            context: `Discours pédagogique de présentation pour le cours « ${dto.courseTitle ?? 'Cours'} ».`,
          });
          discourse = String(r?.result ?? content).trim();
        } catch (e) {
          this.logger.warn(`master-script reformulate échec: ${String(e)}`);
        }
      }
      sections.push({ title: s?.title ?? '', discourse });
    }
    return { sections };
  }

  // ── Illustration d'un segment (réutilise l'edge generate-visual-image) ─────

  /** (Re)génère l'illustration d'un segment. Remplace l'edge course-builder-segment-illustration-regenerate (404). */
  async segmentIllustrationRegenerate(
    tenantId: string,
    userId: string,
    dto: { contentId: string; segmentIndex?: number; prompt?: string },
  ) {
    const segIndex = Number(dto.segmentIndex) || 0;
    let prompt = String(dto.prompt ?? '').trim();
    if (!prompt) {
      const { data: row } = await (this.supabase.client as any)
        .from('course_segment_ai_content')
        .select('reformulation_text,summary_text')
        .eq('tenant_id', tenantId)
        .eq('content_id', dto.contentId)
        .eq('segment_index', segIndex)
        .single();
      prompt =
        String(row?.summary_text || row?.reformulation_text || '').slice(0, 500).trim() ||
        `Illustration pédagogique claire, chapitre ${segIndex + 1}`;
    }

    const supaUrl = this.config.get<string>('SUPABASE_URL') ?? '';
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    let imageUrl: string | null = null;
    if (supaUrl && key) {
      try {
        const r = await fetch(`${supaUrl}/functions/v1/generate-visual-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
          body: JSON.stringify({ prompt, size: '1792x1024' }),
        });
        const j: any = await r.json().catch(() => ({}));
        imageUrl = j?.imageUrl ?? j?.url ?? null;
      } catch (e) {
        this.logger.warn(`illustration edge échec: ${String(e)}`);
      }
    }

    if (imageUrl) {
      try {
        await (this.supabase.client as any)
          .from('course_segment_ai_content')
          .upsert(
            {
              tenant_id: tenantId,
              content_id: dto.contentId,
              segment_index: segIndex,
              illustration_url: imageUrl,
              illustration_prompt: prompt,
              created_by: userId || null,
            },
            { onConflict: 'content_id,segment_index' },
          );
      } catch {
        /* dégradation gracieuse si table absente */
      }
    }
    return { illustration_url: imageUrl, prompt };
  }

  // ── Rendu MP4 split-screen (file course_render_jobs, worker FFmpeg) ────────

  /** Enqueue un rendu : construit la spec depuis formation_day_contents.data. Remplace l'edge render-enqueue (404). */
  async enqueuePostprodRender(
    tenantId: string,
    _userId: string,
    dto: { contentId: string; renderMode?: string; exportResolution?: string },
  ) {
    const content = await this.loadFormationContent(dto.contentId);
    if (!content) throw new NotFoundException('Contenu de formation introuvable.');

    // CLOISON TENANT — FAIL-CLOSED. Le client Supabase de l'API est service_role (RLS
    // contournée) : ce contrôle est la SEULE barrière. Il était fail-soft (propriétaire
    // indéterminé → on laissait passer), ce qui, combiné à la présignature R2 servie par
    // render-status, formait une primitive d'EXFILTRATION : un tenant B enqueuait le
    // contenu STANDALONE (day_id NULL — la seule classe encore lisible par tout
    // authentifié depuis la RLS 20260715130000) d'un tenant A, le worker déposait le MP4
    // sous SON préfixe, et B le téléchargeait (le job portant son propre tenant_id, il
    // passait le filtre de render-status). On refuse donc tout contenu qu'on ne sait pas
    // rattacher à un espace. Vérifié AVANT toute construction de payload.
    const ownerTenantId = await this.resolveContentTenantId(
      content.day_id,
      dto.contentId,
      content.tenant_id,
    );
    if (!ownerTenantId) {
      this.logger.warn(
        `render-enqueue REFUSÉ (propriétaire indéterminé): content ${dto.contentId} demandé par ${tenantId}`,
      );
      throw new ForbiddenException(
        "Ce contenu n'est rattaché à aucun espace : rendu refusé. Rattache la vidéo à une journée de formation, ou enregistre d'abord une version de post-production, puis relance le rendu.",
      );
    }
    if (ownerTenantId !== tenantId) {
      this.logger.warn(
        `render-enqueue CROSS-TENANT refusé: content ${dto.contentId} (tenant ${ownerTenantId}) demandé par ${tenantId}`,
      );
      throw new ForbiddenException('Ce contenu appartient à un autre espace.');
    }

    const d = content.data || {};

    // Source vidéo : signer le chemin de stockage CÔTÉ SERVEUR (URL fraîche ~2h) —
    // robuste vs l'URL signée client (qui n'est pas persistée et expire). On transmet
    // AUSSI le chemin nu : un job peut attendre en file plus longtemps que le TTL, et le
    // worker (service_role) re-signe alors juste avant le téléchargement.
    let sourceVideoUrl = '';
    const storagePath = String(d.storagePath || '');
    if (storagePath) {
      try {
        const { data: signed } = await (this.supabase.client as any).storage
          .from(VIDEOS_BUCKET)
          .createSignedUrl(storagePath, 7200);
        sourceVideoUrl = String(signed?.signedUrl || '');
      } catch (e) {
        this.logger.warn(`createSignedUrl (${VIDEOS_BUCKET}/${storagePath}) échec: ${String(e)}`);
      }
    }
    if (!sourceVideoUrl) {
      sourceVideoUrl = String(d.url || d.videoUrl || Object.values(d.sourceVideoUrlsByRef || {})[0] || '');
    }
    // Rien à rendre sans source : mieux vaut le dire tout de suite que d'empiler un job
    // condamné à finir en `failed` après un aller-retour worker.
    if (!sourceVideoUrl && !storagePath) {
      throw new BadRequestException(
        "Aucune vidéo source sur ce contenu (ni chemin de stockage, ni URL) : impossible de lancer le rendu.",
      );
    }

    // Slides : captures du tableau. Elles peuvent être des `data:` URLs (canvas inline) OU
    // des assets du bucket PRIVÉ `smartboard-canvas` dont on persiste l'URL PUBLIQUE
    // (uploadSmartboardCanvasImage → getPublicUrl) — laquelle renvoie 403 depuis la
    // migration 20260715160000 (panne B1 : « Download failed 403 » côté worker).
    // CORRECTIF : on joint le CHEMIN Storage au payload ; c'est le worker qui signe, au
    // dernier moment, avec sa clé service_role (aucune URL signée persistée → aucune
    // expiration possible pendant l'attente en file).
    const frames: any[] = Array.isArray(d.renderSlideFrames) ? d.renderSlideFrames : [];
    const chapters: any[] = Array.isArray(d.chapters) ? d.chapters : [];
    // `chapterSlideMap[chapitre] = index de scène Konva`. C'est la SEULE correspondance
    // qui fasse foi : l'ancien code indexait les chapitres PAR l'index de scène
    // (`chapters[idx] || chapters[i]`), c'est-à-dire dans le mauvais sens. Dès qu'une
    // scène n'illustre aucun chapitre, ou qu'une même scène en illustre deux, chaque
    // slide recevait la durée d'un AUTRE chapitre et tout le diaporama était décalé.
    // L'inversion existait déjà, testée, côté front (chapterSlideMap.js) mais n'avait
    // jamais été portée ici — et `chapterSlideMap` n'était même pas lu.
    const slideMap: number[] = Array.isArray(d.chapterSlideMap)
      ? d.chapterSlideMap.map((n: any) => Math.floor(Number(n)))
      : [];

    // Durée de la SOURCE : c'est elle qui borne toute la timeline. Le front persiste
    // désormais `durationSeconds` (VideoPostProductionPage.save) ; à défaut on retombe
    // sur la fin du dernier chapitre — laquelle ignore la queue non chapitrée de la
    // vidéo, d'où la préférence pour la valeur explicite.
    const knownSourceSeconds = (() => {
      const explicit = Number(d.durationSeconds ?? d.duration_seconds ?? d.duration ?? 0);
      if (Number.isFinite(explicit) && explicit > 0) return explicit;
      const ends = chapters
        .map((c) => Number(c?.endSeconds))
        .filter((n) => Number.isFinite(n) && n > 0);
      return ends.length ? Math.max(...ends) : 0;
    })();

    const chapterWindow = (c: any): { start: number; end: number } | null => {
      const start = Number(c?.startSeconds);
      const end = Number(c?.endSeconds);
      return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
    };

    /**
     * Fenêtre temporelle d'une SCÈNE : union des chapitres qui pointent vers elle.
     * Une scène qui illustre deux chapitres consécutifs reste donc affichée du début du
     * premier à la fin du second, au lieu de recevoir la durée d'un chapitre au hasard.
     */
    const windowForScene = (sceneIdx: number): { start: number; end: number } | null => {
      const mapped: { start: number; end: number }[] = [];
      if (slideMap.length) {
        for (let c = 0; c < Math.min(slideMap.length, chapters.length); c += 1) {
          if (slideMap[c] !== sceneIdx) continue;
          const w = chapterWindow(chapters[c]);
          if (w) mapped.push(w);
        }
      } else {
        // Pas de correspondance explicite → convention historique : scène i ↔ chapitre i.
        const w = chapterWindow(chapters[sceneIdx]);
        if (w) mapped.push(w);
      }
      if (!mapped.length) return null;
      return {
        start: Math.min(...mapped.map((w) => w.start)),
        end: Math.max(...mapped.map((w) => w.end)),
      };
    };

    // Placement de chaque capture, BORNÉ par la durée de la source. Le total du
    // diaporama ne peut donc plus dépasser le cours : c'est ce dépassement qui faisait
    // couper `-shortest` côté worker et rendait les dernières slides INVISIBLES.
    const placements = frames.map((f, i) => {
      const sceneIdx = Number.isFinite(Number(f?.slideIndex)) ? Number(f.slideIndex) : i;
      const w = windowForScene(sceneIdx);
      if (!w) return null;
      const start = Math.max(0, knownSourceSeconds > 0 ? Math.min(w.start, knownSourceSeconds) : w.start);
      const end = knownSourceSeconds > 0 ? Math.min(w.end, knownSourceSeconds) : w.end;
      return end > start ? { start, end } : null;
    });

    // Aucune capture rattachée à un chapitre (cours non chapitré) → répartition
    // UNIFORME sur la durée de la source, SANS plancher : un plancher ferait à nouveau
    // déborder la timeline, et une slide un peu courte reste visible là où une slide
    // hors cadre ne l'est pas.
    const uniformStep =
      placements.every((p) => !p) && frames.length > 0
        ? (knownSourceSeconds > 0 ? knownSourceSeconds : frames.length * DEFAULT_SLIDE_SECONDS) /
          frames.length
        : 0;

    const slides: {
      url: string;
      storagePath?: string;
      storageBucket?: string;
      durationSeconds: number;
      startSeconds: number;
      endSeconds: number;
    }[] = frames
      .map((f, i) => {
        const url = typeof f === 'string' ? f : String(f?.url || f?.dataUrl || f?.image || '');
        const win = placements[i] || (uniformStep > 0 ? { start: i * uniformStep, end: (i + 1) * uniformStep } : null);
        const path =
          (typeof f === 'object' && f && f.storagePath ? String(f.storagePath) : '') ||
          this.smartboardCanvasStoragePath(url) ||
          '';
        const base = path
          ? { url, storagePath: path, storageBucket: SMARTBOARD_CANVAS_BUCKET }
          : { url };
        // `durationSeconds` est conservé pour un worker pas encore redéployé (il ignore
        // start/end) ; `startSeconds`/`endSeconds` sont ce qui permet le placement absolu.
        return win
          ? {
              ...base,
              startSeconds: Math.round(win.start * 1000) / 1000,
              endSeconds: Math.round(win.end * 1000) / 1000,
              durationSeconds: Math.round((win.end - win.start) * 1000) / 1000,
            }
          : null;
      })
      .filter((s): s is NonNullable<typeof s> => Boolean(s && (s.url || s.storagePath)));

    // Captures qu'AUCUN chapitre n'illustre : elles n'ont pas d'instant dans le cours.
    // On ne leur invente pas une place (ce serait afficher un plan pendant qu'on parle
    // d'autre chose), mais on ne les perd pas en silence non plus — le compte remonte
    // à l'appelant, qui peut demander au formateur de compléter sa correspondance.
    const unplacedSlides = frames.length - slides.length;
    // Le front envoie des LIBELLÉS ('720p'|'1080p'|'1440p'|'4k') OU un 'LxH'. Mapper les deux :
    // l'ancien `.split('x')` donnait '1080p'→1080×720 et '4k'→4×720 (hauteur toujours 720).
    const RES_MAP: Record<string, [number, number]> = {
      '720p': [1280, 720], '1080p': [1920, 1080], '1440p': [2560, 1440], '2160p': [3840, 2160], '4k': [3840, 2160],
    };
    const resStr = String(dto.exportResolution || '1080p').toLowerCase().trim();
    const [w, h] = RES_MAP[resStr] || resStr.split('x').map((n) => parseInt(n, 10));
    const payload = {
      sourceVideoUrl,
      // Chemin nu + bucket : le worker re-signe si l'URL ci-dessus a expiré en file.
      ...(storagePath ? { sourceVideoStoragePath: storagePath, sourceVideoStorageBucket: VIDEOS_BUCKET } : {}),
      slides,
      // Durée AUTORITAIRE de la source quand on la connaît : le worker la re-mesure par
      // ffprobe, mais cette valeur lui sert de repli si ffprobe est indisponible.
      ...(knownSourceSeconds > 0 ? { sourceDurationSeconds: knownSourceSeconds } : {}),
      width: w || 1920,
      height: h || 1080,
      renderMode: dto.renderMode ?? 'pedagogical',
    };

    const { data: job } = await (this.supabase.client as any)
      .from('course_render_jobs')
      .insert({ tenant_id: tenantId, content_id: dto.contentId, status: 'queued', payload })
      .select('id,status,created_at')
      .single();
    return {
      ok: true,
      jobId: job?.id ?? null,
      status: 'queued',
      slides: slides.length,
      // Nombre de slides qui seront SIGNÉES par le worker (assets du bucket privé) :
      // utile pour diagnostiquer un rendu sans slide visible.
      signedSlides: slides.filter((s) => s.storagePath).length,
      // Captures capturées mais non rattachées à un chapitre : elles n'apparaîtront PAS
      // dans le montage. Remonté explicitement pour ne pas les perdre en silence.
      unplacedSlides,
      sourceDurationSeconds: knownSourceSeconds || null,
      hasSource: Boolean(sourceVideoUrl || storagePath),
    };
  }

  /**
   * Statut des rendus d'un contenu (10 derniers, le plus récent d'abord).
   *
   * CONTRAT consommé par le front (VideoPostProductionPage) :
   *   - `status`            queued | rendering | completed | failed
   *   - `render_mode`       extrait de payload.renderMode (peut être null)
   *   - `error_message`     LE POURQUOI de l'échec (= colonne `error` écrite par le worker)
   *   - `output_video_url`  URL PRÉSIGNÉE, directement jouable / téléchargeable (null tant
   *                         que le rendu n'est pas `completed`, ou si R2 n'est pas configuré)
   *   - `output_storage_key` la CLÉ R2 brute — traçabilité/debug, JAMAIS dans un <video src>
   *
   * `output_url` (colonne) contient en réalité la clé R2 : on renvoie ici la version
   * PRÉSIGNÉE sous ce nom, pour que les anciens lecteurs qui l'utilisaient comme une URL
   * fonctionnent enfin (c'était la panne B2 : clé brute → chemin relatif → 404).
   */
  async getPostprodRenderStatus(tenantId: string, contentId: string) {
    // CLOISON TENANT — DEUX verrous, et il en faut deux.
    //
    // (1) `course_render_jobs.tenant_id` ne prouve QUE l'identité de celui qui a enquêté
    //     le rendu, pas la propriété du CONTENU. Le correctif d'`enqueuePostprodRender`
    //     a fermé la création cross-tenant, mais les lignes DÉJÀ en base restent : un
    //     tenant B qui avait enquêté le contenu standalone d'un tenant A conserve une
    //     ligne `(tenant_id=B, content_id=<contenu de A>, completed)`. Filtrer sur
    //     tenant_id la fait remonter, et on présignerait le MP4 du cours de A.
    //     → on re-résout le PROPRIÉTAIRE du contenu et on refuse s'il diffère.
    // (2) le filtre `.eq('tenant_id', …)` reste, pour ne pas exposer les jobs d'un autre
    //     espace sur un contenu partagé.
    //
    // Propriétaire INDÉTERMINÉ (contenu standalone tout neuf, sans trace) → on renvoie
    // une liste vide plutôt qu'un 403 : il ne peut par construction exister aucun job
    // légitime, et l'écran de post-production doit continuer d'afficher « aucun rendu ».
    const guard = await this.assertContentOwnedBy(tenantId, contentId);
    if (!guard.owned) return { jobs: [] };

    const BASE = 'id,content_id,status,output_url,error,created_at,updated_at';
    const query = (cols: string) =>
      (this.supabase.client as any)
        .from('course_render_jobs')
        .select(cols)
        .eq('tenant_id', tenantId)
        .eq('content_id', contentId)
        .order('created_at', { ascending: false })
        .limit(10);

    // `renderMode` vit dans le payload : on l'extrait EN SQL plutôt que de rapatrier
    // `payload` entier (il embarque les slides, parfois plusieurs Mo de `data:` URLs).
    // Repli silencieux si le PostgREST déployé refuse l'alias JSON.
    let { data, error } = await query(`${BASE},render_mode:payload->>renderMode`);
    if (error) {
      this.logger.warn(`render-status: alias payload->>renderMode refusé (${error.message}) — repli`);
      ({ data } = await query(BASE));
    }

    const rows: any[] = Array.isArray(data) ? data : [];
    const jobs = await Promise.all(
      rows.map(async (r) => {
        const storageKey = r.output_url ? String(r.output_url) : null;
        const signed = storageKey ? await this.presignR2(storageKey) : null;
        return {
          ...r,
          render_mode: r.render_mode ?? null,
          output_storage_key: storageKey,
          output_video_url: signed,
          output_url: signed, // le nom promet une URL → on tient la promesse
          error_message: r.error ?? null,
        };
      }),
    );
    return { jobs };
  }

  /**
   * URL PRÉSIGNÉE du montage d'un contenu — route de LECTURE, destinée à la CLASSE.
   *
   * POURQUOI une méthode distincte de `getPostprodRenderStatus` : ce dernier sert le
   * tableau de bord de post-production et vit sous `@Roles('owner','admin','teacher')`.
   * Or le public du montage, ce sont les ÉLÈVES (rôle 'student') : ils recevaient un 403
   * et le lecteur affichait « Montage indisponible » à toute la classe — le montage
   * n'était donc JAMAIS lisible par ceux à qui il est destiné.
   *
   * Cette méthode n'expose QUE de quoi lire : aucun payload, aucun message d'erreur du
   * worker, aucun historique.
   *
   * ⚠️ ELLE N'EST PAS « OUVERTE À TOUT MEMBRE » : le MONTAGE, c'est le COURS ENTIER.
   * Servir son URL présignée à tout membre actif du tenant contournait purement et
   * simplement le paywall — un élève inscrit à un cours GRATUIT récupérait le contentId
   * d'un cours à 300 € (la RLS ne ferme que le cross-tenant) et obtenait ici le MP4
   * complet, là où `POST /courses/:id/video-url` lui répondait « achat requis ».
   * On applique donc EXACTEMENT le même gating que `CoursesService.signCourseVideoUrl` :
   * staff bypass, sinon subscription → forfait actif, one_time → inscription payée.
   */
  async getRenderedPlaybackUrl(tenant: TenantContext, userId: string, contentId: string) {
    if (!contentId) throw new BadRequestException('contentId manquant.');
    const tenantId = tenant.id;
    const content = await this.loadFormationContent(contentId);
    if (!content) throw new NotFoundException('Contenu de formation introuvable.');

    // Propriété du CONTENU (pas seulement du job) — cf. getPostprodRenderStatus.
    const guard = await this.assertContentOwnedBy(tenantId, contentId, content);
    if (!guard.owned) return { url: null, jobId: null, storageKey: null, status: null };

    // Gate payant — AVANT toute présignature.
    await this.assertMontagePlaybackAllowed(tenant, userId, content.day_id, contentId);

    const { data } = await (this.supabase.client as any)
      .from('course_render_jobs')
      .select('id,status,output_url,created_at')
      .eq('tenant_id', tenantId)
      .eq('content_id', contentId)
      .order('created_at', { ascending: false })
      .limit(10);
    const rows: any[] = Array.isArray(data) ? data : [];
    const done = rows.filter((r) => String(r.status) === 'completed' && r.output_url);

    // Le contenu peut pointer un rendu VOLONTAIREMENT plus ancien que le dernier : on
    // honore d'abord la référence écrite par le worker dans `data` (jobId, puis clé), et
    // on ne retombe sur le dernier rendu terminé qu'à défaut.
    const wantedJobId = String(content.data?.renderedJobId ?? '').trim();
    const wantedKey = String(
      content.data?.renderedStorageKey ?? content.data?.renderedUrl ?? '',
    ).trim();
    const job =
      (wantedJobId && done.find((r) => String(r.id) === wantedJobId)) ||
      (wantedKey && done.find((r) => String(r.output_url) === wantedKey)) ||
      done[0] ||
      null;

    if (!job) {
      // Pas (encore) de montage lisible pour CE tenant : on le dit sans rien divulguer.
      return { url: null, jobId: null, storageKey: null, status: rows[0]?.status ?? null };
    }
    const storageKey = String(job.output_url);
    return {
      url: await this.presignR2(storageKey),
      jobId: String(job.id),
      storageKey,
      status: 'completed',
    };
  }

  // ── Helpers rendu (cloison tenant, chemins Storage, présignature R2) ───────

  /**
   * Charge un contenu de formation (data + rattachements) pour la post-production.
   *
   * `tenant_id` est la colonne AUTORITAIRE de propriété, ajoutée par la migration
   * supabase/migrations/20260726120000_formation_day_contents_tenant_id.sql. Tant qu'elle
   * n'est pas appliquée, PostgREST répond « column … does not exist » : on retombe alors
   * sur l'ancien SELECT, pour que l'API reste fonctionnelle entre le déploiement du code
   * et l'application (hors-bande) de la migration.
   */
  private async loadFormationContent(
    contentId: string,
  ): Promise<{ data: any; day_id: string | null; tenant_id: string | null } | null> {
    const db = this.supabase.client as any;
    const withTenant = await db
      .from('formation_day_contents')
      .select('data,day_id,tenant_id')
      .eq('id', contentId)
      .maybeSingle();
    let row = withTenant?.error ? null : withTenant?.data;
    if (withTenant?.error) {
      const legacy = await db
        .from('formation_day_contents')
        .select('data,day_id')
        .eq('id', contentId)
        .maybeSingle();
      row = legacy?.data ?? null;
    }
    if (!row) return null;
    return {
      data: row.data ?? {},
      day_id: row.day_id ? String(row.day_id) : null,
      tenant_id: row.tenant_id ? String(row.tenant_id) : null,
    };
  }

  /**
   * Le contenu appartient-il bien à CE tenant ?
   *
   * Distinct de la cloison `course_render_jobs.tenant_id` : cette colonne ne dit que
   * QUI a demandé le rendu. Les chemins de LECTURE lui faisaient confiance, si bien que
   * les lignes écrites AVANT le correctif d'enqueue (un tenant B ayant enquêté le
   * contenu standalone d'un tenant A) restaient exploitables. On re-résout donc le
   * propriétaire du CONTENU à chaque lecture.
   *
   * `owned:false` couvre deux cas volontairement confondus côté appelant :
   *   - propriétaire d'un AUTRE espace → rien à servir ;
   *   - propriétaire indéterminé (contenu standalone sans aucune trace) → il ne peut
   *     exister aucun job légitime, on ne fabrique pas un 403 pour autant.
   */
  private async assertContentOwnedBy(
    tenantId: string,
    contentId: string,
    preloaded?: { data: any; day_id: string | null; tenant_id: string | null } | null,
  ): Promise<{ owned: boolean; content: { data: any; day_id: string | null; tenant_id: string | null } | null }> {
    const content = preloaded ?? (await this.loadFormationContent(contentId));
    if (!content) return { owned: false, content: null };
    const ownerTenantId = await this.resolveContentTenantId(content.day_id, contentId, content.tenant_id);
    if (!ownerTenantId) {
      this.logger.warn(`Lecture de rendu : propriétaire indéterminé pour le contenu ${contentId} (demandeur ${tenantId})`);
      return { owned: false, content };
    }
    if (ownerTenantId !== tenantId) {
      this.logger.warn(
        `Lecture de rendu CROSS-TENANT refusée : contenu ${contentId} (tenant ${ownerTenantId}) demandé par ${tenantId}`,
      );
      return { owned: false, content };
    }
    return { owned: true, content };
  }

  /**
   * Gate payant du MONTAGE — MIROIR de `CoursesService.signCourseVideoUrl` (étape 3).
   *
   * Les deux chemins servent la MÊME chose (le cours), ils doivent donc appliquer la
   * MÊME règle ; toute divergence rouvre le contournement. Si la règle change là-bas,
   * elle doit changer ici.
   *
   * Contenu STANDALONE (aucune journée de formation) : aucun cours ne le porte, donc
   * aucune inscription ne peut le couvrir → réservé à l'encadrement. Fail-closed
   * délibéré, c'est exactement le cas qui servait de porte d'entrée.
   */
  private async assertMontagePlaybackAllowed(
    tenant: TenantContext,
    userId: string,
    dayId: string | null,
    contentId: string,
  ): Promise<void> {
    const isStaff = STAFF_ROLES.includes(String(tenant.userRole || '').toLowerCase());
    if (isStaff) return;

    // TenantGuard peut poser userRole=null pour un non-membre (resolveTenant fail-open) :
    // sans ce garde, un non-membre lirait le montage d'un cours gratuit.
    if (!tenant.userRole) throw new ForbiddenException('Accès réservé aux membres inscrits de ce tenant.');

    const course = await this.resolveCourseForContent(dayId);
    if (!course) {
      this.logger.warn(`render-playback refusé : contenu ${contentId} rattaché à aucun cours (demandeur ${userId})`);
      throw new ForbiddenException("Ce montage n'est rattaché à aucun cours : lecture réservée à l'encadrement.");
    }

    const client = this.supabase.client as any;
    const meta = course.meta && typeof course.meta === 'object' ? (course.meta as Record<string, any>) : {};
    // Défaut PAYANT si le cours a un prix : un cours à prix sans `access_mode` explicite
    // ne doit pas être servi sans inscription.
    const accessMode =
      meta.access_mode || meta?.access?.mode || (Number(course.price_cents) > 0 ? 'one_time' : 'free');

    if (accessMode === 'subscription') {
      const cycle = await resolveMemberCycle(client, tenant.id, userId);
      if (!cycleCan(cycle, 'coursReplay')) {
        throw new ForbiddenException('Un forfait actif est requis pour visionner ce cours.');
      }
    } else if (accessMode === 'one_time') {
      const { data: enroll } = await client
        .from('student_progress')
        .select('id')
        .eq('course_id', course.id)
        .eq('user_id', userId)
        .in('status', ['active', 'approved', 'paid'])
        .limit(1);
      if (!Array.isArray(enroll) || enroll.length === 0) {
        throw new ForbiddenException('Ce cours est en vente individuelle : achat requis pour y accéder.');
      }
    }
    // 'free' → membre tenant authentifié suffit.
  }

  /** Remonte journée → semaine → module → cours. Null pour un contenu standalone. */
  private async resolveCourseForContent(
    dayId: string | null,
  ): Promise<{ id: string; meta: any; price_cents: number } | null> {
    if (!dayId) return null;
    const db = this.supabase.client as any;
    const { data: day } = await db.from('formation_days').select('week_id').eq('id', dayId).maybeSingle();
    if (!day?.week_id) return null;
    const { data: week } = await db.from('formation_weeks').select('module_id').eq('id', day.week_id).maybeSingle();
    if (!week?.module_id) return null;
    const { data: mod } = await db.from('modules').select('formation_id').eq('id', week.module_id).maybeSingle();
    if (!mod?.formation_id) return null;
    const { data: course } = await db
      .from('courses')
      .select('id,meta,price_cents')
      .eq('id', mod.formation_id)
      .maybeSingle();
    return course ?? null;
  }

  /**
   * Résout le tenant PROPRIÉTAIRE d'un contenu de formation.
   *
   * Trois sources, de la plus forte à la plus faible :
   *   1. `formation_day_contents.tenant_id` — colonne AUTORITAIRE (migration
   *      20260726120000), non falsifiable par l'appelant ;
   *   2. la chaîne day_id → formation_days → formation_weeks → modules → courses.tenant_id
   *      — la MÊME que les policies RLS (20260715130000_rls_scope_formation_chain_tenant) ;
   *   3. pour un contenu STANDALONE (day_id NULL — cartes neuro_recall, snapshots
   *      post-prod), la PREMIÈRE trace laissée par les tables tenant-scopées du contenu.
   *
   * Le tri chronologique de (3) n'est pas cosmétique : sans `order by`, la ligne renvoyée
   * était ARBITRAIRE et une seule ligne d'un autre tenant pouvait bannir, par intermittence,
   * le propriétaire légitime de son propre rendu. Règle retenue : le PREMIER arrivé fait foi
   * (une trace postérieure ne dépossède personne) ; une divergence est journalisée.
   *
   * Renvoie null = « propriétaire indéterminé ». Les appelants sensibles (enqueue de rendu)
   * REFUSENT dans ce cas — le fail-soft historique était exploitable (cf. enqueuePostprodRender).
   */
  private async resolveContentTenantId(
    dayId: string | null,
    contentId: string,
    columnTenantId: string | null = null,
  ): Promise<string | null> {
    const db = this.supabase.client as any;
    if (columnTenantId) return String(columnTenantId);
    if (dayId) {
      const { data: day } = await db.from('formation_days').select('week_id').eq('id', dayId).single();
      if (day?.week_id) {
        const { data: week } = await db.from('formation_weeks').select('module_id').eq('id', day.week_id).single();
        if (week?.module_id) {
          const { data: mod } = await db.from('modules').select('formation_id').eq('id', week.module_id).single();
          if (mod?.formation_id) {
            const { data: course } = await db.from('courses').select('tenant_id').eq('id', mod.formation_id).single();
            if (course?.tenant_id) return String(course.tenant_id);
          }
        }
      }
    }
    // Traces tenant-scopées du contenu, la PLUS ANCIENNE de chaque table.
    const traces: { tenantId: string; createdAt: number; table: string }[] = [];
    for (const table of ['course_postprod_versions', 'course_render_jobs']) {
      try {
        const { data } = await db
          .from(table)
          .select('tenant_id,created_at')
          .eq('content_id', contentId)
          .order('created_at', { ascending: true })
          .limit(1);
        const row = Array.isArray(data) ? data[0] : null;
        if (row?.tenant_id) {
          traces.push({
            tenantId: String(row.tenant_id),
            // Une date illisible ne doit pas passer devant une date valide.
            createdAt: Date.parse(String(row.created_at ?? '')) || Number.MAX_SAFE_INTEGER,
            table,
          });
        }
      } catch {
        /* table absente / colonne manquante → on tente la trace suivante */
      }
    }
    if (!traces.length) return null;
    traces.sort((a, b) => a.createdAt - b.createdAt);
    const owner = traces[0].tenantId;
    if (traces.some((t) => t.tenantId !== owner)) {
      // Deux espaces ont laissé une trace sur le même contenu : anomalie à instruire
      // (migration de tenant, ou tentative d'appropriation). On tranche par l'ancienneté
      // plutôt que d'interdire, pour ne pas bloquer le propriétaire historique.
      this.logger.warn(
        `Traces de propriété DIVERGENTES pour le contenu ${contentId} : ` +
          `${traces.map((t) => `${t.table}=${t.tenantId}`).join(', ')} — la plus ancienne fait foi (${owner}).`,
      );
    }
    return owner;
  }

  /**
   * Chemin Storage d'un asset du bucket privé `smartboard-canvas`.
   * PORT SERVEUR de `apps/app/src/lib/smartboardCanvasUrl.js#smartboardCanvasStoragePath`
   * (garder les deux en phase). Accepte l'URL publique `.../object/public/<bucket>/<path>`,
   * l'URL signée `.../object/sign/<bucket>/<path>?token=…` ou un chemin nu `<uid>/<fichier>`.
   * Renvoie null pour tout ce qui n'appartient pas au bucket (URL externe, data:, blob:).
   */
  private smartboardCanvasStoragePath(value: unknown): string | null {
    if (!value || typeof value !== 'string') return null;
    const v = value.trim();
    if (!v) return null;

    const marker = `/${SMARTBOARD_CANVAS_BUCKET}/`;
    const idx = v.indexOf(marker);
    if (idx !== -1) {
      let path = v.slice(idx + marker.length);
      const q = path.indexOf('?');
      if (q !== -1) path = path.slice(0, q);
      path = path.replace(/^\/+/, '');
      try {
        path = decodeURIComponent(path);
      } catch {
        /* garde la forme brute si non décodable */
      }
      return path || null;
    }

    if (/^(https?:|data:|blob:|ftp:)/i.test(v) || v.startsWith('/')) return null;
    if (v.includes('/') && !/\s/.test(v)) return v;
    return null;
  }

  /**
   * Présignature R2 (lecture). COPIE du modèle déjà en production pour les replays
   * (`ZoomEngineService.presignR2`) : mêmes variables d'env CF_R2_*, même client S3
   * (region 'auto', endpoint `<account>.r2.cloudflarestorage.com`, forcePathStyle).
   * Le défaut `cimolace-media` s'aligne sur celui du worker (apps/worker/.../courseRender.js)
   * pour ne pas présigner un autre bucket que celui où le MP4 a été déposé.
   */
  private async presignR2(key: string, ttlSeconds = RENDER_OUTPUT_SIGN_TTL_SECONDS): Promise<string | null> {
    const accountId = this.config.get<string>('CF_R2_ACCOUNT_ID') ?? process.env.CF_R2_ACCOUNT_ID;
    const accessKeyId = this.config.get<string>('CF_R2_ACCESS_KEY_ID') ?? process.env.CF_R2_ACCESS_KEY_ID;
    const secretAccessKey = this.config.get<string>('CF_R2_SECRET_ACCESS_KEY') ?? process.env.CF_R2_SECRET_ACCESS_KEY;
    const bucket = this.config.get<string>('CF_R2_BUCKET') ?? process.env.CF_R2_BUCKET ?? 'cimolace-media';
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !key) return null;
    try {
      const client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
      return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: ttlSeconds,
      });
    } catch (err) {
      this.logger.error(`presignR2 failed: ${(err as Error).message}`);
      return null;
    }
  }

  private naiveSegment(text: string): { title: string; content: string; index: number }[] {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    return paragraphs.map((p, i) => ({ title: `Segment ${i + 1}`, content: p.trim(), index: i }));
  }
}
