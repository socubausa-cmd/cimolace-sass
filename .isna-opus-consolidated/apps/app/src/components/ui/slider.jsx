import React from "react"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef(({ className, value, onValueChange, onValueCommit, min = 0, max = 100, step = 1, ...props }, ref) => {
  const val = Array.isArray(value) ? value[0] : value || min;
  
  const handleInputChange = (e) => {
    const newValue = parseFloat(e.target.value);
    if (onValueChange) {
      onValueChange([newValue]);
    }
  };

  const percentage = ((val - min) / (max - min)) * 100;

  return (
    <div className={cn("relative flex w-full touch-none select-none items-center", className)} {...props}>
      <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary/20 bg-gray-700">
        <div 
          className="absolute h-full bg-[#D4AF37]" 
          style={{ width: `${percentage}%` }} 
        />
      </div>
      <input
        type="range"
        ref={ref}
        min={min}
        max={max}
        step={step}
        value={val}
        onChange={handleInputChange}
        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer z-10"
      />
      <div 
        className="absolute h-5 w-5 rounded-full border-2 border-[#D4AF37] bg-[#192734] ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 z-0"
        style={{ left: `calc(${percentage}% - 10px)` }}
      />
    </div>
  )
})
Slider.displayName = "Slider"

export { Slider }