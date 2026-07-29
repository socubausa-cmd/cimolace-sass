/**
 * ZoomEngineService — Orchestre la synchronisation des enregistrements Zoom.
 *
 * Utilise Zoom Cloud Recording API via OAuth pour lister et télécharger
 * les enregistrements, puis stocker les métadonnées en base.
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SupabaseService } from '../supabase/supabase.service';
import { ZoomOAuthService } from './zoom-oauth.service';

const ZOOM_API_BASE = 'https://api.zoom.us/v2';

/**
 * ── EXTRAITS COURTS : vocabulaire d'idempotence de `zoom_recordings` ─────────
 *
 * Cette colonne N'APPARTIENT PAS à l'API : elle est définie par le worker
 * (apps/worker/src/jobs/short-generator.js) et par sa migration
 * supabase/migrations/20260727140000_zoom_shorts_idempotence.sql. On la lit et on
 * l'écrit, on ne l'invente pas — d'où ces constantes plutôt que des chaînes
 * dispersées : le jour où le worker change de vocabulaire, il y a UN endroit à
 * corriger, et la traduction vers l'écran (ci-dessous) ne bouge pas.
 *
 *   NULL         → jamais demandé. Le poller du worker NE PREND PAS la ligne :
 *                  c'est précisément la garde qui empêche les dizaines de replays
 *                  déjà en base de partir tout seuls à l'encodage.
 *   'requested'  → un créateur a explicitement demandé la fabrication (ce que
 *                  pose cette API). Le poller ne travaille QUE sur cette valeur.
 *   'processing' → pris en charge par un worker (posé avant le travail).
 *   'done'       → terminé. Les clips sont dans `short_clips` (statut 'ready').
 *   'error'      → échoué ; motif dans `shorts_error`, essais dans `shorts_attempts`.
 *
 * Colonnes compagnes posées par la même migration :
 *   `shorts_requested_at` — horodatage de la demande. ⚠️ NON DÉCORATIF : le poller
 *                           sert la file DANS L'ORDRE D'ARRIVÉE sur cette colonne.
 *                           L'oublier ferait passer les demandes en dernier (NULL).
 *   `shorts_started_at`   — prise en charge par un worker (au worker, pas à nous).
 *   `shorts_attempts`     — essais cumulés ; au-delà de 3 le poller renonce EN
 *                           L'ÉCRIVANT. Une nouvelle demande du créateur le remet à 0.
 *   `shorts_error`        — motif du dernier échec, volontairement distinct de
 *                           `error_message` (réservé au transfert Zoom → R2).
 */
const SHORTS_DEMANDE = 'requested';

/**
 * Vocabulaire rendu à l'ÉCRAN — cinq mots français, stables, qui ne trahissent ni
 * le nom des colonnes ni les valeurs du worker. La Vidéothèque ne connaît que
 * ceux-là : le front n'a donc rien à réécrire si le worker renomme ses états.
 */
export type ShortsEtat = 'aucun' | 'demande' | 'encours' | 'pret' | 'erreur';

export interface ReplayShortsState {
  state: ShortsEtat;
  /** Extraits réellement disponibles (short_clips en statut 'ready'). */
  clips: number;
  error_message: string | null;
  requested_at: string | null;
  /**
   * VRAI quand ce replay ne produira AUCUN sous-titre, et qu'aucun automatisme ne
   * viendra y changer quoi que ce soit. Cf. `SHORTS_WHISPER_MAX_MIN` ci-dessous.
   * L'écran doit le dire AVANT le clic — sinon le créateur relance la fabrication
   * en boucle en croyant que la transcription finira par arriver.
   */
  sans_transcription: boolean;
}

/**
 * Seuil, EN MINUTES, au-delà duquel le worker renonce à transcrire un replay qui
 * n'a pas déjà ses cues (miroir de `WHISPER_INLINE_MAX_SEC` dans
 * apps/worker/src/jobs/short-generator.js : un WAV 16 kHz mono dépasse la limite
 * de 25 Mo des fournisseurs Whisper au-delà d'environ 12 minutes).
 *
 * ⚠️ ET LE RATTRAPAGE N'EXISTE PAS. Le poller de transcription
 * (apps/worker/src/jobs/zoom-transcribe.js) ne reprend que les vidéos dont
 * `published_videos.transcript_text` est NULL, alors qu'il pose lui-même la chaîne
 * vide comme sentinelle « tenté, en échec ». Un replay long déjà tenté est donc
 * sorti de sa file DÉFINITIVEMENT : ses extraits sortiront sans sous-titres
 * aujourd'hui comme dans six mois. Seule reprise possible, à la main :
 *   update published_videos set transcript_text = null where transcript_text = '';
 */
