import React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef(({ className, variant = "default", ...props }, ref) => {
  const baseStyles = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/45 focus:ring-offset-0"
  
  const variants = {
    default: "border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#f0d98a] hover:bg-[#D4AF37]/20",
    secondary: "border-white/15 bg-white/5 text-gray-200 hover:bg-white/10",
    destructive: "border-red-400/30 bg-red-500/15 text-red-200 hover:bg-red-500/20",
    outline: "border-white/15 bg-transparent text-gray-300"
  }

  return (
    <div
      ref={ref}
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    />
  )
})

Badge.displayName = "Badge"

export { Badge }