/**
 * social-poster.js — Pont shorts → réseaux sociaux (BROUILLONS).
 *
 * Pour chaque short_clip 'ready' sans social_post, Longia (DeepSeek) rédige une
 * légende + des hashtags adaptés à chaque plateforme, et on crée un social_post
 * en BROUILLON (status='draft'). La PUBLICATION réelle reste manuelle (validation
 * humaine + OAuth des comptes = Phase 2). On ne poste donc JAMAIS automatiquement
 * sur les réseaux sans action explicite.
 *
 * Secrets : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEEPSEEK_API_KEY.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

// Plateformes pour lesquelles on prépare un brouillon par clip.
const TARGET_PLATFORMS = ['tiktok', 'facebook', 'instagram'];

const PLATFORM_HINTS = {
  tiktok: 'TikTok : accroche très courte et percutante, ton direct, 3-5 hashtags tendance.',
  facebook: 'Facebook Reels : phrase claire et chaleureuse, 2-4 hashtags.',
  instagram: 'Instagram Reels : légende engageante, emojis bienvenus, 5-8 hashtags.',
  linkedin: 'LinkedIn : ton professionnel, 1-2 phrases de valeur, 3-5 hashtags pros.',
};

// Cerveau Longia (DeepSeek) — aligné sur LongiaService.shortCaption côté API.
async function generateCaption(transcriptSnippet, platform, title) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const fallback = {
    caption:
      (title ? `${title} — ` : '') +
      String(transcriptSnippet || '').slice(0, 120).trim(),
    hashtags: ['#live', '#replay', '#école'],
  };
  if (!apiKey || apiKey === 'replace_me') return fallback;
  const sys =
    `Tu es Longia, l'assistant social media de l'école. Rédige UNE légende courte et accrocheuse en FRANÇAIS pour promouvoir ce clip de live, ton inspirant. ${PLATFORM_HINTS[platform] || ''} ` +
    `Réponds UNIQUEMENT en JSON valide, sans texte autour ni backticks : {"caption":"...","hashtags":["#...","#..."]}.`;
  const user =
    (title ? `Titre du live : ${title}\n` : '') +
    `Extrait (transcript) : ${String(transcriptSnippet || '').slice(0, 1200)}`;
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        max_tokens: 600,
      }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    const raw = String(json.choices?.[0]?.message?.content || '')
      .replace(/```json|```/g, '')
      .trim();
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : raw);
    const caption = String(parsed.caption || '').trim();
    const hashtags = (Array.isArray(parsed.hashtags) ? parsed.hashtags : [])
      .map((h) => String(h).trim())
      .filter(Boolean)
      .map((h) => (h.startsWith('#') ? h : '#' + h.replace(/^#+/, '')));
    return caption ? { caption, hashtags } : fallback;
  } catch {
    return fallback;
  }
}

// ─── Poller : short_clips 'ready' sans social_posts → brouillons par plateforme ──
export async function pollDraftSocialPosts() {
  try {
    const { data: clips, error } = await supabase
      .from('short_clips')
      .select('id, tenant_id, title, transcript_snippet, live_session_id')
      .eq('status', 'ready')
      .limit(3);
    if (error) throw error;
    if (!clips || clips.length === 0) return 0;

    let count = 0;
    for (const clip of clips) {
      // Idempotence : si des posts existent déjà pour ce clip, on saute.
      const { data: existing } = await supabase
        .from('social_posts')
        .select('id')
        .eq('short_clip_id', clip.id)
        .limit(1);
      if (existing && existing.length > 0) continue;

      for (const platform of TARGET_PLATFORMS) {
        const { caption, hashtags } = await generateCaption(
          clip.transcript_snippet || '',
          platform,
          clip.title,
        );
        const { error: insErr } = await supabase.from('social_posts').insert({
          short_clip_id: clip.id,
          live_session_id: clip.live_session_id,
          tenant_id: clip.tenant_id,
          platform,
          title: clip.title,
          description: caption,
          hashtags,
          status: 'draft',
        });
        if (!insErr) count++;
      }
      console.log(`[social-poster] brouillons créés pour le clip ${clip.id}`);
    }
    return count;
  } catch (err) {
    console.error(`[social-poster] Poll error: ${err.message}`);
    return 0;
  }
}
