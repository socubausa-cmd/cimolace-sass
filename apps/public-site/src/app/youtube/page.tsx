"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Link from "next/link";

/* ───────── DONNÉES DE LA CHAÎNE ───────── */
const VIDEOS = [
  { id: "Bd55P92JawY", title: "Envoûtement expliqué", duration: "9:30", views: 139, category: "mystique" },
  { id: "UkwRgLN10PY", title: "L'Origine de l'Être 3", duration: "7:24", views: 126, category: "enseignement" },
  { id: "4xTk2NY6tbg", title: "L'Origine de l'Être 2", duration: "6:03", views: 180, category: "enseignement" },
  { id: "YPkw1_BmuNo", title: "Rituels de protection — premières notions", duration: "14:12", views: 410, category: "rituels" },
  { id: "fjE06uo8WJQ", title: "Magnétisation de l'Eau — Première Notion", duration: "5:34", views: 180, category: "mystique" },
  { id: "M-xKJ2CBsh0", title: "@manikongo5", duration: "2:02", views: 116, category: "enseignement" },
  { id: "p7x2aHb8JL0", title: "La Prophétie sur la guerre mondiale / La colère de Hitler", duration: "6:42", views: 1000, category: "prophetie" },
  { id: "6IRawdbi8l0", title: "La loi de la trans-hypostase, les dangers des sacrifices du sang", duration: "11:01", views: 822, category: "mystique" },
  { id: "Rmn7cYecIv0", title: "Comment invoquer les ancêtres", duration: "4:27", views: 548, category: "rituels" },
  { id: "W4rG_xXGRVo", title: "Les secrets de la magie de la sueur et du tam-tam — acte 1", duration: "14:12", views: 337, category: "mystique" },
];

const CATEGORIES = [
  { id: "tous", label: "Tous" },
  { id: "enseignement", label: "Enseignements" },
  { id: "rituels", label: "Rituels & Protection" },
  { id: "mystique", label: "Mystique & Magie" },
  { id: "prophetie", label: "Prophéties" },
];

const NAV_SECTIONS = [
  { id: "sanctuaire", label: "Le Sanctuaire" },
  { id: "videos", label: "Vidéos" },
];

const avatar =
  "https://yt3.googleusercontent.com/AyruSlk1ilYcZ5xJV--njDecZmYrHsx4vklKCUrI6seMw90HPY7XRLHyWWzSMlSu9gbl6YrWcg=s900-c-k-c0x00ffffff-no-rj";

