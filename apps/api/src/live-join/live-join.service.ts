import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { LiveKitService } from '../livekit/livekit.service';

/**
 * Liens de live PROVISOIRES configurables (scénario A). Le prof choisit à la
 * création du lien :
 *   - 'class'      : UN code, rejouable par toute la classe jusqu'à expiry (QR).
 *   - 'individual' : N codes ONE-TIME (anti-partage : chacun n'entre qu'une fois).
 *
 * Le redeem est PUBLIC et anonyme : il délivre un TOKEN LiveKit VIEWER (subscribe-
 * only), JAMAIS une membership tenant. Séparation dure vs le code OTP d'accès (L5).
 */
@Injectable()
export class LiveJoinService {
  private readonly logger = new Logger(LiveJoinService.name);
  private static readonly ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  private static readonly CLASS_LEN = 6;
  private static readonly INDIV_LEN = 7;
  private static readonly MAX_INDIVIDUAL = 200;

  constructor(
    private readonly auth: AuthService,
    private readonly liveKit: LiveKitService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.auth.getClient();
  }

  private genCode(len: number): string {
    const { ALPHABET } = LiveJoinService;
    const b = randomBytes(len);
    let s = '';
    for (let i = 0; i < len; i += 1) s += ALPHABET[b[i] % ALPHABET.length];
    return s;
  }

  /**
   * Vérifie que `userId` a le droit de gérer les liens du live `sessionId` :
   * hôte/prof de la session, OU owner/admin du tenant. Renvoie la session.
   */
  private async assertCanManage(userId: string, sessionId: string) {
    const { data: session } = await this.db
      .from('live_sessions')
      .select('id, tenant_id, title, status, host_user_id, teacher_id, tenants(slug)')
      .eq('id', sessionId)
      .maybeSingle();
    if (!session) throw new NotFoundException('Live introuvable.');

    const isOwnerOfSession =
      session.host_user_id === userId || session.teacher_id === userId;
    if (!isOwnerOfSession) {
      const { data: mem } = await this.db
        .from('tenant_memberships')
        .select('role')
        .eq('tenant_id', session.tenant_id)
        .eq('user_id', userId)
        .maybeSingle();
      const role = String(mem?.role || '').toLowerCase();
      if (!['owner', 'admin'].includes(role)) {
        throw new ForbiddenException(
          "Seul l'animateur du live ou un admin peut gérer ses liens d'accès.",
        );
      }
    }
    return session;
  }

  /** Insère un code unique (retry sur collision UNIQUE(tenant,code)). */
  private async insertUniqueCode(row: {
    tenant_id: string;
    live_session_id: string;
    mode: 'class' | 'individual';
    label?: string | null;
    expires_at?: string | null;
    created_by?: string | null;
  }): Promise<{ code: string; id: string }> {
    const len = row.mode === 'class' ? LiveJoinService.CLASS_LEN : LiveJoinService.INDIV_LEN;
    for (let tries = 0; tries < 6; tries += 1) {
      const code = this.genCode(len);
      const { data, error } = await this.db
        .from('live_join_codes')
        .insert({ ...row, code, status: 'active' })
        .select('id, code')
        .single();
      if (!error && data) return { code: data.code, id: data.id };
      if (error && !/duplicate|unique/i.test(error.message || '')) {
        throw new BadRequestException(`Génération du code impossible : ${error.message}`);
      }
    }
    throw new BadRequestException('Génération du code impossible (réessayez).');
  }

