import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  BookOpen,
  GraduationCap,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  LayoutDashboard,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
  LogIn,
  UserPlus,
  Copy,
  Check,
  Bell,
  Users,
  Star,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import ContactModal from '@/components/ContactModal';
import ChatModal from '@/components/ChatModal';
import Logo from '@/components/Logo';
import { cn } from '@/lib/utils';
import { resolveDashboardPath } from '@/lib/dashboardRoute';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SCHOOL = isnaTenantConfig.branding.name;
const SITE_NAME = `${SCHOOL} · LIRI`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const AnnouncementItem = ({ title, content, date, priority }) => {
  const colorMap = { urgent: 'border-l-red-500', high: 'border-l-orange-500', normal: 'border-l-yellow-500', low: 'border-l-blue-500' };
  const barColor = colorMap[priority] || colorMap.normal;
  return (
    <div className={cn('bg-white/5 border border-white/8 border-l-4 rounded-r-xl p-4 hover:bg-white/8 transition-all', barColor)}>
      <div className="flex justify-between items-start mb-1">
        <span className="text-xs text-yellow-500 font-medium">{date}</span>
        {priority === 'urgent' && (
          <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5">Urgent</span>
        )}
      </div>
      <h4 className="text-sm font-semibold text-white mb-1 line-clamp-1">{title}</h4>
      <p className="text-xs text-gray-400 line-clamp-2">{content}</p>
    </div>
  );
};

