import { Injectable } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      { auth: { persistSession: false } }
    );
  }

  async verifyToken(token: string) {
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email };
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
