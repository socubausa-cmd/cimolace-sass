/**
 * Sign-in animé — primitives (Input halo, BoxReveal, Ripple, OrbitingCircles).
 * Adapté du composant 21st.dev pour CE codebase : Vite (pas Next), `framer-motion`
 * (pas `motion/react`), `<img>` (pas `next/image`). Thème ISNA : navy + OR #D4AF37.
 */
import {
  memo,
  ReactNode,
  useState,
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  forwardRef,
} from 'react';
import {
  motion,
  useAnimation,
  useInView,
  useMotionTemplate,
  useMotionValue,
} from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const GOLD = '#D4AF37';

// ==================== Input (halo doré au survol) ====================

export const Input = memo(
  forwardRef(function Input(
    { className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>,
    ref: React.ForwardedRef<HTMLInputElement>,
  ) {
    const radius = 120;
    const [visible, setVisible] = useState(false);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent<HTMLDivElement>) {
      const { left, top } = currentTarget.getBoundingClientRect();
      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    }

    return (
      <motion.div
        style={{
          background: useMotionTemplate`radial-gradient(${visible ? radius + 'px' : '0px'} circle at ${mouseX}px ${mouseY}px, ${GOLD}, transparent 80%)`,
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="group/input rounded-xl p-[1.5px] transition duration-300"
      >
        <input
          type={type}
          className={cn(
            'flex h-11 w-full rounded-[10px] border-none bg-[#0d1626] px-3.5 py-2 text-sm text-white shadow-[0px_0px_1px_1px_#1d2a3d] transition duration-400 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 group-hover/input:shadow-none',
            className,
          )}
          ref={ref}
          {...props}
        />
      </motion.div>
    );
  }),
);
(Input as { displayName?: string }).displayName = 'Input';

// ==================== BoxReveal ====================

type BoxRevealProps = {
  children: ReactNode;
  width?: string;
  boxColor?: string;
  duration?: number;
  overflow?: string;
  position?: string;
  className?: string;
};

export const BoxReveal = memo(function BoxReveal({
  children,
  width = 'fit-content',
  boxColor = GOLD,
  duration,
  overflow = 'hidden',
  position = 'relative',
  className,
}: BoxRevealProps) {
  const mainControls = useAnimation();
  const slideControls = useAnimation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      slideControls.start('visible');
      mainControls.start('visible');
    } else {
      slideControls.start('hidden');
      mainControls.start('hidden');
    }
  }, [isInView, mainControls, slideControls]);

  return (
    <section
      ref={ref}
      style={{ position: position as 'relative', width, overflow }}
      className={className}
    >
      <motion.div
        variants={{ hidden: { opacity: 0, y: 75 }, visible: { opacity: 1, y: 0 } }}
        initial="hidden"
        animate={mainControls}
        transition={{ duration: duration ?? 0.5, delay: 0.25 }}
      >
        {children}
      </motion.div>
      <motion.div
        variants={{ hidden: { left: 0 }, visible: { left: '100%' } }}
        initial="hidden"
        animate={slideControls}
        transition={{ duration: duration ?? 0.5, ease: 'easeIn' }}
        style={{ position: 'absolute', top: 4, bottom: 4, left: 0, right: 0, zIndex: 20, background: boxColor, borderRadius: 4 }}
      />
    </section>
  );
});

// ==================== Ripple (anneaux concentriques) ====================

type RippleProps = {
  mainCircleSize?: number;
  mainCircleOpacity?: number;
  numCircles?: number;
  color?: string;
  className?: string;
};

export const Ripple = memo(function Ripple({
  mainCircleSize = 210,
  mainCircleOpacity = 0.24,
  numCircles = 9,
  color = GOLD,
  className = '',
}: RippleProps) {
  return (
    <section
      className={cn('absolute inset-0 flex items-center justify-center [mask-image:linear-gradient(to_bottom,black,transparent)]', className)}
    >
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * 70;
        const opacity = Math.max(mainCircleOpacity - i * 0.03, 0);
        const animationDelay = `${i * 0.06}s`;
        const borderStyle = i === numCircles - 1 ? 'dashed' : 'solid';
        return (
          <span
            key={i}
            className="absolute animate-ripple rounded-full border"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              opacity,
              animationDelay,
              borderStyle,
              borderWidth: '1px',
              borderColor: color,
              background: `radial-gradient(circle, ${color}14, transparent 70%)`,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}
    </section>
  );
});

// ==================== OrbitingCircles ====================

type OrbitingCirclesProps = {
  className?: string;
  children: ReactNode;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
  pathColor?: string;
};

export const OrbitingCircles = memo(function OrbitingCircles({
  className,
  children,
  reverse = false,
  duration = 20,
  delay = 10,
  radius = 50,
  path = true,
  pathColor = 'rgba(212,175,55,0.14)',
}: OrbitingCirclesProps) {
  return (
    <>
      {path && (
        <svg xmlns="http://www.w3.org/2000/svg" version="1.1" className="pointer-events-none absolute inset-0 size-full">
          <circle cx="50%" cy="50%" r={radius} fill="none" stroke={pathColor} strokeWidth={1} />
        </svg>
      )}
      <section
        style={{ '--duration': duration, '--radius': radius, '--delay': -delay } as React.CSSProperties}
        className={cn(
          'absolute flex size-full transform-gpu animate-orbit items-center justify-center rounded-full [animation-delay:calc(var(--delay)*1000ms)]',
          { '[animation-direction:reverse]': reverse },
          className,
        )}
      >
        {children}
      </section>
    </>
  );
});

