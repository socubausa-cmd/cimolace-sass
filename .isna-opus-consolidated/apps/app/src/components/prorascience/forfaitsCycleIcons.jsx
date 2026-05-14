import {
  Ban,
  BookOpen,
  Building2,
  CalendarDays,
  Eye,
  Flame,
  GraduationCap,
  HeartHandshake,
  Layers,
  LayoutDashboard,
  MonitorPlay,
  PlayCircle,
  Sparkles,
  Stethoscope,
  User,
  Users,
  Video,
  Zap,
} from 'lucide-react';

/** Icône explicite selon le libellé marketing (inclus / expérience). */
export function iconForOfferLine(text) {
  const t = String(text || '').toLowerCase();
  if (t.includes('préenregistré') || t.includes('cours pré') || t.includes('tout le cycle autonome'))
    return BookOpen;
  if (t.includes('smartboard') || t.includes('interactif')) return MonitorPlay;
  if (t.includes('replay')) return PlayCircle;
  if (t.includes('progression libre') || t.includes('progression encadrée')) return LayoutDashboard;
  if (t.includes('live') && t.includes('groupe')) return Users;
  if (t.includes('liri')) return Zap;
  if (t.includes('calendrier')) return CalendarDays;
  if (t.includes('coaching collectif')) return Users;
  if (t.includes('coaching individuel') || t.includes('séances privées')) return User;
  if (t.includes('atelier')) return HeartHandshake;
  if (t.includes('suivi spirituel')) return Flame;
  if (t.includes('tout le cycle académique') || t.includes('tout le cycle privé')) return Layers;
  if (t.includes('formation métier') || t.includes('diagnostiquer')) return Stethoscope;
  if (t.includes('cas pratiques') || t.includes('supervision')) return Eye;
  if (t.includes('temple') || t.includes('activité')) return Building2;
  if (t.includes('vidéo') || t.includes('cours')) return Video;
  if (t.includes('rythme') || t.includes('compétence')) return GraduationCap;
  if (t.includes('intimité') || t.includes('précision')) return HeartHandshake;
  if (t.includes('accélérée') || t.includes('transformation')) return Sparkles;
  return Sparkles;
}

export function iconForExcludeLine(text) {
  const t = String(text || '').toLowerCase();
  if (t.includes('coaching')) return User;
  if (t.includes('live')) return Video;
  if (t.includes('liri')) return Zap;
  if (t.includes('suivi')) return Ban;
  return Ban;
}

export { Ban };
