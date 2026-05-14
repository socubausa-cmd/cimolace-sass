import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Lightweight scroll-triggered animation wrapper.
 * Mimics the `TimelineContent` API: accepts `as`, `animationNum`, `timelineRef`, `customVariants`.
 */
export function TimelineContent({
  as = "div",
  children,
  animationNum = 0,
  customVariants,
  className,
  style,
  ...props
}) {
  const Tag = motion[as] || motion.div;

  const defaultVariants = {
    hidden:  { opacity: 0, y: -20, filter: "blur(10px)" },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { delay: i * 0.15, duration: 0.5 },
    }),
  };

  return (
    <Tag
      className={cn(className)}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-5%" }}
      custom={animationNum}
      variants={customVariants || defaultVariants}
      {...props}
    >
      {children}
    </Tag>
  );
}