// ==================== Label ====================

export const Label = memo(function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-xs font-semibold uppercase tracking-wider text-neutral-300', className)}
      {...props}
    />
  );
});

// ==================== BottomGradient (doré) ====================

export const BottomGradient = () => (
  <>
    <span className="absolute -bottom-px inset-x-0 block h-px w-full bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
    <span className="absolute -bottom-px inset-x-10 mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-[#e5c04a] to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
  </>
);

// ==================== AnimatedForm (ISNA navy/or, câblable au vrai auth) ====================

type FieldType = 'text' | 'email' | 'password';

export type AnimatedField = {
  label: string;
  name?: string;
  required?: boolean;
  type: FieldType;
  placeholder?: string;
  value?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

type AnimatedFormProps = {
  header: string;
  subHeader?: ReactNode;
  fields: AnimatedField[];
  submitButton: string;
  submitting?: boolean;
  errorField?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  googleLogin?: string;
  onGoogle?: () => void;
  forgotLabel?: string;
  onForgot?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  footer?: ReactNode;
};

export const AnimatedForm = memo(function AnimatedForm({
  header,
  subHeader,
  fields,
  submitButton,
  submitting,
  errorField,
  onSubmit,
  googleLogin,
  onGoogle,
  forgotLabel,
  onForgot,
  footer,
}: AnimatedFormProps) {
  const [visible, setVisible] = useState(false);

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <BoxReveal duration={0.3}>
        <h2 className="font-serif text-3xl font-bold text-white">{header}</h2>
      </BoxReveal>

      {subHeader && (
        <BoxReveal duration={0.3} className="pb-1">
          <p className="max-w-sm text-sm text-neutral-400">{subHeader}</p>
        </BoxReveal>
      )}

      {googleLogin && (
        <>
          <BoxReveal duration={0.3} overflow="visible" width="unset">
            <button
              type="button"
              onClick={onGoogle}
              disabled={submitting}
              className="group/btn relative h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] font-medium text-white outline-none transition hover:bg-white/[0.06] disabled:opacity-60"
            >
              <span className="flex h-full w-full items-center justify-center gap-3">
                <GoogleIcon />
                {googleLogin}
              </span>
              <BottomGradient />
            </button>
          </BoxReveal>

          <BoxReveal duration={0.3} width="100%">
            <section className="flex items-center gap-4">
              <hr className="flex-1 border-dashed border-white/10" />
              <p className="text-xs uppercase tracking-wider text-neutral-500">ou par email</p>
              <hr className="flex-1 border-dashed border-white/10" />
            </section>
          </BoxReveal>
        </>
      )}

      <form onSubmit={onSubmit}>
        <section className="mb-2 grid grid-cols-1 gap-4">
          {fields.map((field) => (
            <section key={field.label} className="flex flex-col gap-2">
              <BoxReveal duration={0.3}>
                <Label htmlFor={field.name || field.label}>{field.label}</Label>
              </BoxReveal>

              <BoxReveal width="100%" duration={0.3} className="flex w-full flex-col gap-2">
                <section className="relative">
                  <Input
                    type={field.type === 'password' ? (visible ? 'text' : 'password') : field.type}
                    id={field.name || field.label}
                    name={field.name || field.label}
                    placeholder={field.placeholder}
                    value={field.value}
                    onChange={field.onChange}
                    autoComplete={field.type === 'password' ? 'current-password' : 'email'}
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => setVisible((v) => !v)}
                      className="absolute inset-y-0 right-0 z-30 flex items-center pr-3 text-neutral-400 hover:text-[var(--school-accent)]"
                      aria-label={visible ? 'Masquer' : 'Afficher'}
                    >
                      {visible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                    </button>
                  )}
                </section>
              </BoxReveal>
            </section>
          ))}
        </section>

        {forgotLabel && onForgot && (
          <BoxReveal duration={0.3}>
            <div className="mb-4 text-right">
              <button type="button" onClick={onForgot} className="text-xs font-medium text-[var(--school-accent)] hover:underline">
                {forgotLabel}
              </button>
            </div>
          </BoxReveal>
        )}

        {errorField && (
          <BoxReveal width="100%" duration={0.3}>
            <p className="mb-3 text-sm text-red-400">{errorField}</p>
          </BoxReveal>
        )}

        <BoxReveal width="100%" duration={0.3} overflow="visible">
          <button
            type="submit"
            disabled={submitting}
            className="group/btn relative block h-11 w-full rounded-xl bg-[var(--school-accent)] font-bold tracking-wide text-black shadow-[0px_1px_0px_0px_#ffffff40_inset] outline-none transition hover:bg-[#e5c04a] disabled:opacity-60"
          >
            {submitting ? 'Connexion…' : <>{submitButton} &rarr;</>}
            <BottomGradient />
          </button>
        </BoxReveal>

        {footer && (
          <BoxReveal duration={0.3} width="100%">
            <div className="mt-4 text-center text-sm text-neutral-400">{footer}</div>
          </BoxReveal>
        )}
      </form>
    </section>
  );
});

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
