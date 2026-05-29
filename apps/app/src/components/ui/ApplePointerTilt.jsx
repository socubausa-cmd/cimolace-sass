import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { cn } from '@/lib/utils';

const springCfg = { stiffness: 300, damping: 28 };
const hoverSpring = { stiffness: 440, damping: 26 };

/**
 * Inclinaison 3D douce suivant la souris (style cartes Apple / Prorascience commercial).
 * Ajoute un léger parallax 2D + zoom au survol : reste visible dans une colonne `overflow-y-auto`
 * (où le 3D peut être aplati). Désactivée si `disabled` ou `prefers-reduced-motion`.
 */
export function ApplePointerTilt({
  children,
  className,
  disabled = false,
  /** Amplitude max en degrés (rotation X / Y dérivée) */
  tiltDeg = 5,
  /** Léger agrandissement au survol (1 = désactivé) */
  hoverScale = 1.06,
}) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [tiltDeg, -tiltDeg]), springCfg);
  const rotateY = useSpring(
    useTransform(mx, [-0.5, 0.5], [-tiltDeg * 1.22, tiltDeg * 1.22]),
    springCfg,
  );
  /** Rotation + translation 2D : couplées à tiltDeg pour le même ressenti dock plateau / messagerie */
  const rotateZ = useSpring(
    useTransform(mx, [-0.5, 0.5], [-tiltDeg * 0.62, tiltDeg * 0.62]),
    springCfg,
  );
  const tx = useSpring(
    useTransform(mx, [-0.5, 0.5], [-tiltDeg * 1.35, tiltDeg * 1.35]),
    springCfg,
  );
  const ty = useSpring(
    useTransform(my, [-0.5, 0.5], [-tiltDeg * 1.12, tiltDeg * 1.12]),
    springCfg,
  );
  const scale = useSpring(1, hoverSpring);

  const trackPointer = (e) => {
    if (reduce || disabled) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  const onPointerLeave = () => {
    mx.set(0);
    my.set(0);
    scale.set(1);
  };

  const onPointerEnter = () => {
    if (reduce || disabled || hoverScale <= 1) return;
    scale.set(hoverScale);
  };

  return (
    <motion.div
      className={cn(
        'will-change-transform overflow-hidden',
        /** Évite que les <video> LiveKit « débordent » visuellement sur le voisin (colonne latérale / plateau). */
        className,
      )}
      style={{
        rotateX: reduce || disabled ? 0 : rotateX,
        rotateY: reduce || disabled ? 0 : rotateY,
        rotateZ: reduce || disabled ? 0 : rotateZ,
        x: reduce || disabled ? 0 : tx,
        y: reduce || disabled ? 0 : ty,
        scale: reduce || disabled ? 1 : scale,
        transformPerspective: 1100,
        transformStyle: 'preserve-3d',
        isolation: 'isolate',
      }}
      onPointerMoveCapture={trackPointer}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </motion.div>
  );
}