/* ───────── MODAL VIDÉO PLEIN ÉCRAN ───────── */
function VideoModal({ video, onClose }: { video: (typeof VIDEOS)[number]; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-6xl mx-4 sm:mx-6 aspect-video rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl shadow-amber-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* YouTube iframe en plein écran */}
        <iframe
          src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3`}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
        />

        {/* Bouton fermeture */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 bg-black/50 backdrop-blur-sm text-white/80 p-2.5 rounded-full hover:bg-black/80 hover:text-white transition-all"
          aria-label="Fermer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>

        {/* Titre en bas */}
        <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-12">
          <h3 className="text-white text-lg sm:text-xl font-medium">{video.title}</h3>
          <p className="text-white/50 text-sm mt-1">{video.duration}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ───────── COMPOSANTS ───────── */

function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-black/80 backdrop-blur-2xl border-b border-amber-900/20" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <button onClick={() => scrollTo("hero")} className="flex items-center gap-2 group">
          <span className="text-xl font-light tracking-widest text-amber-400/90 group-hover:text-amber-300 transition-colors">
            ✦ 5M
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className="px-4 py-2 text-sm text-white/50 hover:text-white/90 transition-colors rounded-full hover:bg-white/5"
            >
              {s.label}
            </button>
          ))}
        </nav>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-white/70 p-2"
          aria-label="Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {menuOpen ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-black/95 backdrop-blur-2xl border-t border-amber-900/10 overflow-hidden"
          >
            <div className="px-6 py-4 space-y-2">
              {NAV_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className="block w-full text-left px-4 py-3 text-white/60 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

function HeroSection() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(217,119,6,0.15),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,0,0,0.8),transparent_50%)]" />
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-[120px]"
        />
      </div>

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <div className="w-28 h-28 mx-auto rounded-full overflow-hidden ring-2 ring-amber-500/30 ring-offset-4 ring-offset-black/80 mb-6">
            <img src={avatar} alt="5ième ManiKongo" className="w-full h-full object-cover" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-7xl md:text-8xl font-light tracking-tight text-white mb-6"
        >
          5ième ManiKongo
        </motion.h1>

        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg sm:text-xl text-amber-200/60 font-light max-w-2xl mx-auto mb-4"
        >
          Initiation à la spiritualité de l&apos;âge du Verseau — sagesse ancestrale et traditions kamites.
        </motion.p>

        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm text-white/30 font-mono tracking-wider"
        >
          @5iemeManiKongo
        </motion.p>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-wrap items-center justify-center gap-8"
        >
          <div className="text-center">
            <div className="text-3xl font-light text-white">{VIDEOS.length}</div>
            <div className="text-xs text-white/30 mt-1 uppercase tracking-widest">Vidéos</div>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <div className="text-3xl font-light text-white">+3K</div>
            <div className="text-xs text-white/30 mt-1 uppercase tracking-widest">Vues</div>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <div className="text-3xl font-light text-white">Sagesse</div>
            <div className="text-xs text-white/30 mt-1 uppercase tracking-widest">Ancestrale</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="text-white/20 text-xs tracking-widest uppercase"
          >
            Défiler
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* Narration progressive Apple-style */
function NarrativeSection() {
  const container = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start start", "end end"],
  });

  const progress = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const opacity1 = useTransform(progress, [0, 0.12, 0.25, 0.38], [0, 1, 1, 0]);
  const opacity2 = useTransform(progress, [0.28, 0.4, 0.5, 0.63], [0, 1, 1, 0]);
  const opacity3 = useTransform(progress, [0.5, 0.62, 0.72, 0.85], [0, 1, 1, 0]);
  const opacity4 = useTransform(progress, [0.72, 0.84, 0.92, 1], [0, 1, 1, 0]);

  return (
    <section id="sanctuaire" ref={container} className="relative h-[400vh] bg-black">
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        <motion.div
          style={{ scale: useTransform(progress, [0, 1], [1.2, 0.8]) }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-amber-900/10 via-black to-black" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-amber-500/5 blur-[150px]" />
        </motion.div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* 1 */}
          <motion.div
            style={{ opacity: opacity1 }}
            className="absolute inset-0 flex items-center justify-center px-6"
          >
            <div>
              <span className="text-xs tracking-[0.3em] text-amber-500/50 uppercase mb-6 block font-mono">
                La Mission
              </span>
              <h2 className="text-4xl sm:text-6xl font-light text-white leading-tight mb-6">
                Donner les yeux<br />
                <span className="text-amber-400/70">et les oreilles</span>
              </h2>
              <p className="text-lg text-white/40 max-w-xl mx-auto font-light">
                Réveiller les consciences par la transmission de la sagesse kamite et des traditions ancestrales.
              </p>
            </div>
          </motion.div>

          {/* 2 */}
          <motion.div
            style={{ opacity: opacity2 }}
            className="absolute inset-0 flex items-center justify-center px-6"
          >
            <div>
              <span className="text-xs tracking-[0.3em] text-amber-500/50 uppercase mb-6 block font-mono">
                L&apos;Ère Nouvelle
              </span>
              <h2 className="text-4xl sm:text-6xl font-light text-white leading-tight mb-6">
                Spiritualité de l&apos;Âge<br />
                <span className="text-amber-400/70">du Verseau</span>
              </h2>
              <p className="text-lg text-white/40 max-w-xl mx-auto font-light">
                Un enseignement conçu pour l&apos;éveil de l&apos;humanité, sous la supervision du grand génie KIMBANGU.
              </p>
            </div>
          </motion.div>

          {/* 3 */}
          <motion.div
            style={{ opacity: opacity3 }}
            className="absolute inset-0 flex items-center justify-center px-6"
          >
            <div>
              <span className="text-xs tracking-[0.3em] text-amber-500/50 uppercase mb-6 block font-mono">
                La Pensée
              </span>
              <h2 className="text-4xl sm:text-6xl font-light text-white leading-tight mb-6">
                Penser Kamite<br />
                <span className="text-amber-400/70">Agir Ancestral</span>
              </h2>
              <p className="text-lg text-white/40 max-w-xl mx-auto font-light">
                Une plongée dans la pensée africaine originelle, la tradition bantoue et les mystères de l&apos;Égypte antique.
              </p>
            </div>
          </motion.div>

          {/* 4 */}
          <motion.div
            style={{ opacity: opacity4 }}
            className="absolute inset-0 flex items-center justify-center px-6"
          >
            <div>
              <span className="text-xs tracking-[0.3em] text-amber-500/50 uppercase mb-6 block font-mono">
                L&apos;Héritage
              </span>
              <h2 className="text-4xl sm:text-6xl font-light text-white leading-tight mb-6">
                Magie du Haut Astral<br />
                <span className="text-amber-400/70">Rituels & Prophéties</span>
              </h2>
              <p className="text-lg text-white/40 max-w-xl mx-auto font-light">
                Rituels de protection, invocation des ancêtres, magnétisation de l&apos;eau — un savoir ancestral préservé.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function VideoCard({ video, index, onPlay }: { video: (typeof VIDEOS)[number]; index: number; onPlay: () => void }) {
  const thumbnail = `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`;

  const formatViews = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : `${v}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        onClick={onPlay}
        className="w-full text-left group cursor-pointer"
      >
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-900">
          <img
            src={thumbnail}
            alt={video.title}
            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />

          {/* Bouton play */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-white/30">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white" className="ml-1">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Durée */}
          <span className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white/90 text-xs px-2 py-1 rounded-md font-mono">
            {video.duration}
          </span>
        </div>

        <div className="mt-3 px-1">
          <h3 className="text-white/80 text-sm font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {video.title}
          </h3>
          <p className="text-white/30 text-xs mt-1.5 font-mono">{formatViews(video.views)} vues</p>
        </div>
      </button>
    </motion.div>
  );
}

