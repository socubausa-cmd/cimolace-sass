import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * NARRATION PAR SCÈNE — Lot 4 du cahier des charges « Tableau Vivant »
 * (docs/CAHIER_DE_CHARGE_TABLEAU_VIVANT.md).
 *
 * La règle produit : UNE SCÈNE = UN AUDIO. Sans cela, le live n'est pas
 * scénarisé : le tableau se révèle au rythme des clics de l'hôte au lieu de
 * suivre la voix. Le Studio éditait déjà un `audioUrl` par scène et la régie
 * sait déjà naviguer sur un événement audio (`useLiveHostLiriAudioSync`) —
 * il ne manquait que le producteur. C'est ce service.
 *
 * Choix assumés :
 * - la synthèse passe par l'edge function `liri-tts` (déjà facturée et
 *   multi-fournisseur) : on ne réimplémente pas un client TTS ici ;
 * - un échec sur une scène n'annule pas les autres, il est TRACÉ et rendu à
 *   l'appelant (une narration partielle vaut mieux qu'un direct muet) ;
 * - une scène déjà narrée est sautée sauf `force` : régénérer coûte des jetons.
 */

const AUDIO_BUCKET = 'scene-audio';
/** Limite dure de l'edge function TTS — au-delà, la voix est tronquée en silence. */
const TTS_MAX_CHARS = 4500;

export interface SceneAudioResult {
  ok: boolean;
  liveSessionId: string;
  total: number;
  generated: number;
  skipped: number;
  failed: { sceneId: string; reason: string }[];
  /** Vrai si la colonne `audio_url` manquait : l'URL n'est alors QUE dans le JSON. */
  columnFallback: boolean;
}

