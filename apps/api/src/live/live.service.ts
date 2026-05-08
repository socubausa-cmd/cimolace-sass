import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class LiveService {
  constructor(private auth: AuthService) {}
  private get supabase() { return this.auth.getClient(); }

  async createSession(tenantId: string, data: any) {
    const { data: session } = await this.supabase.from("live_sessions").insert({ tenant_id: tenantId, ...data, status: "scheduled" }).select().single();
    return session;
  }
  async findAll(tenantId: string) {
    const { data } = await this.supabase.from("live_sessions").select("*").eq("tenant_id", tenantId).order("scheduled_at", { ascending: true });
    return data ?? [];
  }
  async generateToken(sessionId: string, userId: string, role: "host" | "student") {
    // Placeholder: in production, call LiveKit API to generate token
    return { token: "livekit_jwt_placeholder", room: sessionId, role, userId };
  }
}
