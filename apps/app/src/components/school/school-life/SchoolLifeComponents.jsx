import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Bell, Calendar, ClipboardCheck, AlertTriangle, 
  MessageCircle, MapPin, Clock, Award, FileWarning, 
  Gavel, ScrollText, CheckCircle2, ChevronDown, ChevronUp,
  Download, Upload, Search, Filter, Star, Play, FileText,
  Video, Mic, HelpCircle, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { announcementVisibleForViewer } from '@/lib/schoolAnnouncementUtils';
import { ExternalLink, Loader2 } from 'lucide-react';
import SchoolLifeLiveNotice from '@/components/liri/live/SchoolLifeLiveNotice';

// --- RegulationsSection ---
export const RegulationsSection = () => {
  const [expandedSection, setExpandedSection] = useState('conduct');
  const [accepted, setAccepted] = useState(false);

  const sections = [
    { id: 'conduct', title: 'Code de Conduite', icon: Gavel, content: "Tout étudiant s'engage à respecter les principes de bienveillance, d'intégrité et de respect mutuel..." },
    { id: 'presence', title: 'Politique de Présence', icon: Clock, content: "La présence aux cours magistraux est obligatoire. Au-delà de 3 absences injustifiées..." },
    { id: 'eval', title: "Politique d'Évaluation", icon: ClipboardCheck, content: "La validation des acquis se fait par contrôle continu et examen final. La moyenne requise est de 10/20..." },
    { id: 'discipline', title: 'Politique de Discipline', icon: AlertTriangle, content: "Toute fraude ou plagiat entraîne une convocation immédiate devant le conseil de discipline..." },
    { id: 'rights', title: 'Droits et Responsabilités', icon: ScrollText, content: "Chaque étudiant a droit à un accompagnement pédagogique de qualité et à l'accès aux ressources..." }
  ];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {sections.map((section) => (
            <motion.div 
              key={section.id}
              className="bg-[#192734] border border-white/10 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#D4AF37]/10 rounded-lg text-[#D4AF37]">
                    <section.icon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-white">{section.title}</span>
                </div>
                {expandedSection === section.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              <AnimatePresence>
                {expandedSection === section.id && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 text-gray-400 leading-relaxed border-t border-white/5">
                      {section.content}
                      <br /><br />
                      <p className="italic text-sm">Voir l'article complet dans le document PDF.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-[#192734] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Téléchargement</h3>
            <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#b5952f] mb-4">
              <Download className="w-4 h-4 mr-2" /> Règlement Intérieur (PDF)
            </Button>
            <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <input 
                type="checkbox" 
                checked={accepted} 
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1"
              />
              <p className="text-xs text-blue-200">
                Je reconnais avoir lu et accepté le règlement intérieur de l'établissement pour l'année 2025-2026.
              </p>
            </div>
          </div>

          <div className="bg-[#192734] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">FAQ Règlement</h3>
            <div className="space-y-3">
              <details className="text-sm text-gray-400 cursor-pointer">
                <summary className="hover:text-[#D4AF37]">Combien d'absences sont tolérées ?</summary>
                <p className="mt-2 pl-4 text-gray-500">Jusqu'à 3 absences justifiées par trimestre.</p>
              </details>
              <details className="text-sm text-gray-400 cursor-pointer">
                <summary className="hover:text-[#D4AF37]">Code vestimentaire ?</summary>
                <p className="mt-2 pl-4 text-gray-500">Tenue correcte exigée. Tenue blanche pour les cérémonies.</p>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- EventsSection ---
export const EventsSection = () => {
  const [filter, setFilter] = useState('all');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('school_events')
        .select('id,title,description,start_at,end_at,location,target_role')
        .in('target_role', ['all', 'student'])
        .order('start_at', { ascending: true })
        .limit(50);
      if (!cancelled) {
        setLoading(false);
        setEvents(data || []);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const now = new Date();
  const upcoming = events.filter(e => new Date(e.start_at) >= now);
  const past = events.filter(e => new Date(e.start_at) < now).slice(-4).reverse();

  const detectType = (e) => {
    const t = String(e.title || '') + ' ' + String(e.description || '');
    if (/ceremonie|initiation|diplome|remise/i.test(t)) return 'ceremony';
    if (/atelier|workshop/i.test(t)) return 'workshop';
    if (/conference|conf/i.test(t)) return 'conference';
    if (/meditation|pratique|practice/i.test(t)) return 'practice';
    return 'event';
  };

  const filtered = (filter === 'all' ? upcoming : upcoming.filter(e => detectType(e) === filter));

  const safeDate = (s) => { try { return new Date(s).toLocaleDateString('fr-FR'); } catch { return ''; } };
  const safeTime = (s) => { try { return new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

  return (
    <div className="space-y-8">
      <SchoolLifeLiveNotice />
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'conference', 'ceremony', 'workshop'].map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className={cn('capitalize', filter === f ? 'bg-[#D4AF37] text-black' : 'border-white/10 text-gray-400')}
          >
            {f === 'all' ? 'Tous' : f}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-12 border border-dashed border-white/10 rounded-xl">
          Aucun événement à venir pour le moment.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((evt) => (
            <motion.div
              key={evt.id}
              whileHover={{ y: -5 }}
              className="bg-[#192734] border border-white/10 rounded-xl p-6 relative overflow-hidden group"
            >
              <div className="text-sm text-[#D4AF37] font-bold mb-2 uppercase">{detectType(evt)}</div>
              <h3 className="text-xl font-bold text-white mb-4">{evt.title}</h3>
              <div className="space-y-2 text-sm text-gray-400 mb-6">
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {safeDate(evt.start_at)}</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> {safeTime(evt.start_at)}</div>
                {evt.location && <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {evt.location}</div>}
              </div>
              {evt.description && <p className="text-xs text-gray-500 mb-4 line-clamp-2">{evt.description}</p>}
            </motion.div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Événements passés</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {past.map((evt) => (
              <div key={evt.id} className="flex items-center gap-4 p-4 bg-[#192734] border border-white/10 rounded-xl">
                <div className="p-3 bg-white/5 rounded-lg text-gray-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-medium">{evt.title}</p>
                  <p className="text-sm text-gray-500">{safeDate(evt.start_at)}{evt.location ? ` · ${evt.location}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- AnnouncementsSection ---
export const AnnouncementsSection = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('id,title,content,summary,category,priority,published_at,audience,extras_json,status')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(80);
      if (!cancelled) {
        setLoading(false);
        if (!error) setRows(data || []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (rows || []).filter((a) => announcementVisibleForViewer(a, user)),
    [rows, user]
  );

  const featured = useMemo(() => {
    const rank = (p) => (/urgent|high/i.test(String(p)) ? 0 : 1);
    return [...visible].sort((a, b) => rank(a.priority) - rank(b.priority)).slice(0, 2);
  }, [visible]);

  const openAnn = openId ? visible.find((a) => a.id === openId) : null;

  useEffect(() => {
    const raw = searchParams.get('announcementId');
    if (!raw || !visible.length) return;
    const found = visible.find((a) => String(a.id) === String(raw));
    if (found) setOpenId(found.id);
  }, [searchParams, visible]);

  const openDialog = (id) => {
    setOpenId(id);
    const next = new URLSearchParams(searchParams);
    next.set('announcementId', String(id));
    setSearchParams(next, { replace: true });
  };

  const closeDialog = () => {
    setOpenId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('announcementId');
    setSearchParams(next, { replace: true });
  };

  const getPriorityColor = (priority) => {
    switch (String(priority || '').toLowerCase()) {
      case 'urgent':
      case 'high':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'normal':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const priorityLabel = (priority) => {
    const p = String(priority || '').toLowerCase();
    if (p === 'urgent') return 'Priorité haute';
    if (p === 'normal') return 'Standard';
    return 'Info';
  };

  const listPreview = (ann) => {
    const s = String(ann.summary || '').trim();
    const c = String(ann.content || '');
    if (s) return s;
    if (c.length > 280) return `${c.slice(0, 240).trim()}…`;
    return c;
  };

  const needsModal = (ann) => {
    const c = String(ann.content || '');
    const s = String(ann.summary || '').trim();
    return c.length > 320 || (s && c.length > s.length + 40);
  };

  const dialogExtras =
    openAnn?.extras_json && typeof openAnn.extras_json === 'object' ? openAnn.extras_json : {};

  return (
    <>
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-xl font-bold text-white">Dernières annonces</h3>
           <div className="flex gap-2">
             <Button size="sm" variant="ghost" className="text-gray-400"><Search className="w-4 h-4"/></Button>
             <Button size="sm" variant="ghost" className="text-gray-400"><Filter className="w-4 h-4"/></Button>
           </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center text-gray-500 py-12 border border-dashed border-white/10 rounded-xl">
            Aucune annonce pour le moment.
          </div>
        ) : (
        visible.map((ann) => {
          const cardExtras = ann.extras_json && typeof ann.extras_json === 'object' ? ann.extras_json : {};
          return (
          <div
            key={ann.id}
            className="bg-[#192734] border border-white/10 rounded-xl p-6 hover:border-[#D4AF37]/30 transition-all cursor-pointer"
            onClick={() => openDialog(ann.id)}
            role="presentation"
          >
            <div className="flex justify-between items-start mb-2">
              <span className={cn('px-2 py-1 rounded text-xs font-bold border', getPriorityColor(ann.priority))}>
                {priorityLabel(ann.priority)}
              </span>
              <span className="text-sm text-gray-500">
                {ann.published_at ? new Date(ann.published_at).toLocaleDateString('fr-FR') : ''}
              </span>
            </div>
            <div className="flex items-start gap-3">
              {cardExtras.image_url ? (
                <img
                  src={cardExtras.image_url}
                  alt=""
                  className="w-20 h-20 rounded-lg object-cover border border-white/10 shrink-0 hidden sm:block"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <h4 className="text-lg font-bold text-white mb-2">{ann.title}</h4>
                <p className="text-gray-400 text-sm line-clamp-3 mb-4">{listPreview(ann)}</p>
                {needsModal(ann) ? (
                  <Button
                    variant="link"
                    className="text-[#D4AF37] p-0 h-auto text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDialog(ann.id);
                    }}
                  >
                    Lire la suite &rarr;
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        );
        })
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-[#192734] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">À la Une</h3>
          <div className="space-y-3">
            {featured.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Aucune annonce en vedette pour le moment.</p>
            ) : (
              featured.map((a) => {
                const urgent = /urgent|high/i.test(String(a.priority));
                return (
                  <button
                    key={a.id}
                    onClick={() => openDialog(a.id)}
                    className="w-full text-left p-4 bg-white/5 rounded-lg border border-white/5 hover:border-[#D4AF37]/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {urgent ? (
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      ) : (
                        <Star className="w-4 h-4 text-[#D4AF37] shrink-0" />
                      )}
                      <span className="font-bold text-white text-sm line-clamp-1">{a.title}</span>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2">{listPreview(a)}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-[#192734] border border-white/10 rounded-xl p-6">
           <h3 className="text-lg font-bold text-white mb-4">Contact Rapide</h3>
           <Input placeholder="Sujet" className="mb-3 bg-[#0F1419] border-white/10" />
           <textarea className="w-full bg-[#0F1419] border border-white/10 rounded-lg p-3 text-sm text-white mb-3" rows={3} placeholder="Votre message..."></textarea>
           <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#b5952f]" asChild>
             <a href="/messages">Contacter le secrétariat</a>
           </Button>
        </div>
      </div>
    </div>

    <Dialog open={Boolean(openId && openAnn)} onOpenChange={(o) => !o && closeDialog()}>
      <DialogContent className="bg-[#192734] border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{openAnn?.title}</DialogTitle>
        </DialogHeader>
        {dialogExtras.image_url ? (
          <img
            src={dialogExtras.image_url}
            alt=""
            className="w-full max-h-56 rounded-lg object-cover border border-white/10"
          />
        ) : null}
        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{openAnn?.content}</p>
        <div className="flex flex-col gap-2 text-sm pt-2 border-t border-white/10">
          {dialogExtras.link_url ? (
            <a
              href={dialogExtras.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#D4AF37] hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" /> Lien associé
            </a>
          ) : null}
          {dialogExtras.phone ? (
            <a href={`tel:${String(dialogExtras.phone).replace(/\s/g, '')}`} className="text-[#D4AF37] hover:underline">
              {dialogExtras.phone}
            </a>
          ) : null}
          {dialogExtras.product_id ? (
            <Link to={`/product/${dialogExtras.product_id}`} className="text-[#D4AF37] hover:underline">
              Voir le produit
            </Link>
          ) : null}
          {dialogExtras.module_id ? (
            <Link to={`/curriculum/module/${dialogExtras.module_id}`} className="text-[#D4AF37] hover:underline">
              Voir le module
            </Link>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

// --- OfficialAnnouncementsSection (alias for AnnouncementsSection) ---
export const OfficialAnnouncementsSection = AnnouncementsSection;

// --- AttendanceSection ---
export const AttendanceSection = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: all }, { count }] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('id,status,attendance_date,note')
          .eq('student_id', user.id)
          .order('attendance_date', { ascending: false })
          .limit(200),
        supabase
          .from('attendance_records')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', user.id),
      ]);
      if (cancelled) return;
      setRows(all || []);
      setTotalSessions(count || 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const present = rows.filter(r => r.status === 'present').length;
  const excused = rows.filter(r => r.status === 'excused').length;
  const absent = rows.filter(r => r.status === 'absent').length;
  const late = rows.filter(r => r.status === 'late').length;
  const total = totalSessions || rows.length;
  const rate = total > 0 ? Math.round(((present + excused) / total) * 100) : null;

  // Group by month for detail view
  const byMonth = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const d = new Date(r.attendance_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (!map.has(key)) map.set(key, { label, records: [] });
      map.get(key).records.push(r);
    });
    return [...map.entries()].slice(0, 3).map(([, v]) => v);
  }, [rows]);

  const statusIcon = (s) => {
    if (s === 'present') return '✅';
    if (s === 'excused') return '⚠️';
    if (s === 'late') return '🕐';
    return '❌';
  };

  return (
    <div className="space-y-8">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-[#192734] border border-white/10 rounded-xl p-6 flex flex-col items-center">
              <div className="text-3xl font-bold text-white mb-1">{present}/{total}</div>
              <div className="text-sm text-gray-400 uppercase">Présences</div>
              <Progress value={rate ?? 0} className="h-1.5 mt-4 bg-gray-700" indicatorClassName="bg-green-500" />
            </div>
            <div className="bg-[#192734] border border-white/10 rounded-xl p-6 flex flex-col items-center">
              <div className={`text-3xl font-bold mb-1 ${rate === null ? 'text-gray-400' : rate >= 80 ? 'text-green-500' : 'text-red-500'}`}>
                {rate !== null ? `${rate}%` : 'N/A'}
              </div>
              <div className="text-sm text-gray-400 uppercase">Taux Global</div>
              <CheckCircle2 className={`w-5 h-5 mt-4 ${rate !== null && rate >= 80 ? 'text-green-500' : 'text-gray-500'}`} />
            </div>
            <div className="bg-[#192734] border border-white/10 rounded-xl p-6 flex flex-col items-center">
              <div className="text-3xl font-bold text-yellow-500 mb-1">{excused + late}</div>
              <div className="text-sm text-gray-400 uppercase">Justifiées / Retards</div>
              <FileText className="w-5 h-5 text-yellow-500 mt-4" />
            </div>
            <div className="bg-[#192734] border border-white/10 rounded-xl p-6 flex flex-col items-center">
              <div className="text-3xl font-bold text-red-500 mb-1">{absent}</div>
              <div className="text-sm text-gray-400 uppercase">Non Justifiées</div>
              <AlertTriangle className="w-5 h-5 text-red-500 mt-4" />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-[#192734] border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-6">Détail par mois</h3>
              {byMonth.length === 0 ? (
                <p className="text-gray-500 text-sm italic text-center py-8">Aucune donnée de présence enregistrée.</p>
              ) : (
                <div className="space-y-6">
                  {byMonth.map((m, i) => {
                    const mPresent = m.records.filter(r => r.status === 'present').length;
                    const mTotal = m.records.length;
                    const mRate = mTotal > 0 ? Math.round((mPresent / mTotal) * 100) : 0;
                    return (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-400 capitalize">
                          <span>{m.label}</span>
                          <span>{mRate}%</span>
                        </div>
                        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(m.records.length, 10)}, 1fr)` }}>
                          {m.records.slice(0, 10).map((r, d) => (
                            <div
                              key={d}
                              title={`${r.attendance_date} — ${r.status}`}
                              className={cn('h-8 rounded flex items-center justify-center text-xs',
                                r.status === 'present' ? 'bg-green-500/20 text-green-500' :
                                r.status === 'excused' ? 'bg-yellow-500/20 text-yellow-500' :
                                r.status === 'late' ? 'bg-orange-500/20 text-orange-500' :
                                'bg-red-500/20 text-red-500'
                              )}
                            >
                              {statusIcon(r.status)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-[#192734] border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Justifier une absence</h3>
                <p className="text-sm text-gray-400 mb-4">Contactez le secrétariat pour toute demande de justification d'absence.</p>
                <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#b5952f]" asChild>
                  <a href="/messages">Contacter le secrétariat</a>
                </Button>
              </div>

              {rate !== null && rate < 80 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-red-400">Attention</h4>
                    <p className="text-xs text-red-200 mt-1">
                      Votre taux de présence ({rate}%) est en dessous de 80%. Vous risquez la non-validation du trimestre.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// --- DisciplineSection ---
export const DisciplineSection = () => {
  const { user } = useAuth();
  const [lateRows, setLateRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('attendance_records')
        .select('id,status,attendance_date,note')
        .eq('student_id', user.id)
        .eq('status', 'late')
        .order('attendance_date', { ascending: false })
        .limit(50);
      if (!cancelled) {
        setLateRows(data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="space-y-8">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-[#192734] border border-white/10 rounded-xl p-6 flex flex-col items-center">
              <div className="text-3xl font-bold text-yellow-500 mb-1">0</div>
              <div className="text-sm text-gray-400 uppercase">Avertissements</div>
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-4" />
            </div>
            <div className="bg-[#192734] border border-white/10 rounded-xl p-6 flex flex-col items-center">
              <div className="text-3xl font-bold text-orange-500 mb-1">{lateRows.length}</div>
              <div className="text-sm text-gray-400 uppercase">Retards enregistrés</div>
              <FileWarning className="w-5 h-5 text-orange-500 mt-4" />
            </div>
            <div className="bg-[#192734] border border-white/10 rounded-xl p-6 flex flex-col items-center">
              <div className="text-3xl font-bold text-green-500 mb-1">Bon</div>
              <div className="text-sm text-gray-400 uppercase">Statut Actuel</div>
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-4" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">Historique disciplinaire</h3>
            {lateRows.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <p className="text-white font-medium">Aucun incident disciplinaire enregistré</p>
                <p className="text-sm text-gray-500 mt-1">Votre comportement est exemplaire. Continuez ainsi !</p>
              </div>
            ) : (
              lateRows.map((r) => (
                <div key={r.id} className="bg-[#192734] border border-white/10 rounded-xl p-5 flex items-center gap-4">
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-500">
                    <FileWarning className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Retard</p>
                    <p className="text-sm text-gray-400">
                      {new Date(r.attendance_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {r.note && <p className="text-xs text-gray-500 mt-1 italic">{r.note}</p>}
                  </div>
                  <Badge className="bg-orange-500/20 text-orange-400">Retard</Badge>
                </div>
              ))
            )}
          </div>

          <div className="bg-[#192734] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Gavel className="w-5 h-5 text-[#D4AF37]" /> Procédure de Recours
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Vous avez le droit de contester une décision disciplinaire dans les 5 jours suivant sa notification.
              Contactez le secrétariat pour toute contestation.
            </p>
            <Button className="bg-[#D4AF37] text-black hover:bg-[#b5952f]" asChild>
              <a href="/messages">Contacter le secrétariat</a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
};