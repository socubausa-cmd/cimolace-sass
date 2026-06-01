import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';

type AuthRequest = Request & {
  user?: {
    id?: string;
    email?: string;
  };
};

const STAFF_ROLES = new Set(['owner', 'admin', 'support']);

function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    String(raw || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

@Injectable()
export class CimolaceStaffGuard implements CanActivate {
  private readonly adminEmails: Set<string>;

  constructor(
    private readonly supabase: SupabaseService,
    config: ConfigService,
  ) {
    this.adminEmails = parseAdminEmails(
      config.get<string>('CIMOLACE_BACKOFFICE_ADMIN_EMAILS'),
    );
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const userId = req.user?.id;
    const email = String(req.user?.email || '').toLowerCase();

    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    if (email && this.adminEmails.has(email)) {
      return true;
    }

    const { data: staff, error: staffError } = await (
      this.supabase.client as any
    )
      .from('cimolace_staff_members')
      .select('role,status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (!staffError && staff?.role && STAFF_ROLES.has(staff.role)) {
      return true;
    }

    const { data: profile, error: profileError } = await (
      this.supabase.client as any
    )
      .from('profiles')
      .select('metadata,status')
      .eq('id', userId)
      .maybeSingle();

    if (
      !profileError &&
      profile?.status === 'active' &&
      profile?.metadata?.cimolace_staff === true
    ) {
      return true;
    }

    throw new ForbiddenException('Accès réservé au staff Cimolace');
  }
}