function VideosSection() {
  const [activeCategory, setActiveCategory] = useState("tous");
  const [playingVideo, setPlayingVideo] = useState<(typeof VIDEOS)[number] | null>(null);

  const filtered =
    activeCategory === "tous" ? VIDEOS : VIDEOS.filter((v) => v.category === activeCategory);

  return (
    <section id="videos" className="relative bg-black py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* En-tête */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-xs tracking-[0.3em] text-amber-500/50 uppercase mb-4 block font-mono">
            Bibliothèque
          </span>
          <h2 className="text-4xl sm:text-5xl font-light text-white mb-4">
            Explorer les <span className="text-amber-400/70">Enseignements</span>
          </h2>
          <p className="text-white/30 text-sm max-w-lg mx-auto">
            Rituels, mystique, prophéties et sagesse ancestrale pour l&apos;initiation spirituelle.
          </p>
        </motion.div>

        {/* Filtres */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-5 py-2.5 text-sm rounded-full border transition-all duration-300 ${
                activeCategory === cat.id
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  : "bg-transparent border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grille */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
          >
            {filtered.length > 0 ? (
              filtered.map((video, i) => (
                <VideoCard key={video.id} video={video} index={i} onPlay={() => setPlayingVideo(video)} />
              ))
            ) : (
              <div className="col-span-full text-center py-16">
                <p className="text-white/30">Aucune vidéo dans cette catégorie.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modal plein écran */}
      <AnimatePresence>
        {playingVideo && <VideoModal video={playingVideo} onClose={() => setPlayingVideo(null)} />}
      </AnimatePresence>
    </section>
  );
}

function ChannelFooter() {
  return (
    <footer className="bg-black border-t border-white/5 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-1 ring-amber-500/20">
              <img src={avatar} alt="5ième ManiKongo" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium">5ième ManiKongo</p>
              <p className="text-white/30 text-xs">@5iemeManiKongo</p>
            </div>
          </div>

          <Link
            href="/"
            className="text-white/30 hover:text-white/60 text-xs transition-colors"
          >
            Cimolace
          </Link>
        </div>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <p className="text-white/20 text-xs">
            ✦ Sanctuaire du 5ème Manikongo — Spiritualité, Sagesse et Tradition
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ───────── PAGE PRINCIPALE ───────── */
export default function YoutubePage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 200);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-amber-400/30 text-4xl font-light tracking-widest"
        >
          ✦
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen overflow-x-hidden">
      <NavBar />
      <HeroSection />
      <NarrativeSection />
      <VideosSection />
      <ChannelFooter />
    </div>
  );
}