@Injectable()
export class SceneAudioService {
  private readonly log = new Logger(SceneAudioService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private get db(): any {
    return this.supabase.client as any;
  }

  /**
   * Le service tourne en service_role : la RLS ne protège rien ici, c'est donc à
   * NOUS de vérifier que la session appartient bien au tenant appelant.
   * Volontairement redéclaré au lieu d'être importé de MasterFactoryService :
   * une garde de sécurité doit rester lisible dans le fichier qu'elle protège.
   */
  private async requireSessionOfTenant(tenantId: string, liveSessionId: string) {
    if (!liveSessionId) throw new BadRequestException('liveSessionId manquant');
    const { data, error } = await this.db
      .from('live_sessions')
      .select('id, tenant_id, title')
      .eq('id', liveSessionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException(error.message);
    if (!data) throw new NotFoundException('Live introuvable pour ce tenant.');
    return data;
  }

  /** Compte ce qui est narré, pour que l'atelier affiche un « N/M » honnête. */
  async status(tenantId: string, liveSessionId: string) {
    await this.requireSessionOfTenant(tenantId, liveSessionId);
    const scenes = await this.loadScenes(liveSessionId);
    const withAudio = scenes.filter((scene) => !!this.readAudioUrl(scene)).length;
    return {
      liveSessionId,
      total: scenes.length,
      withAudio,
      withoutAudio: scenes.length - withAudio,
    };
  }

  async generateForSession(
    tenantId: string,
    userId: string,
    liveSessionId: string,
    /**
     * `accessToken` = le JWT de l'enseignant appelant. Il est OBLIGATOIRE : la
     * fonction `liri-tts` authentifie par `auth.getUser(token)` et refuse la clé
     * service_role (HTTP 401 « Invalid token »). C'est voulu — la synthèse est
     * facturée à un utilisateur réel, pas à l'infrastructure.
     */
    opts: { force?: boolean; languageCode?: string; accessToken?: string } = {},
  ): Promise<SceneAudioResult> {
    await this.requireSessionOfTenant(tenantId, liveSessionId);
    const scenes = await this.loadScenes(liveSessionId);
    if (!scenes.length) throw new NotFoundException("Cette session n'a aucune scène à narrer.");

    const scriptSections = await this.loadScriptSections(liveSessionId);
    const languageCode = String(opts.languageCode || 'fr');
    const accessToken = String(opts.accessToken || '').trim();
    if (!accessToken) {
      throw new BadRequestException(
        "Jeton d'authentification absent : la synthèse vocale exige l'identité de l'enseignant.",
      );
    }

    let generated = 0;
    let skipped = 0;
    let columnFallback = false;
    const failed: { sceneId: string; reason: string }[] = [];

    for (const scene of scenes) {
      if (!opts.force && this.readAudioUrl(scene)) {
        skipped += 1;
        continue;
      }
      const narration = this.narrationTextFor(scene, scriptSections);
      if (!narration) {
        failed.push({ sceneId: String(scene.id), reason: 'aucun texte à narrer' });
        continue;
      }
      try {
        const audio = await this.synthesize(narration, languageCode, accessToken);
        const publicUrl = await this.storeAudio(tenantId, liveSessionId, String(scene.id), audio);
        const wroteColumn = await this.attachAudio(scene, publicUrl);
        if (!wroteColumn) columnFallback = true;
        generated += 1;
      } catch (error) {
        const reason = String((error as Error)?.message || error).slice(0, 300);
        this.log.warn(`[scene-audio] scène ${scene.id} échouée : ${reason}`);
        failed.push({ sceneId: String(scene.id), reason });
      }
    }

    this.log.log(
      `[scene-audio] session ${liveSessionId} — ${generated} générée(s), ${skipped} sautée(s), ${failed.length} échec(s)`,
    );
    return {
      ok: failed.length === 0,
      liveSessionId,
      total: scenes.length,
      generated,
      skipped,
      failed,
      columnFallback,
    };
  }

  private async loadScenes(liveSessionId: string) {
    // `audio_url` peut ne pas exister si la migration n'est pas appliquée : on
    // demande donc `*` plutôt qu'une liste de colonnes qui ferait échouer TOUT.
    const { data, error } = await this.db
      .from('live_scenes')
      .select('*')
      .eq('live_session_id', liveSessionId)
      .order('order_index', { ascending: true });
    if (error) throw new ServiceUnavailableException(error.message);
    return (data || []) as any[];
  }

  private async loadScriptSections(liveSessionId: string) {
    const { data } = await this.db
      .from('live_script_sections')
      .select('order_index, title, master_agent')
      .eq('session_id', liveSessionId)
      .order('order_index', { ascending: true });
    return (data || []) as any[];
  }

  private readAudioUrl(scene: any): string {
    const payload = scene?.content_payload_json;
    const fromJson = payload && typeof payload === 'object' ? payload.audio_url : null;
    return String(scene?.audio_url || fromJson || '').trim();
  }

  /**
   * Ce que la voix doit dire sur cette scène. Ordre de préférence : le discours
   * réel du prof (prompteur) d'abord — c'est lui qui est écrit pour être dit —
   * puis les intentions de la scène en secours.
   */
  private narrationTextFor(scene: any, scriptSections: any[]): string {
    const payload = scene?.content_payload_json && typeof scene.content_payload_json === 'object'
      ? scene.content_payload_json
      : {};
    const ia = payload.ia_data && typeof payload.ia_data === 'object' ? payload.ia_data : {};
    const section = scriptSections.find((s) => Number(s.order_index) === Number(scene.order_index));
    const agent = section?.master_agent && typeof section.master_agent === 'object' ? section.master_agent : {};

    const candidates = [
      agent.teacher_script,
      ia.core_idea,
      payload.slide_hint,
      ia.slide_summary,
      scene.name,
    ];
    for (const candidate of candidates) {
      const text = String(candidate || '').trim();
      if (text.length >= 10) return text.slice(0, TTS_MAX_CHARS);
    }
    return '';
  }

  private async synthesize(text: string, languageCode: string, accessToken: string): Promise<Uint8Array> {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    if (!supabaseUrl) {
      throw new ServiceUnavailableException('Configuration Supabase incomplète pour la synthèse vocale.');
    }
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/liri-tts`, {
      method: 'POST',
      headers: {
        // JWT de l'enseignant, pas la clé de service : cf. commentaire de generateForSession.
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, languageCode, tier: 'postprod' }),
      signal: AbortSignal.timeout(120_000),
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`TTS HTTP ${response.status} : ${raw.slice(0, 200)}`);
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Réponse TTS illisible (JSON attendu).');
    }
    const base64 = String(parsed?.audioBase64 || '');
    if (!base64) throw new Error('Réponse TTS sans audio.');
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }

  private async storeAudio(
    tenantId: string,
    liveSessionId: string,
    sceneId: string,
    bytes: Uint8Array,
  ): Promise<string> {
    const path = `${tenantId}/${liveSessionId}/${sceneId}.mp3`;
    const storage = this.db.storage.from(AUDIO_BUCKET);
    const { error } = await storage.upload(path, bytes, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    if (error) {
      const message = String(error.message || error);
      if (/bucket/i.test(message) && /not found|does not exist/i.test(message)) {
        throw new Error(
          `Le bucket de stockage « ${AUDIO_BUCKET} » n'existe pas : crée-le dans Supabase Storage avant de générer les narrations.`,
        );
      }
      throw new Error(`Envoi de l'audio impossible : ${message}`);
    }
    // La voix du professeur n'est pas un contenu public : on rend une URL signée
    // de longue durée plutôt qu'un lien permanent devinable.
    const { data: signed, error: signError } = await storage.createSignedUrl(path, 60 * 60 * 24 * 30);
    if (signError || !signed?.signedUrl) {
      throw new Error(`URL de lecture impossible : ${String(signError?.message || 'inconnue')}`);
    }
    return signed.signedUrl;
  }

  /**
   * Double écriture : colonne `audio_url` ET `content_payload_json.audio_url`.
   * La colonne peut manquer si la migration n'est pas encore appliquée en prod —
   * dans ce cas on n'échoue pas, on retombe sur le JSON et on le SIGNALE
   * (`columnFallback`) au lieu de laisser croire que tout est en place.
   */
  private async attachAudio(scene: any, publicUrl: string): Promise<boolean> {
    const payload = scene?.content_payload_json && typeof scene.content_payload_json === 'object'
      ? scene.content_payload_json
      : {};
    const nextPayload = { ...payload, audio_url: publicUrl };

    const withColumn = await this.db
      .from('live_scenes')
      .update({ audio_url: publicUrl, content_payload_json: nextPayload })
      .eq('id', scene.id);
    if (!withColumn.error) return true;

    const jsonOnly = await this.db
      .from('live_scenes')
      .update({ content_payload_json: nextPayload })
      .eq('id', scene.id);
    if (jsonOnly.error) throw new Error(`Écriture de l'audio impossible : ${jsonOnly.error.message}`);
    return false;
  }
}