const TeacherAvatar = ({ name, role, avatar, onContact }) => (
  <button
    onClick={onContact}
    className="premium-panel p-4 text-left hover:border-yellow-500/25 transition-all w-full group"
  >
    <div className="flex items-center gap-3 mb-2">
      <img
        src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a2030&color=D4AF37`}
        alt={name}
        className="w-10 h-10 rounded-full object-cover border border-white/10"
        onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a2030&color=D4AF37`; }}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white truncate group-hover:text-yellow-300 transition-colors">{name}</p>
        <p className="text-xs text-gray-400 truncate">{role}</p>
      </div>
    </div>
    <span className="text-[10px] text-yellow-500/70 uppercase tracking-wider inline-flex items-center gap-1">
      Contacter <ArrowRight className="w-2.5 h-2.5" />
    </span>
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const ReceptionPage = () => {
  const vitrineEmail = useVitrineContactEmail();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 900
  );
  const wheelLockRef = useRef(false);
  const touchStartYRef = useRef(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 90, damping: 24, mass: 0.5 });
  const smoothY = useSpring(mouseY, { stiffness: 90, damping: 24, mass: 0.5 });
  const parallaxX = useTransform(smoothX, [-0.5, 0.5], [-24, 24]);
  const parallaxY = useTransform(smoothY, [-0.5, 0.5], [-18, 18]);
  const parallaxXInverse = useTransform(smoothX, [-0.5, 0.5], [16, -16]);
  const parallaxYInverse = useTransform(smoothY, [-0.5, 0.5], [12, -12]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Viewport height (handles mobile browser chrome)
  useEffect(() => {
    const update = () => {
      const h = window.visualViewport?.height || window.innerHeight;
      setViewportHeight((prev) => (Math.abs(prev - h) < 1 ? prev : h));
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  // Fetch real announcements from Supabase
  useEffect(() => {
    supabase
      .from('announcements')
      .select('id, title, content, priority, published_at')
      .order('published_at', { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data?.length) {
          setAnnouncements(
            data.map((a) => ({
              id: a.id,
              title: a.title,
              content: a.content,
              priority: a.priority,
              date: formatDate(a.published_at),
            }))
          );
        } else {
          // Fallback placeholder
          setAnnouncements([
            { id: 1, title: 'Reprise des cours', content: 'Le second semestre débute ce lundi. Consultez vos emplois du temps.', priority: 'normal', date: '20 Jan' },
            { id: 2, title: 'Prochain Live', content: 'Séance de Q&A avec le Dr. Connor sur le cycle Initié.', priority: 'high', date: '25 Jan' },
            { id: 3, title: 'Inscriptions Ouvertes', content: 'Les inscriptions pour le cycle Maître sont désormais ouvertes.', priority: 'normal', date: '01 Fév' },
          ]);
        }
      })
      .catch(() => {
        setAnnouncements([
          { id: 1, title: 'Reprise des cours', content: 'Le second semestre débute ce lundi.', priority: 'normal', date: '20 Jan' },
          { id: 2, title: 'Prochain Live', content: 'Séance de Q&A avec le Dr. Connor sur le cycle Initié.', priority: 'high', date: '25 Jan' },
        ]);
      });
  }, []);

  // Fetch real teacher profiles from Supabase
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, role, avatar_url')
      .in('role', ['teacher', 'owner', 'admin'])
      .limit(4)
      .then(({ data }) => {
        if (data?.length) {
          setTeachers(
            data.map((p) => ({
              id: p.id,
              name: p.name || 'Enseignant',
              role: p.role === 'owner' ? 'Directeur' : p.role === 'admin' ? 'Administrateur' : 'Professeur',
              avatar: p.avatar_url,
            }))
          );
        } else {
          setTeachers([
            { id: 1, name: 'Équipe pédagogique', role: 'Professeur principal', avatar: null },
            { id: 2, name: 'Direction académique', role: 'Directeur des études', avatar: null },
          ]);
        }
      })
      .catch(() => {
        setTeachers([{ id: 1, name: 'Équipe pédagogique', role: 'Professeur', avatar: null }]);
      });
  }, []);

  const isBusinessHours = useCallback(() => {
    const hour = currentTime.getHours();
    const day = currentTime.getDay();
    return day >= 1 && day <= 6 && hour >= 8 && hour < 20;
  }, [currentTime]);

  const handleCopyPhone = useCallback(() => {
    navigator.clipboard.writeText('+33 7 66 52 57 08').catch(() => {});
    setPhoneCopied(true);
    setTimeout(() => setPhoneCopied(false), 2000);
  }, []);

  const classroomLink = user ? '/classroom' : '/login';
  const dashboardPath = user ? resolveDashboardPath(user) : '/login';

  const sections = useMemo(
    () => [
      {
        id: 'hero',
        title: `Accueil — ${SCHOOL}`,
        subtitle: 'Modèle Métaphysique Africain du MK5',
        description: 'De la prophétie à la raison, de la raison à la science.',
        background:
          'radial-gradient(circle at 15% 15%, rgba(212,175,55,0.24), transparent 40%), radial-gradient(circle at 85% 20%, rgba(99,102,241,0.15), transparent 42%), #090D14',
      },
      {
        id: 'actions',
        title: 'Vos accès rapides',
        subtitle: 'Navigation intelligente',
        description: 'Entrez directement dans votre parcours : classe, formations, support et secrétariat.',
        background:
          'radial-gradient(circle at 10% 20%, rgba(14,165,233,0.2), transparent 42%), radial-gradient(circle at 90% 70%, rgba(34,197,94,0.12), transparent 45%), #090D14',
      },
      {
        id: 'orientation',
        title: "Nouveau, inscrit, besoin d'aide ?",
        subtitle: 'Parcours clair',
        description: 'Chaque profil trouve son chemin en quelques secondes.',
        background:
          'radial-gradient(circle at 20% 20%, rgba(244,63,94,0.2), transparent 42%), radial-gradient(circle at 80% 65%, rgba(217,119,6,0.12), transparent 45%), #090D14',
      },
      {
        id: 'community',
        title: 'Annonces & permanence',
        subtitle: 'Vie académique',
        description: "Restez connecté aux informations importantes et à l'équipe pédagogique.",
        background:
          'radial-gradient(circle at 15% 15%, rgba(139,92,246,0.2), transparent 42%), radial-gradient(circle at 85% 75%, rgba(6,182,212,0.12), transparent 45%), #090D14',
      },
      {
        id: 'footer',
        title: 'Ressources & contact',
        subtitle: 'Navigation complète',
        description: 'Navigation, gestion et support en un seul écran premium.',
        background:
          'radial-gradient(circle at 50% 115%, rgba(212,175,55,0.24), transparent 45%), radial-gradient(circle at 20% 20%, rgba(67,56,202,0.2), transparent 48%), #070A11',
      },
    ],
    []
  );

  const quickActions = useMemo(
    () => [
      { id: 'courses', icon: BookOpen, label: 'Découvrir nos cours', link: '/formations', color: 'text-blue-400', bg: 'bg-blue-500/10', action: null },
      { id: 'class', icon: GraduationCap, label: 'Aller en classe', link: classroomLink, color: 'text-yellow-400', bg: 'bg-yellow-500/10', action: null },
      { id: 'chat', icon: MessageSquare, label: 'Chat direct', link: null, color: 'text-green-400', bg: 'bg-green-500/10', action: () => setIsChatModalOpen(true) },
      { id: 'phone', icon: phoneCopied ? Check : Phone, label: phoneCopied ? 'Numéro copié !' : 'Appeler le secrétariat', link: null, color: phoneCopied ? 'text-green-400' : 'text-purple-400', bg: 'bg-purple-500/10', action: handleCopyPhone },
      { id: 'email', icon: Mail, label: 'Écrire au secrétariat', link: null, color: 'text-pink-400', bg: 'bg-pink-500/10', action: () => setIsContactModalOpen(true) },
      { id: 'faq', icon: HelpCircle, label: 'FAQ / Questions', link: '/faq', color: 'text-orange-400', bg: 'bg-orange-500/10', action: null },
    ],
    [classroomLink, phoneCopied, handleCopyPhone]
  );

  const scrollToSection = useCallback(
    (index) => {
      const safeIndex = Math.max(0, Math.min(index, sections.length - 1));
      if (safeIndex === activeIndex || wheelLockRef.current) return;
      wheelLockRef.current = true;
      setActiveIndex(safeIndex);
      setTimeout(() => { wheelLockRef.current = false; }, 950);
    },
    [activeIndex, sections.length]
  );

  const handleWheel = useCallback(
    (event) => {
      if (Math.abs(event.deltaY) < 20 || wheelLockRef.current) return;
      if (event.cancelable) event.preventDefault();
      scrollToSection(activeIndex + (event.deltaY > 0 ? 1 : -1));
    },
    [activeIndex, scrollToSection]
  );

  const handleTouchStart = (event) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event) => {
    if (wheelLockRef.current || touchStartYRef.current === null) return;
    const endY = event.changedTouches[0]?.clientY;
    if (typeof endY !== 'number') return;
    const delta = touchStartYRef.current - endY;
    touchStartYRef.current = null;
    if (Math.abs(delta) < 50) return;
    scrollToSection(activeIndex + (delta > 0 ? 1 : -1));
  };

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown') { event.preventDefault(); scrollToSection(activeIndex + 1); }
      if (event.key === 'ArrowUp' || event.key === 'PageUp') { event.preventDefault(); scrollToSection(activeIndex - 1); }
      if (event.key === 'Home') { event.preventDefault(); scrollToSection(0); }
      if (event.key === 'End') { event.preventDefault(); scrollToSection(sections.length - 1); }
    },
    [activeIndex, scrollToSection, sections.length]
  );

  const handlePointerMove = useCallback(
    (event) => {
      mouseX.set(event.clientX / window.innerWidth - 0.5);
      mouseY.set(event.clientY / window.innerHeight - 0.5);
    },
    [mouseX, mouseY]
  );

  const handlePointerLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  // ─── Section renderers ──────────────────────────────────────────────────────

  const renderHero = (section) => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center w-full">
      <div className="lg:col-span-7 space-y-5 lg:space-y-7">
        <Logo size="large" variant="dark" showText />
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-gray-200">
          <Sparkles className="w-3.5 h-3.5 text-[var(--school-accent)]" />
          Plateforme immersive
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-serif font-bold text-white leading-tight">
          {section.subtitle}
        </h2>
        <p className="text-base lg:text-lg text-gray-300 max-w-xl">{section.description}</p>
        <div className="flex flex-wrap gap-3">
          <Link to={classroomLink}>
            <button className="h-11 px-6 rounded-xl bg-[var(--school-accent)] text-black font-semibold hover:bg-[#e5c04a] transition-all text-sm">
              Aller en classe
            </button>
          </Link>
          <button
            onClick={() => setIsContactModalOpen(true)}
            className="h-11 px-6 rounded-xl border border-white/15 bg-white/5 text-white hover:bg-white/10 transition-all text-sm"
          >
            Contacter le secrétariat
          </button>
        </div>
      </div>

      <div className="lg:col-span-5 space-y-3">
        {/* Secrétariat status */}
        <div className="premium-panel p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('h-2 w-2 rounded-full', isBusinessHours() ? 'bg-green-500 animate-pulse' : 'bg-gray-500')} />
            <p className="text-xs uppercase tracking-wider text-gray-400">Statut secrétariat</p>
          </div>
          <p className="text-white font-semibold text-sm mb-1">Lun–Sam · 08h–20h</p>
          <div className="flex items-center text-xs">
            {isBusinessHours() ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                <span className="text-green-400">Ouvert maintenant</span>
              </>
            ) : (
              <>
                <Circle className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                <span className="text-gray-400">Fermé actuellement</span>
              </>
            )}
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Users, label: 'Élèves actifs', value: '200+' },
            { icon: BookOpen, label: 'Modules', value: '12+' },
            { icon: Star, label: 'Satisfaction', value: '98%' },
          ].map((s) => (
            <div key={s.label} className="premium-panel p-3 text-center">
              <s.icon className="w-4 h-4 text-[var(--school-accent)] mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{s.value}</p>
              <p className="text-gray-500 text-[10px] leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderActions = (section) => (
    <div className="w-full">
      <div className="max-w-3xl mb-6">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white">{section.title}</h2>
        <p className="text-gray-300 mt-3 text-base lg:text-lg">{section.description}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:gap-4">
        {quickActions.map((action) => {
          const content = (
            <div
              className={cn(
                'premium-panel p-4 text-left hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] transition-all h-full relative',
                phoneCopied && action.id === 'phone' && 'border-green-500/30'
              )}
            >
              <div className={cn('mb-3 p-2 rounded-lg w-fit', action.bg, action.color)}>
                <action.icon className="w-4 h-4" />
              </div>
              <span className={cn('text-xs sm:text-sm font-medium', action.color === 'text-green-400' && phoneCopied && action.id === 'phone' ? 'text-green-400' : 'text-gray-200')}>
                {action.label}
              </span>
            </div>
          );

          if (action.link) {
            return (
              <Link key={action.id} to={action.link} className="block">
                {content}
              </Link>
            );
          }
          return (
            <button key={action.id} type="button" onClick={action.action} className="text-left block w-full">
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderOrientation = (section) => (
    <div className="w-full">
      <div className="max-w-3xl mb-6">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white">{section.title}</h2>
        <p className="text-gray-300 mt-3 text-base lg:text-lg">{section.description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/landing" className="group block">
          <div className="premium-panel p-5 h-full hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2 group-hover:text-[var(--school-accent)] transition-colors">Nouveau visiteur</h3>
            <p className="text-sm text-gray-400 mb-4">Découvrez le fonctionnement global de l'école.</p>
            <span className="text-[var(--school-accent)] text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
              Commencer <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </Link>

        <Link to={classroomLink} className="group block">
          <div className="premium-panel p-5 h-full hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-4">
              <GraduationCap className="w-5 h-5 text-yellow-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2 group-hover:text-[var(--school-accent)] transition-colors">Déjà inscrit</h3>
            <p className="text-sm text-gray-400 mb-4">Accédez directement à votre classe et vos modules.</p>
            <span className="text-[var(--school-accent)] text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
              Ouvrir la classe <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </Link>

        <button onClick={() => setIsContactModalOpen(true)} className="group text-left block w-full">
          <div className="premium-panel p-5 h-full hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
              <HelpCircle className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2 group-hover:text-[var(--school-accent)] transition-colors">Besoin d'aide</h3>
            <p className="text-sm text-gray-400 mb-4">Un conseiller vous accompagne rapidement.</p>
            <span className="text-[var(--school-accent)] text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
              Contacter <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      </div>
    </div>
  );

  const renderCommunity = (section) => (
    <div className="w-full">
      <div className="max-w-3xl mb-6">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white">{section.title}</h2>
        <p className="text-gray-300 mt-3 text-base lg:text-lg">{section.description}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Annonces */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-[var(--school-accent)]" />
            <p className="text-xs uppercase tracking-wider text-gray-400">Annonces récentes</p>
          </div>
          {announcements.slice(0, 3).map((a) => (
            <AnnouncementItem key={a.id} {...a} />
          ))}
          {announcements.length === 0 && (
            <p className="text-sm text-gray-500 italic">Aucune annonce disponible.</p>
          )}
        </div>
        {/* Équipe */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[var(--school-accent)]" />
            <p className="text-xs uppercase tracking-wider text-gray-400">Équipe pédagogique</p>
          </div>
          {teachers.slice(0, 3).map((t) => (
            <TeacherAvatar key={t.id} {...t} onContact={() => setIsContactModalOpen(true)} />
          ))}
        </div>
      </div>
    </div>
  );

  const renderFooter = (section) => (
    <div className="w-full">
      <div className="premium-panel p-6 lg:p-8">
        <div className="max-w-3xl mb-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[color-mix(in_srgb,var(--school-accent)_85%,transparent)] mb-2">Ressources</p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white">{section.title}</h2>
          <p className="text-gray-300 mt-2 text-base">{section.description}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-4">
            <Logo size="small" variant="dark" showText />
            <p className="text-sm text-gray-400 max-w-sm">
              De la prophétie à la raison, de la raison à la science. Une plateforme premium pour apprendre,
              pratiquer et évoluer.
            </p>
            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--school-accent)] shrink-0" />
                <span>Agondje Village, Libreville</span>
              </div>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="flex items-center gap-2 hover:text-white transition-colors group"
              >
                {phoneCopied ? <Check className="w-4 h-4 text-green-400 shrink-0" /> : <Phone className="w-4 h-4 text-[var(--school-accent)] shrink-0" />}
                <span className={phoneCopied ? 'text-green-400' : ''}>
                  {phoneCopied ? 'Numéro copié !' : '+33 7 66 52 57 08'}
                </span>
                {!phoneCopied && <Copy className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" />}
              </button>
              <a href={`mailto:${vitrineEmail}`} className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail className="w-4 h-4 text-[var(--school-accent)] shrink-0" />
                <span>{vitrineEmail}</span>
              </a>
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 gap-3">
            <Link to={dashboardPath} className="premium-panel p-4 hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] transition-all group block">
              <div className="flex items-center gap-2 text-[var(--school-accent)] mb-1.5">
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">Gestion</span>
              </div>
              <p className="text-white font-semibold text-sm group-hover:text-[var(--school-accent)] transition-colors">Tableau de bord</p>
              <p className="text-xs text-gray-400 mt-0.5">Accédez à votre espace de pilotage.</p>
            </Link>

            <Link to="/formations" className="premium-panel p-4 hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] transition-all group block">
              <div className="flex items-center gap-2 text-[var(--school-accent)] mb-1.5">
                <BookOpen className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">Navigation</span>
              </div>
              <p className="text-white font-semibold text-sm group-hover:text-[var(--school-accent)] transition-colors">Catalogue formations</p>
              <p className="text-xs text-gray-400 mt-0.5">Explorez les parcours disponibles.</p>
            </Link>

            <Link to="/faq" className="premium-panel p-4 hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] transition-all group block">
              <div className="flex items-center gap-2 text-[var(--school-accent)] mb-1.5">
                <HelpCircle className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">Support</span>
              </div>
              <p className="text-white font-semibold text-sm group-hover:text-[var(--school-accent)] transition-colors">FAQ</p>
              <p className="text-xs text-gray-400 mt-0.5">Réponses aux questions fréquentes.</p>
            </Link>

            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="premium-panel p-4 hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] transition-all group text-left block w-full"
            >
              <div className="flex items-center gap-2 text-[var(--school-accent)] mb-1.5">
                <Mail className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">Contact</span>
              </div>
              <p className="text-white font-semibold text-sm group-hover:text-[var(--school-accent)] transition-colors">Nous contacter</p>
              <p className="text-xs text-gray-400 mt-0.5">Parlez à un conseiller rapidement.</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSection = (section, index) => {
    if (section.id === 'hero') return renderHero(section);
    if (section.id === 'actions') return renderActions(section);
    if (section.id === 'orientation') return renderOrientation(section);
    if (section.id === 'community') return renderCommunity(section);
    return renderFooter(section);
  };

  const activeSection = sections[activeIndex] || sections[0];

  return (
    <div
      className="relative overflow-hidden bg-[#090D14] text-white font-sans"
      style={{ height: viewportHeight }}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Page d'accueil — navigation par sections"
    >
      <Helmet>
        <title>{`Accueil — ${SITE_NAME}`}</title>
        <meta name="description" content="Modèle Métaphysique Africain du MK5 — Former, initier, structurer la progression, et certifier le disciple." />
      </Helmet>

      <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
      <ChatModal isOpen={isChatModalOpen} onClose={() => setIsChatModalOpen(false)} />

      {/* Animated background */}
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={activeSection.id}
          initial={{ opacity: 0, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
          style={{ background: activeSection.background }}
        />
      </AnimatePresence>

      {/* Parallax orbs */}
      <motion.div aria-hidden className="absolute inset-0 pointer-events-none">
        <motion.div
          style={{ x: parallaxX, y: parallaxY }}
          className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-white/5 blur-[120px]"
        />
        <motion.div
          style={{ x: parallaxXInverse, y: parallaxYInverse }}
          className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] blur-[110px]"
        />
        <div className="absolute top-[20%] right-[22%] w-48 h-48 rounded-full bg-violet-500/8 blur-[95px]" />
      </motion.div>

      {/* ── Top navigation bar ─────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-8 py-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/25 backdrop-blur-xl px-3 py-1.5 text-xs text-gray-200">
          <Sparkles className="w-3.5 h-3.5 text-[var(--school-accent)]" />
          <span className="hidden sm:inline">{SITE_NAME}</span>
          <span className="sm:hidden">{SCHOOL}</span>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <Link
              to={dashboardPath}
              className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-3 py-1.5 text-xs text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-all backdrop-blur-xl"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mon espace</span>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10 transition-all backdrop-blur-xl"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Connexion</span>
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] px-3 py-1.5 text-xs text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] transition-all backdrop-blur-xl font-medium"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>S'inscrire</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Section nav dots (right side) ─────────────────────────────────── */}
      <div className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2.5">
        {sections.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Aller à ${item.title}`}
              onClick={() => scrollToSection(index)}
              className={cn(
                'rounded-full transition-all duration-300',
                isActive
                  ? 'w-2 h-5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]'
                  : 'w-2 h-2 bg-white/30 hover:bg-white/60'
              )}
            />
          );
        })}
        <span className="text-[9px] tracking-[0.2em] text-gray-500 mt-1 tabular-nums">
          {String(activeIndex + 1).padStart(2, '0')}/{String(sections.length).padStart(2, '0')}
        </span>
      </div>

      {/* ── Sections slider ─────────────────────────────────────────────────── */}
      <motion.div
        className="absolute inset-0"
        animate={{ y: -(activeIndex * viewportHeight) }}
        transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
      >
        {sections.map((section, index) => (
          <div
            key={section.id}
            className="flex items-center justify-center"
            style={{ height: viewportHeight, minHeight: viewportHeight }}
            aria-hidden={index !== activeIndex}
          >
            <motion.div
              initial={false}
              animate={{
                opacity: activeIndex === index ? 1 : 0.4,
                y: activeIndex === index ? 0 : 28,
                scale: activeIndex === index ? 1 : 0.984,
              }}
              transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 pb-8 overflow-y-auto"
              style={{ maxHeight: viewportHeight }}
            >
              {renderSection(section, index)}
            </motion.div>
          </div>
        ))}
      </motion.div>

      {/* ── Scroll indicator (bottom center) ──────────────────────────────── */}
      <AnimatePresence>
        {activeIndex < sections.length - 1 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: [0, 6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            onClick={() => scrollToSection(activeIndex + 1)}
            aria-label="Section suivante"
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20"
          >
            <div className="w-5 h-8 border border-white/20 rounded-full flex justify-center pt-1.5">
              <div className="w-1 h-1.5 bg-white/60 rounded-full" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReceptionPage;