const SHORTS_WHISPER_MAX_MIN = 12;

@Injectable()
export class ZoomEngineService {
  private readonly logger = new Logger(ZoomEngineService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly zoomOAuth: ZoomOAuthService,
  ) {}

  // ── Synchroniser les enregistrements depuis Zoom ─────────────────────────

  async syncRecordings(tenantId: string, days = 30): Promise<{
    found: number;
    new: number;
    logId: string;
  }> {
    // Créer un log de sync
    const { data: logEntry, error: logErr } = await (this.supabase.client as any)
      .from('zoom_sync_logs')
      .insert({ tenant_id: tenantId, status: 'running' })
      .select('id')
      .single();

    if (logErr) throw new Error(`Erreur création log: ${logErr.message}`);
    const logId = logEntry.id;

    try {
      const token = await this.zoomOAuth.getValidToken(tenantId);
      const recordings = await this.fetchRecordings(token, days);

      let newCount = 0;
      for (const rec of recordings) {
        const saved = await this.upsertRecording(tenantId, rec);
        if (saved) newCount++;
      }

      // Mettre à jour le log
      await (this.supabase.client as any)
        .from('zoom_sync_logs')
        .update({
          status: 'success',
          recordings_found: recordings.length,
          recordings_new: newCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId);

      this.logger.log(`Sync terminé: ${recordings.length} trouvées, ${newCount} nouvelles`);

      return { found: recordings.length, new: newCount, logId };
    } catch (err) {
      await (this.supabase.client as any)
        .from('zoom_sync_logs')
        .update({
          status: 'error',
          error_message: (err as Error).message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId);

      throw err;
    }
  }

  // ── Appel API Zoom Cloud Recording ────────────────────────────────────────

  private async fetchRecordings(token: string, days: number): Promise<any[]> {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = new Date().toISOString().split('T')[0];

    let allRecordings: any[] = [];
    let pageToken: string | null = null;

    do {
      const params: URLSearchParams = new URLSearchParams({ from, to, page_size: '30' });
      if (pageToken) params.append('next_page_token', pageToken);

      const res: Response = await fetch(`${ZOOM_API_BASE}/users/me/recordings?${params}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Zoom API error ${res.status}: ${text}`);
      }

      const data: any = await res.json();
      allRecordings = allRecordings.concat(data.meetings || []);
      pageToken = data.next_page_token || null;
    } while (pageToken);

    return allRecordings;
  }

  // ── Sauvegarder ou ignorer un enregistrement ──────────────────────────────

  private async upsertRecording(tenantId: string, meeting: any): Promise<boolean> {
    const uuid = meeting.uuid;
    if (!uuid) return false;

    const { data: existing } = await (this.supabase.client as any)
      .from('zoom_recordings')
      .select('id')
      .eq('zoom_meeting_id', uuid)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing) return false; // Déjà importé

    const recordingFiles = meeting.recording_files || [];
    const videoFiles = recordingFiles.filter((f: any) =>
      f.file_type === 'MP4' && f.status === 'completed'
    );

    if (videoFiles.length === 0) return false;

    // Prendre le premier MP4 (souvent le recording principal)
    const mainVideo = videoFiles[0];
    const totalSize = recordingFiles.reduce((acc: number, f: any) => acc + (f.file_size || 0), 0);
    const totalDuration = meeting.duration || 0;

    // Extraire le topic comme titre, nettoyé
    const topic = meeting.topic || 'Réunion sans titre';

    await (this.supabase.client as any)
      .from('zoom_recordings')
      .insert({
        tenant_id: tenantId,
        zoom_meeting_id: uuid,
        zoom_meeting_number: meeting.id,
        topic,
        agenda: meeting.agenda || null,
        start_time: meeting.start_time || null,
        end_time: meeting.end_time || null,
        duration_min: totalDuration,
        recording_count: videoFiles.length,
        total_size: totalSize,
        status: 'pending',
        download_url: mainVideo.download_url || null,
        thumbnail_url: null,
        metadata: { recording_files_count: recordingFiles.length, video_files: videoFiles.length },
      });

    return true;
  }