  /**
   * Génère les liens d'accès d'un live.
   *  - mode 'class'      : réutilise le code de classe ACTIF s'il existe (une seule
   *    invitation de classe valable), sinon en crée un.
   *  - mode 'individual' : crée `count` codes one-time (ou un par nom de `students`).
   */
  async generate(
    userId: string,
    sessionId: string,
    input: { mode?: 'class' | 'individual'; count?: number; students?: string[]; expiresAt?: string | null },
  ) {
    const session = await this.assertCanManage(userId, sessionId);
    const mode = input.mode === 'individual' ? 'individual' : 'class';
    const expiresAt = input.expiresAt ?? null;
    const tenantSlug = session.tenants?.slug ?? null;
    const joinBase = `${process.env.SCHOOL_FRONTEND_URL ?? 'https://prorascience.org'}/live/rejoindre`;

    if (mode === 'class') {
      // Un seul code de classe actif : on réutilise l'existant.
      const { data: existing } = await this.db
        .from('live_join_codes')
        .select('id, code, expires_at')
        .eq('live_session_id', sessionId)
        .eq('mode', 'class')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      let code: string;
      if (existing?.code) {
        code = existing.code;
        if (expiresAt !== undefined) {
          await this.db.from('live_join_codes').update({ expires_at: expiresAt }).eq('id', existing.id);
        }
      } else {
        const created = await this.insertUniqueCode({
          tenant_id: session.tenant_id,
          live_session_id: sessionId,
          mode: 'class',
          expires_at: expiresAt,
          created_by: userId,
        });
        code = created.code;
      }
      return {
        mode: 'class',
        sessionTitle: session.title,
        codes: [{ code, joinUrl: `${joinBase}?code=${code}`, label: null }],
      };
    }

    // individual : un code one-time par élève (ou `count` codes anonymes).
    const students = Array.isArray(input.students) ? input.students.filter((s) => String(s || '').trim()) : [];
    const count = students.length > 0 ? students.length : Math.max(1, Math.min(LiveJoinService.MAX_INDIVIDUAL, Number(input.count) || 1));
    if (count > LiveJoinService.MAX_INDIVIDUAL) {
      throw new BadRequestException(`Maximum ${LiveJoinService.MAX_INDIVIDUAL} liens individuels à la fois.`);
    }
    const codes: Array<{ code: string; joinUrl: string; label: string | null }> = [];
    for (let i = 0; i < count; i += 1) {
      const label = students[i] ? String(students[i]).trim().slice(0, 120) : null;
      const created = await this.insertUniqueCode({
        tenant_id: session.tenant_id,
        live_session_id: sessionId,
        mode: 'individual',
        label,
        expires_at: expiresAt,
        created_by: userId,
      });
      codes.push({ code: created.code, joinUrl: `${joinBase}?code=${created.code}`, label });
    }
    return { mode: 'individual', sessionTitle: session.title, codes };
  }

  /** Liste les liens d'un live (gestion prof). */
  async list(userId: string, sessionId: string) {
    await this.assertCanManage(userId, sessionId);
    const { data } = await this.db
      .from('live_join_codes')
      .select('id, code, mode, status, label, expires_at, used_at, used_by_name, created_at')
      .eq('live_session_id', sessionId)
      .order('created_at', { ascending: false });
    return { codes: Array.isArray(data) ? data : [] };
  }

  /** Révoque un lien (le prof reprend la main). */
  async revoke(userId: string, sessionId: string, codeId: string) {
    await this.assertCanManage(userId, sessionId);
    await this.db
      .from('live_join_codes')
      .update({ status: 'revoked' })
      .eq('id', codeId)
      .eq('live_session_id', sessionId);
    return { ok: true };
  }

  /**
   * Redeem PUBLIC : (code, displayName) → token LiveKit VIEWER. Aucune membership.
   * 'individual' → consommation ATOMIQUE one-time (status active→used).
   */
  async redeem(input: { code: string; displayName?: string }) {
    const code = String(input.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) throw new BadRequestException("Code requis.");

    const { data: row } = await this.db
      .from('live_join_codes')
      .select('id, tenant_id, live_session_id, mode, status, expires_at')
      .eq('code', code)
      .maybeSingle();
    if (!row) throw new NotFoundException('Code invalide.');

    if (row.status === 'revoked') throw new ForbiddenException('Ce lien a été révoqué.');
    if (row.status === 'used') throw new ForbiddenException('Ce lien à usage unique a déjà été utilisé.');
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      await this.db.from('live_join_codes').update({ status: 'expired' }).eq('id', row.id);
      throw new ForbiddenException('Ce lien a expiré.');
    }

    const { data: session } = await this.db
      .from('live_sessions')
      .select('id, title, status, tenant_id, tenants(slug)')
      .eq('id', row.live_session_id)
      .maybeSingle();
    if (!session) throw new NotFoundException('Live introuvable.');

    const displayName = String(input.displayName || '').trim().slice(0, 60) || 'Invité';

    // 'individual' : consommation ATOMIQUE (le 2e usage met à jour 0 ligne → refus).
    if (row.mode === 'individual') {
      const { data: claimed } = await this.db
        .from('live_join_codes')
        .update({ status: 'used', used_at: new Date().toISOString(), used_by_name: displayName })
        .eq('id', row.id)
        .eq('status', 'active')
        .select('id');
      if (!claimed || claimed.length === 0) {
        throw new ForbiddenException('Ce lien à usage unique a déjà été utilisé.');
      }
    }

    const tenantSlug = session.tenants?.slug ?? session.tenant_id;
    const roomName = LiveKitService.scopedRoomName(tenantSlug, session.id);
    try {
      await this.liveKit.ensureRoom(roomName, session.id, `guest-${Date.now()}`);
    } catch (e) {
      // Live pas encore démarré → on émet quand même le token ; la connexion attendra.
      this.logger.warn(`ensureRoom (join): ${(e as Error).message}`);
    }
    const identity = `join-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const token = await this.liveKit.generateParticipantToken(roomName, identity, displayName);

    return {
      livekit_token: token,
      ws_url: this.liveKit.getUrl(),
      room_name: roomName,
      session_title: session.title ?? 'Live',
      session_status: session.status ?? 'scheduled',
    };
  }
}
