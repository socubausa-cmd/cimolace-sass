import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MasterclassFactoryService {
  constructor(private readonly supabase: SupabaseService) {}

  async generateFromText(tenantId: string, userId: string, title: string, sourceText: string) {
    const modules = this.inferModules(sourceText);
    const { data: masterclass } = await (this.supabase.client as any).from('masterclasses').insert({ tenant_id: tenantId, created_by: userId, title, source_text: sourceText, module_count: modules.length }).select('*').single();
    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      const { data: mod } = await (this.supabase.client as any).from('masterclass_modules').insert({ tenant_id: tenantId, masterclass_id: masterclass.id, title: m.title, content: m.content, order_index: i }).select('*').single();
      for (let j = 0; j < m.lessons.length; j++) {
        const l = m.lessons[j];
        await (this.supabase.client as any).from('masterclass_lessons').insert({ tenant_id: tenantId, module_id: mod.id, title: l.title, content: l.content, order_index: j });
      }
    }
    return masterclass;
  }

  async listMasterclasses(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('masterclasses').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async getMasterclass(tenantId: string, id: string) {
    const { data: mc } = await (this.supabase.client as any).from('masterclasses').select('*').eq('id', id).eq('tenant_id', tenantId).single();
    const { data: modules } = await (this.supabase.client as any).from('masterclass_modules').select('*').eq('masterclass_id', id).order('order_index');
    return { ...mc, modules: modules ?? [] };
  }

  async analyzeDocument(tenantId: string, url: string) {
    return { url, status: 'analyzed', summary: 'Analyse du document en attente de traitement IA.', keyPoints: [] };
  }

  private inferModules(text: string): { title: string; content: string; lessons: { title: string; content: string }[] }[] {
    const chapters = text.split(/\n(?:#{1,3}\s+|(?:Chapitre|Module)\s*\d+)/i).filter(c => c.trim());
    if (chapters.length < 2) return [{ title: 'Module 1', content: text.slice(0, 500), lessons: [{ title: 'Leçon 1', content: text.slice(0, 300) }] }];
    return chapters.map((c, i) => {
      const lines = c.trim().split('\n').filter(l => l.trim());
      const title = lines[0]?.slice(0, 100) || `Module ${i + 1}`;
      const content = lines.slice(1).join('\n').slice(0, 2000) || lines[0];
      return { title, content, lessons: [{ title: `Leçon ${i + 1}.1`, content: content.slice(0, 500) }] };
    });
  }
}
