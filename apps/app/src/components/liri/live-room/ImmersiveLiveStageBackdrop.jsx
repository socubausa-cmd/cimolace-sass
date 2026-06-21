/**
 * Décor commun messagerie live + LiveRoomShell : base #090D14, halos studio, grille, parallax léger.
 * Variante `arena` : fond type maquette LIRI (#0a0908), halos or / bronze, moins d'indigo.
 * Variante `liriHost` : #0a0612, halo violet bas, ambiance cognitive (spec maquette LIRI host).
 */
export default function ImmersiveLiveStageBackdrop({ parallax = { x: 0, y: 0 }, variant = 'default' }) {
  const { x, y } = parallax;
  const isArena = variant === 'arena';
  const isLiriHost = variant === 'liriHost';
  return (
    <>
      <div
        className={
          isLiriHost
            ? 'absolute inset-0 bg-[#0a0612]'
            : isArena
              ? 'absolute inset-0 bg-[#0a0908]'
              : 'absolute inset-0 bg-[#090D14]'
        }
      />
      <div
        className={
          isLiriHost
            ? 'absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,rgba(120,40,180,0.12),transparent_60%),radial-gradient(circle_at_50%_35%,rgba(212,163,106,0.08),transparent_45%),radial-gradient(circle_at_12%_20%,rgba(251,191,36,0.06),transparent_30%)]'
            : isArena
              ? 'absolute inset-0 bg-[radial-gradient(circle_at_14%_11%,rgba(212,175,55,0.16),transparent_32%),radial-gradient(circle_at_50%_42%,rgba(212,163,106,0.11),transparent_42%),radial-gradient(circle_at_88%_22%,rgba(212,163,106,0.12),transparent_28%),radial-gradient(circle_at_50%_92%,rgba(212,175,55,0.12),transparent_36%)]'
              : 'absolute inset-0 bg-[radial-gradient(circle_at_14%_11%,rgba(212,175,55,0.12),transparent_32%),radial-gradient(circle_at_86%_20%,rgba(99,102,241,0.1),transparent_30%),radial-gradient(circle_at_50%_88%,rgba(56,189,248,0.07),transparent_34%)]'
        }
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[18%] left-[16%] h-[min(26rem,48vw)] w-[min(26rem,48vw)] rounded-full bg-white/[0.055] blur-[110px]" />
        <div className="absolute bottom-[-10%] right-[4%] h-[min(22rem,42vw)] w-[min(22rem,42vw)] rounded-full bg-[var(--school-accent)]/[0.13] blur-[100px]" />
        {isLiriHost ? (
          <>
            <div className="absolute bottom-[-6%] left-1/2 h-[5.5rem] w-[min(24rem,55vw)] -translate-x-1/2 rounded-full bg-orange-500/[0.08] blur-[40px]" />
            <div className="absolute left-[48%] top-[32%] h-[min(32rem,65vh)] w-[min(38rem,72vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,163,106,0.12)_0%,rgba(88,28,135,0.06)_40%,transparent_65%)] blur-[80px]" />
          </>
        ) : null}
        {isArena && !isLiriHost ? (
          <>
            <div className="absolute left-[48%] top-[28%] h-[min(36rem,70vh)] w-[min(42rem,78vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.11)_0%,rgba(212,163,106,0.08)_38%,transparent_62%)] blur-[72px]" />
            <div className="absolute right-[-2%] top-[18%] h-[min(20rem,36vh)] w-[min(18rem,24vw)] rounded-full bg-amber-500/[0.14] blur-[76px]" />
          </>
        ) : null}
        <div
          className={
            isLiriHost
              ? 'absolute top-[38%] -left-[4%] h-[16rem] w-[16rem] rounded-full bg-amber-600/[0.09] blur-[88px]'
              : isArena
                ? 'absolute top-[38%] -left-[4%] h-[16rem] w-[16rem] rounded-full bg-[var(--school-accent)]/[0.07] blur-[88px]'
                : 'absolute top-[38%] -left-[4%] h-[16rem] w-[16rem] rounded-full bg-amber-500/[0.09] blur-[88px]'
          }
        />
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <div
          className={
            isLiriHost
              ? 'absolute inset-0 bg-[radial-gradient(circle_at_22%_14%,rgba(255,255,255,0.05),transparent_38%),radial-gradient(circle_at_78%_20%,rgba(212,163,106,0.12),transparent_28%),radial-gradient(circle_at_50%_90%,rgba(120,40,180,0.08),transparent_36%)] transition-transform duration-500'
              : isArena
                ? 'absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.07),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(212,175,55,0.14),transparent_28%),radial-gradient(circle_at_50%_48%,rgba(212,163,106,0.06),transparent_38%),radial-gradient(circle_at_50%_88%,rgba(212,175,55,0.1),transparent_32%)] transition-transform duration-500'
                : 'absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.09),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(212,175,55,0.11),transparent_30%),radial-gradient(circle_at_50%_85%,rgba(99,102,241,0.1),transparent_34%)] transition-transform duration-500'
          }
          style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.05),transparent)] transition-transform duration-700"
          style={{ transform: `translate3d(${x * -0.5}px, ${y * -0.4}px, 0)` }}
        />
        <div
          className={
            isLiriHost
              ? 'absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px]'
              : 'absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:52px_52px]'
          }
          style={{ transform: `translate3d(${x * 0.25}px, ${y * 0.2}px, 0)` }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_28%,rgba(0,0,0,0.38))]" />
      </div>
    </>
  );
}
