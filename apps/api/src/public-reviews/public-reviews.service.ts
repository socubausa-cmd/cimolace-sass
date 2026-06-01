/**
 * PublicReviewsService — avis publics du site + privileged links.
 *
 * Tables :
 *   - site_reviews (MANQUANTE en DB courante)
 *   - privileged_links (EXISTE)
 *   - privileged_link_redemptions (MANQUANTE)
 *   - privileged_access_grants (MANQUANTE)
 *   - appointment_feedback (EXISTE — utilisé en fallback dans list)
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PublicReviewsService {
  private readonly logger = new Logger(PublicReviewsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  // ─── 1. List public reviews ───────────────────────────────────────────────

  async listReviews(params: { limit?: number; source?: string }) {
    const limit = Math.min(24, Math.max(3, Number(params.limit ?? 9) || 9));
    const sourceFilter =
      params.source === 'isna' || params.source === 'ngowazulu' ? params.source : null;

    let curatedRows: any[] = [];
    try {
      let q = (this.supabase.client as any)
        .from('site_reviews')
        .select(
          'id,source,author_name,author_role,rating,review_text,is_verified,submitted_at',
        )
        .eq('status', 'approved')
        .order('submitted_at', { ascending: false })
        .limit(limit);
      if (sourceFilter) q = q.eq('source', sourceFilter);
      const { data, error } = await q;
      if (!error) curatedRows = data ?? [];
    } catch (e) {
      this.logger.warn(`site_reviews missing: ${(e as Error).message}`);
    }

    // Fallback: appointment_feedback (table existe)
    let feedbackRows: any[] = [];
    try {
      const { data } = await (this.supabase.client as any)
        .from('appointment_feedback')
        .select('appointment_id,student_id,rating,comment,submitted_at')
        .gte('rating', 4)
        .not('comment', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(30);
      feedbackRows = data ?? [];
    } catch (e) {
      this.logger.warn(`appointment_feedback: ${(e as Error).message}`);
    }

    const studentIds = Array.from(
      new Set(feedbackRows.map((r: any) => r.student_id).filter(Boolean)),
    );
    let profilesById = new Map<string, any>();
    if (studentIds.length) {
      const { data: profs } = await (this.supabase.client as any)
        .from('profiles')
        .select('id,name')
        .in('id', studentIds);
      profilesById = new Map((profs ?? []).map((p: any) => [p.id, p]));
    }

    const feedbackAsReviews = feedbackRows
      .map((row: any) => {
        const profile = profilesById.get(row.student_id);
        const firstName = String(profile?.name ?? '').trim().split(' ')[0] || 'Membre';
        const comment = String(row.comment ?? '').trim().slice(0, 700);
        if (!comment || comment.length < 15) return null;
        return {
          id: `fb-${row.appointment_id}`,
          source: 'isna',
          author_name: `${firstName} (membre)`,
          author_role: 'Membre vérifié',
          rating: Number(row.rating ?? 0),
          review_text: comment,
          is_verified: true,
          submitted_at: row.submitted_at,
        };
      })
      .filter(Boolean) as any[];

    const merged = [...curatedRows, ...feedbackAsReviews]
      .sort(
        (a: any, b: any) =>
          +new Date(b.submitted_at) - +new Date(a.submitted_at),
      )
      .slice(0, limit);

    const summarize = (rows: any[]) => {
      const total = rows.length;
      const avg =
        total > 0
          ? Number(
              (rows.reduce((acc, r) => acc + Number(r.rating ?? 0), 0) / total).toFixed(2),
            )
          : 0;
      return { total, average: avg };
    };

    return {
      ok: true,
      reviews: merged,
      summary: {
        global: summarize(merged),
        isna: summarize(merged.filter((r) => r.source === 'isna')),
        ngowazulu: summarize(merged.filter((r) => r.source === 'ngowazulu')),
      },
    };
  }

  // ─── 2. Submit review (anti-spam) ─────────────────────────────────────────

  private hashIp(ip: string): string {
    const salt =
      this.config.get<string>('REVIEWS_SPAM_SALT') ?? 'cimolace-site-reviews';
    return createHash('sha256').update(`${salt}:${ip || 'unknown'}`).digest('hex');
  }

  async submitReview(
    input: {
      source?: string;
      authorName?: string;
      authorRole?: string;
      reviewText?: string;
      rating?: number;
      website?: string;
      filledInMs?: number;
    },
    headers: { userAgent?: string; xForwardedFor?: string },
  ) {
    const clean = (v: any, max: number) =>
      String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

    const source = clean(input.source, 20).toLowerCase();
    const authorName = clean(input.authorName, 80);
    const authorRole = clean(input.authorRole, 80) || null;
    const reviewText = clean(input.reviewText, 1200);
    const rating = Number(input.rating);
    const website = clean(input.website, 200);
    const filledInMs = Number(input.filledInMs ?? 0);
    const userAgent = clean(headers.userAgent, 300);
    const clientIp = (headers.xForwardedFor ?? '').split(',')[0].trim();
    const ipHash = this.hashIp(clientIp);

    if (!['isna', 'ngowazulu'].includes(source)) {
      throw new BadRequestException('source must be isna or ngowazulu');
    }
    if (!authorName || authorName.length < 2) {
      throw new BadRequestException('authorName requis');
    }
    if (!reviewText || reviewText.length < 15) {
      throw new BadRequestException('reviewText doit faire au moins 15 caractères');
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('rating doit être un entier 1-5');
    }
    if (website) throw new BadRequestException('Soumission invalide');
    if (filledInMs > 0 && filledInMs < 3000) {
      throw new BadRequestException('Soumission trop rapide.');
    }

    // Spam signals
    const spamSignals: string[] = [];
    if (filledInMs > 0 && filledInMs < 5000) spamSignals.push('very_fast_submit');
    if (reviewText.length < 40) spamSignals.push('short_text');
    if ((reviewText.match(/https?:\/\//gi) ?? []).length > 0) spamSignals.push('contains_link');
    const isSpamSuspected = spamSignals.length >= 2;

    try {
      const { error } = await (this.supabase.client as any).from('site_reviews').insert({
        source,
        author_name: authorName,
        author_role: authorRole,
        rating,
        review_text: reviewText,
        is_verified: false,
        status: 'pending',
        ip_hash: ipHash,
        submitted_user_agent: userAgent || null,
        is_spam_suspected: isSpamSuspected,
        spam_reason: spamSignals.length ? spamSignals.join(',') : null,
      });
      if (error) {
        this.logger.warn(`site_reviews insert: ${error.message}`);
        return {
          ok: false,
          error: 'site_reviews table indisponible (migration nécessaire)',
        };
      }
    } catch (e) {
      this.logger.warn(`site_reviews insert exception: ${(e as Error).message}`);
      return { ok: false, error: 'site_reviews table indisponible' };
    }

    return { ok: true, message: 'Avis reçu. Il sera publié après validation.' };
  }

  // ─── 3. Privileged link create ────────────────────────────────────────────

  private slug(): string {
    return randomBytes(12).toString('base64url').replace(/[-_]/g, 'x').slice(0, 16);
  }

  async createPrivilegedLink(
    tenantId: string,
    requesterId: string,
    requesterRole: string,
    input: any,
  ) {
    if (requesterRole.toLowerCase() !== 'owner') {
      throw new ForbiddenException('Only owner can create privileged links');
    }

    const name = input.name ? String(input.name).trim() : null;
    const planId = input.planId ?? input.plan_id ?? null;
    const durationDays = Math.min(
      365,
      Math.max(1, Number(input.durationDays ?? input.duration_days ?? 30) || 30),
    );
    const maxUses =
      input.maxUses != null ? Math.max(1, Number(input.maxUses) || 1) : null;
    const singleUse = Boolean(input.singleUse ?? input.single_use ?? false);
    const restrictedEmail =
      input.restrictedEmail || input.restricted_email
        ? String(input.restrictedEmail ?? input.restricted_email)
            .trim()
            .toLowerCase()
        : null;
    const validityDays = Math.min(
      365,
      Math.max(1, Number(input.validityDays ?? input.validity_days ?? 30) || 30),
    );
    const roleToAssign =
      input.roleToAssign || input.role_to_assign
        ? String(input.roleToAssign ?? input.role_to_assign).trim()
        : null;
    const accessType = ['full', 'partial', 'test', 'demo'].includes(
      String(input.accessType ?? input.access_type ?? 'full'),
    )
      ? String(input.accessType ?? input.access_type ?? 'full')
      : 'full';
    const internalNote = input.internalNote ?? input.internal_note ?? null;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    let s = this.slug();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await (this.supabase.client as any)
        .from('privileged_links')
        .select('id')
        .eq('slug', s)
        .maybeSingle();
      if (!existing) break;
      s = this.slug();
    }

    const { data: link, error } = await (this.supabase.client as any)
      .from('privileged_links')
      .insert({
        slug: s,
        name,
        plan_id: planId,
        duration_days: durationDays,
        max_uses: maxUses,
        single_use: singleUse,
        restricted_email: restrictedEmail,
        expires_at: expiresAt.toISOString(),
        role_to_assign: roleToAssign,
        access_type: accessType,
        internal_note: internalNote,
        created_by: requesterId,
        status: 'active',
        cimolace_tenant_id: tenantId,
      })
      .select(
        'id, slug, name, plan_id, duration_days, max_uses, single_use, restricted_email, expires_at, status',
      )
      .single();

    if (error) throw new BadRequestException(error.message);

    const origin =
      this.config.get<string>('APP_BASE_URL') ?? 'https://app.cimolace.com';
    return {
      ok: true,
      link,
      url: `${origin.replace(/\/$/, '')}/redeem/${link.slug}`,
    };
  }

  // ─── 4. Privileged link redeem ────────────────────────────────────────────

  async redeemPrivilegedLink(input: { slug?: string; userId?: string; userEmail?: string }) {
    const slug = String(input.slug ?? '').trim();
    if (!slug) throw new BadRequestException('slug requis');
    if (!input.userId) throw new BadRequestException('userId requis (auth)');

    const { data: link, error } = await (this.supabase.client as any)
      .from('privileged_links')
      .select(
        'id, slug, plan_id, duration_days, max_uses, use_count, single_use, restricted_email, status, expires_at',
      )
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!link) throw new NotFoundException('Link not found');
    if (link.status !== 'active') {
      throw new BadRequestException('Link is no longer active');
    }
    if (new Date(link.expires_at) < new Date()) {
      throw new BadRequestException('Link has expired');
    }
    if (link.max_uses != null && (link.use_count ?? 0) >= link.max_uses) {
      throw new BadRequestException('Link usage limit reached');
    }

    const userEmail = (input.userEmail ?? '').toLowerCase();
    if (link.restricted_email && link.restricted_email.toLowerCase() !== userEmail) {
      throw new ForbiddenException('This link is restricted to another email');
    }

    // privileged_link_redemptions table may be missing
    try {
      const { data: existing } = await (this.supabase.client as any)
        .from('privileged_link_redemptions')
        .select('id')
        .eq('link_id', link.id)
        .eq('user_id', input.userId)
        .maybeSingle();
      if (existing) {
        return { ok: true, already_redeemed: true, message: 'Access already active' };
      }
      await (this.supabase.client as any)
        .from('privileged_link_redemptions')
        .insert({ link_id: link.id, user_id: input.userId });
    } catch (e) {
      this.logger.warn(
        `privileged_link_redemptions table may be missing: ${(e as Error).message}`,
      );
    }

    const startAt = new Date();
    const endAt = new Date();
    endAt.setDate(endAt.getDate() + (link.duration_days ?? 30));

    await (this.supabase.client as any)
      .from('privileged_links')
      .update({
        use_count: (link.use_count ?? 0) + 1,
        status:
          link.single_use ||
          (link.max_uses != null && (link.use_count ?? 0) + 1 >= link.max_uses)
            ? 'used_up'
            : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', link.id);

    // privileged_access_grants table may be missing
    try {
      await (this.supabase.client as any).from('privileged_access_grants').insert({
        user_id: input.userId,
        link_id: link.id,
        plan_id: link.plan_id ?? null,
        access_start: startAt.toISOString(),
        access_end: endAt.toISOString(),
      });
    } catch (e) {
      this.logger.warn(
        `privileged_access_grants table may be missing: ${(e as Error).message}`,
      );
    }

    return {
      ok: true,
      message: 'Access granted',
      access_start: startAt.toISOString(),
      access_end: endAt.toISOString(),
    };
  }
}