  // ─── CRUD Enregistrements ─────────────────────────────────────────────────

  async listRecordings(tenantId: string, options?: {
    status?: string;
    is_published?: boolean;
    limit?: number;
    offset?: number;
  }) {
    let query = (this.supabase.client as any)
      .from('zoom_recordings')
      .select('id, zoom_meeting_number, topic, agenda, start_time, duration_min, status, is_published, category, tags, thumbnail_url, playback_url, created_at, updated_at, error_message', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.status) query = query.eq('status', options.status);
    if (options?.is_published !== undefined) query = query.eq('is_published', options.is_published);
    if (options?.limit) query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data || [], total: count || 0 };
  }

  async getRecording(tenantId: string, recordingId: string) {
    const { data, error } = await (this.supabase.client as any)
      .from('zoom_recordings')
      .select('*')
      .eq('id', recordingId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !data) throw new Error('Enregistrement introuvable');
    return data;
  }

  async updateRecording(tenantId: string, recordingId: string, updates: any) {
    const { data, error } = await (this.supabase.client as any)
      .from('zoom_recordings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', recordingId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteRecording(tenantId: string, recordingId: string) {
    await (this.supabase.client as any)
      .from('zoom_recordings')
      .delete()
      .eq('id', recordingId)
      .eq('tenant_id', tenantId);
  }

  // ─── Sync Logs ────────────────────────────────────────────────────────────

  async getSyncLogs(tenantId: string, limit = 10) {
    const { data } = await (this.supabase.client as any)
      .from('zoom_sync_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(limit);
    return data || [];
  }

  // ─── Vidéos publiées ─────────────────────────────────────────────────────

  async publishVideo(tenantId: string, dto: {
    recording_id: string;
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
    is_featured?: boolean;
  }) {
    const recording = await this.getRecording(tenantId, dto.recording_id);
    if (!recording.playback_url && !recording.download_url) {
      throw new Error('Cette vidéo n\'a pas encore été téléchargée. Lancez d\'abord le traitement.');
    }

    const { data, error } = await (this.supabase.client as any)
      .from('published_videos')
      .insert({
        recording_id: recording.id,
        tenant_id: tenantId,
        title: dto.title || recording.topic,
        description: dto.description || recording.agenda || null,
        playback_url: recording.playback_url,
        thumbnail_url: recording.thumbnail_url || null,
        duration_sec: recording.duration_min ? recording.duration_min * 60 : null,
        category: dto.category || recording.category || null,
        tags: dto.tags || recording.tags || [],
        is_featured: dto.is_featured || false,
        is_public: true,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    // Marquer le recording comme publié
    await (this.supabase.client as any)
      .from('zoom_recordings')
      .update({ is_published: true, published_at: new Date().toISOString(), status: 'published' })
      .eq('id', recording.id);

    return data;
  }

  /**
   * @param pourCreateur rattache l'état des EXTRAITS à chaque replay. Réservé aux
   * créateurs : un élève n'a rien à faire d'un motif d'échec de worker, et cette
   * lecture ferait deux requêtes de plus sur l'écran le plus chargé du portail.
   */
  async listPublishedVideos(tenantId: string, pourCreateur = false) {
    const { data } = await (this.supabase.client as any)
      .from('published_videos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_public', true)
      .order('published_at', { ascending: false });
    const rows: any[] = data || [];
    // Les vidéos hébergées sur R2 stockent une `storage_key` : on présigne à la lecture
    // (URL éphémère, régénérée à chaque appel) — même modèle que les replays live.
    await Promise.all(
      rows.map(async (row) => {
        if (row.storage_key) {
          const signed = await this.presignR2(row.storage_key);
          if (signed) row.playback_url = signed;
        }
      }),
    );
    // Rattacher le cours Précepteur construit à partir de ce replay (source_video_id) → bouton « Suivre le cours ».
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (ids.length) {
      const { data: precs } = await (this.supabase.client as any)
        .from('masterclasses')
        .select('id, title, source_video_id')
        .eq('tenant_id', tenantId)
        .in('source_video_id', ids);
      const byVideo = new Map<string, any>();
      for (const p of precs || []) if (p.source_video_id) byVideo.set(p.source_video_id, p);
      for (const row of rows) {
        const p = byVideo.get(row.id);
        if (p) { row.precepteur_id = p.id; row.precepteur_title = p.title; }
      }
    }
    // ── État des EXTRAITS COURTS, rattaché à chaque replay ────────────────────
    // POURQUOI GROUPÉ ICI : la Vidéothèque montre l'avancement sur les cartes.
    // Le demander depuis l'écran coûterait une requête PAR replay (des dizaines)
    // à chaque ouverture de page ; deux requêtes groupées suffisent.
    //
    // ⚠️ FAIL-SOFT ASSUMÉ : cette table est aussi celle des ÉLÈVES. Si la colonne
    // d'idempotence n'existe pas encore (API déployée avant l'application de la
    // migration — l'ordre n'est pas garanti), une erreur PostgREST ferait ici
    // disparaître TOUTE la vidéothèque pour tout le monde. On préfère perdre une
    // pastille d'état : les replays restent lisibles, l'écran affichera « aucun ».
    if (pourCreateur && rows.length) {
      try {
        const recIds = [...new Set(rows.map((r) => r.recording_id).filter(Boolean))] as string[];
        if (recIds.length) {
          const { data: recs, error: recErr } = await (this.supabase.client as any)
            .from('zoom_recordings')
            .select('id, shorts_status, shorts_error, duration_min')
            .eq('tenant_id', tenantId)
            .in('id', recIds);
          if (recErr) throw recErr;
          const parRec = new Map<string, any>();
          for (const r of recs || []) parRec.set(r.id, r);
          const clipsParRec = await this.countClipsPrets(tenantId, recIds);
          for (const row of rows) {
            const rec = row.recording_id ? parRec.get(row.recording_id) : null;
            // `row.transcript_cues` vient de la ligne `published_videos` déjà chargée :
            // le booléen ne coûte donc aucune requête ni aucun octet de plus.
            const etat = this.formatShortsState(
              rec,
              clipsParRec.get(row.recording_id) || 0,
              row.transcript_cues,
            );
            row.shorts_state = etat.state;
            row.shorts_clips = etat.clips;
            row.shorts_error = etat.error_message;
            row.shorts_sans_transcription = etat.sans_transcription;
          }
        }
      } catch (err) {
        this.logger.warn(`[shorts] État non rattaché à la vidéothèque : ${(err as Error).message}`);
      }
    }
    return rows;
  }

  /* ─── EXTRAITS COURTS (short_clips) fabriqués depuis un replay ──────────── */

  /** Traduit l'état brut du worker en mot d'écran. Toute valeur inconnue → 'aucun'. */
  private mapShortsEtat(brut: unknown): ShortsEtat {
    switch (String(brut ?? '').toLowerCase()) {
      // 'queued' est toléré : le worker l'accepte comme synonyme de 'requested'.
      case 'requested':
      case 'queued':
        return 'demande';
      case 'processing':
        return 'encours';
      case 'done':
        return 'pret';
      case 'error':
        return 'erreur';
      default:
        return 'aucun';
    }
  }

  /**
   * Assemble l'état rendu à l'écran. `error_message` n'est renvoyé QU'EN ÉCHEC :
   * `shorts_error` peut rester renseigné d'un essai précédent après une reprise
   * réussie, et afficher « Échec : … » sur un replay dont les extraits sont prêts
   * serait un mensonge.
   */
  private formatShortsState(rec: any, clips: number, cuesConnues?: unknown): ReplayShortsState {
    const state = this.mapShortsEtat(rec?.shorts_status);
    return {
      state,
      clips,
      error_message: state === 'erreur' ? (rec?.shorts_error || null) : null,
      requested_at: rec?.shorts_requested_at || null,
      sans_transcription: this.manqueTranscription(rec, cuesConnues),
    };
  }

  /**
   * Ce replay est-il condamné à des extraits SANS sous-titres ?
   *
   * Deux conditions, exactement celles du worker : aucune cue horodatée nulle part,
   * et une durée qui dépasse ce qu'un envoi Whisper en une passe peut avaler. Dans
   * ce cas la branche (b) du générateur saute la transcription — et, contrairement à
   * ce que son commentaire affirmait, personne ne viendra la combler ensuite.
   *
   * `cuesConnues` sert la liste de la Vidéothèque : la ligne `published_videos` y est
   * DÉJÀ chargée avec ses cues, alors qu'aller les relire sur `zoom_recordings`
   * ramènerait des dizaines de gros JSON pour un simple booléen.
   */
  private manqueTranscription(rec: any, cuesConnues?: unknown): boolean {
    const cuesRec = rec?.transcript_cues;
    const aDesCues =
      (Array.isArray(cuesRec) && cuesRec.length > 0) ||
      (Array.isArray(cuesConnues) && cuesConnues.length > 0);
    if (aDesCues) return false;
    // Sans durée connue on ne présume RIEN : un avertissement faux ferait renoncer
    // à une fabrication qui se serait très bien passée.
    const minutes = Number(rec?.duration_min) || 0;
    return minutes > SHORTS_WHISPER_MAX_MIN;
  }

  /**
   * Compte les extraits RÉELLEMENT disponibles, par enregistrement source.
   * Seuls les clips 'ready' comptent : un clip 'generating' ou 'error' n'est pas
   * un extrait qu'on peut montrer, l'annoncer gonflerait le chiffre pour rien.
   */
  private async countClipsPrets(tenantId: string, recordingIds: string[]): Promise<Map<string, number>> {
    const parRec = new Map<string, number>();
    if (!recordingIds.length) return parRec;
    const { data } = await (this.supabase.client as any)
      .from('short_clips')
      .select('recording_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'ready')
      .in('recording_id', recordingIds);
    for (const c of data || []) {
      if (!c?.recording_id) continue;
      parRec.set(c.recording_id, (parRec.get(c.recording_id) || 0) + 1);
    }
    return parRec;
  }

  /**
   * Remonte de la vidéo PUBLIÉE (le seul identifiant que la Vidéothèque manipule)
   * jusqu'à son enregistrement source, en restant cloisonné au tenant à CHAQUE
   * saut : filtrer le premier ne suffit pas, un `recording_id` mal apparié
   * donnerait accès à l'enregistrement d'une autre école.
   */
  private async resolveRecordingDeVideo(tenantId: string, videoId: string) {
    if (!tenantId) throw new BadRequestException('École non identifiée.');
    if (!videoId) throw new BadRequestException('Replay non identifié.');

    const { data: video } = await (this.supabase.client as any)
      .from('published_videos')
      .select('id, recording_id')
      .eq('id', videoId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!video) throw new NotFoundException('Replay introuvable pour cette école.');
    if (!video.recording_id) {
      throw new BadRequestException(
        "Ce replay n'a pas d'enregistrement source : il n'y a rien à découper.",
      );
    }

    // `select('*')` à dessein : la ligne est UNIQUE (coût négligeable) et cette
    // lecture survit à l'ajout ou au renommage d'une colonne d'idempotence côté
    // worker — un `select` nominatif renverrait une erreur PostgREST 42703 et
    // casserait le bouton pour une colonne absente.
    const { data: rec } = await (this.supabase.client as any)
      .from('zoom_recordings')
      .select('*')
      .eq('id', video.recording_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!rec) throw new NotFoundException('Enregistrement source introuvable pour cette école.');
    return rec;
  }

  /** État d'avancement des extraits d'UN replay (sondage de l'écran). */
  async getReplayShortsState(tenantId: string, videoId: string): Promise<ReplayShortsState> {
    const rec = await this.resolveRecordingDeVideo(tenantId, videoId);
    const clips = (await this.countClipsPrets(tenantId, [rec.id])).get(rec.id) || 0;
    return this.formatShortsState(rec, clips);
  }

  /**
   * LISTE les extraits d'un replay, prêts à être REGARDÉS.
   *
   * Pourquoi une route à part alors que `GET social-publisher/shorts` existe déjà :
   * celle-là renvoie TOUS les extraits de l'école, sans URL jouable, pour alimenter
   * un sélecteur de publication. Ici on répond à une autre question — « montre-moi
   * ce que CE replay a produit » — posée depuis le lecteur, par quelqu'un qui veut
   * voir avant de publier. Le renvoyer vers un assistant de publication en trois
   * étapes pour ça, c'était la promesse non tenue du bouton « Voir les extraits ».
   *
   * Le fichier vit sur un bucket R2 PRIVÉ : sans présignature, le lecteur HTML5
   * recevrait un 403 et afficherait un cadre noir muet. On présigne donc ici, à
   * la demande, plutôt que de stocker une URL qui expirerait en base.
   *
   * TTL de 6 h et non les 7 jours de la lecture des replays : cette liste est
   * consultée dans la foulée d'un clic, et une URL présignée est un droit d'accès
   * en clair — on lui donne la durée de l'usage, pas davantage.
   */
  async listReplayShorts(tenantId: string, videoId: string) {
    const rec = await this.resolveRecordingDeVideo(tenantId, videoId);

    const { data, error } = await (this.supabase.client as any)
      .from('short_clips')
      .select('id, title, description, start_sec, end_sec, duration_sec, storage_key, transcript_snippet, created_at')
      .eq('tenant_id', tenantId)
      .eq('recording_id', rec.id)
      .eq('status', 'ready')
      // Ordre du RÉCIT, pas de la fabrication : les extraits se lisent dans l'ordre
      // où ils sont apparus dans la séance, c'est ce que l'œil attend d'une liste
      // rattachée à un replay.
      .order('start_sec', { ascending: true });
    if (error) throw new Error(`Extraits illisibles : ${error.message}`);

    // Présignatures en parallèle : cinq allers-retours en série ajouteraient une
    // demi-seconde visible à l'ouverture du panneau.
    const clips = await Promise.all(
      (data || []).map(async (c: any) => ({
        id: c.id,
        titre: c.title || null,
        description: c.description || null,
        debut_sec: c.start_sec ?? null,
        fin_sec: c.end_sec ?? null,
        duree_sec: c.duration_sec ?? null,
        extrait_texte: c.transcript_snippet || null,
        // `null` si la présignature échoue (variables R2 absentes) : l'écran doit
        // pouvoir dire « fichier indisponible » au lieu de servir un lecteur mort.
        url: await this.presignR2(c.storage_key, 6 * 3600),
        // ⚠️ UNE SECONDE URL, ET CE N'EST PAS UN DOUBLON. L'attribut `download` d'un
        // <a> est IGNORÉ par les navigateurs quand la cible est sur un autre domaine
        // — et R2 en est un. Le bouton « Télécharger » aurait donc ouvert la vidéo
        // dans un onglet au lieu de l'enregistrer. La seule façon d'imposer le
        // téléchargement est que le stockage réponde `Content-Disposition:
        // attachment`, ce que R2 fait si on le lui demande DANS l'URL présignée.
        url_telechargement: await this.presignR2(c.storage_key, 6 * 3600, {
          nomFichier: `${this.nomDeFichier(c.title)}.mp4`,
        }),
      })),
    );
    // ⭐ CE QUI A ÉTÉ ÉCARTÉ VOYAGE AVEC CE QUI A ÉTÉ GARDÉ. Le moteur refuse
    // désormais des passages plutôt que de livrer du bavardage de fin de séance ou
    // un titre que le clip ne tient pas. Renvoyer les extraits sans les refus
    // laisserait le créateur devant « 2 extraits » là où il en attendait 5, sans
    // aucun moyen de savoir pourquoi — ni de contester.
    const refus = Array.isArray(rec?.shorts_refus) ? rec.shorts_refus : [];
    return {
      clips,
      refus: refus.map((r: any) => ({
        debut_sec: Number(r?.start) || 0,
        fin_sec: Number(r?.end) || 0,
        titre: r?.titre || null,
        code: String(r?.code || 'INCONNU'),
        motif: String(r?.detail || ''),
        extrait_texte: r?.extrait_texte || null,
      })),
    };
  }

  /**
   * Un titre d'extrait → un nom de fichier sûr. Les titres viennent d'un modèle et
   * contiennent apostrophes, virgules et accents ; `Content-Disposition` ne tolère
   * ni guillemet ni retour à la ligne, et un nom vide donnerait « .mp4ted ».
   */
  private nomDeFichier(titre: unknown): string {
    const base = String(titre ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')  // accents
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60);
    return base || 'extrait';
  }

  /**
   * ENREGISTRE une demande de fabrication d'extraits pour UN replay.
   *
   * Cette méthode ne fabrique RIEN : elle pose un drapeau que le poller du worker
   * viendra prendre. C'est délibéré — la chaîne (téléchargement R2 du fichier
   * complet, transcription, découpe ffmpeg, remontée R2) se compte en minutes et
   * ne peut pas tenir dans une requête HTTP.
   *
   * IDEMPOTENTE : si une fabrication est déjà en file ('demande') ou en cours
   * ('encours'), on renvoie l'état sans rien réécrire. Sans cette garde, un
   * double-clic remettrait la ligne en tête de file et ferait retélécharger un
   * fichier de plusieurs centaines de Mo pour rien.
   */
  async requestReplayShorts(tenantId: string, videoId: string): Promise<ReplayShortsState> {
    const rec = await this.resolveRecordingDeVideo(tenantId, videoId);
    const clips = (await this.countClipsPrets(tenantId, [rec.id])).get(rec.id) || 0;
    const etat = this.mapShortsEtat(rec.shorts_status);

    if (etat === 'demande' || etat === 'encours') {
      return this.formatShortsState(rec, clips);
    }

    // Sans fichier sur le stockage de l'école, le worker n'aurait rien à ouvrir :
    // on le dit maintenant plutôt que de laisser une demande échouer dans dix minutes.
    if (!rec.storage_key) {
      throw new BadRequestException(
        "Ce replay n'est pas encore déposé sur le stockage de l'école : il n'y a rien à découper pour l'instant.",
      );
    }

    const demandeLe = new Date().toISOString();
    const { error } = await (this.supabase.client as any)
      .from('zoom_recordings')
      .update({
        shorts_status: SHORTS_DEMANDE,
        // Ordre d'arrivée de la file du worker : sans cet horodatage, la demande
        // se retrouverait derrière toutes celles qui en portent un.
        shorts_requested_at: demandeLe,
        // On efface le motif du tour précédent : le garder ferait afficher
        // « Échec : … » sur une fabrication qui vient d'être relancée.
        shorts_error: null,
        // Remise à zéro du compteur d'essais : le worker renonce au bout de trois
        // prises en charge (fail-closed, il ne retente jamais seul). Un clic humain
        // EST la décision de repartir — sans cette remise à zéro, « Relancer la
        // fabrication » retomberait immédiatement en échec sur un replay déjà
        // épuisé, sans qu'aucun travail ne soit tenté.
        shorts_attempts: 0,
        updated_at: demandeLe,
      })
      .eq('id', rec.id)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`Demande non enregistrée : ${error.message}`);

    this.logger.log(`[shorts] Demande enregistrée pour zoom_recording ${rec.id} (tenant ${tenantId})`);
    return {
      state: 'demande',
      clips,
      error_message: null,
      requested_at: demandeLe,
      // Le drapeau reste vrai APRÈS la demande : l'écran continue de dire pourquoi
      // les extraits sortiront nus, au lieu de laisser croire à un incident.
      sans_transcription: this.manqueTranscription(rec),
    };
  }

  // ── Présignature R2 (lecture) ─────────────────────────────────────────────
  private async presignR2(
    key: string,
    ttlSeconds = 604800,
    // `nomFichier` demande à R2 de répondre `Content-Disposition: attachment` —
    // le SEUL moyen d'obtenir un vrai téléchargement depuis un autre domaine (voir
    // `listReplayShorts`). Absent = lecture en ligne, le comportement par défaut.
    opts: { nomFichier?: string } = {},
  ): Promise<string | null> {
    const accountId = process.env.CF_R2_ACCOUNT_ID;
    const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;
    const bucket = process.env.CF_R2_BUCKET;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !key) return null;
    try {
      const client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
      return await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ...(opts.nomFichier
            ? { ResponseContentDisposition: `attachment; filename="${opts.nomFichier}"` }
            : {}),
        }),
        { expiresIn: ttlSeconds },
      );
    } catch (err) {
      this.logger.error(`presignR2 failed: ${(err as Error).message}`);
      return null;
    }
  }

  async unpublishVideo(videoId: string) {
    await (this.supabase.client as any)
      .from('published_videos')
      .update({ is_public: false })
      .eq('id', videoId);
  }
}
