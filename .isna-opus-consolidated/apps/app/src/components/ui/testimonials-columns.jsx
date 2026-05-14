import React from "react";
import { motion } from "framer-motion";

export const TestimonialsColumn = ({ className, testimonials, duration = 10 }) => {
  return (
    <div className={className}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[...Array(2)].map((_, index) => (
          <React.Fragment key={index}>
            {testimonials.map(({ text, image, name, role }, i) => (
              <div
                key={i}
                className="p-7 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm shadow-xl shadow-violet-500/5 max-w-xs w-full hover:border-violet-500/30 transition-colors duration-300"
              >
                <p className="text-sm text-gray-300 leading-relaxed">"{text}"</p>
                <div className="flex items-center gap-3 mt-5">
                  <img
                    width={40}
                    height={40}
                    src={image}
                    alt={name}
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-violet-500/30"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white tracking-tight">{name}</span>
                    <span className="text-xs text-violet-400/80 tracking-tight">{role}</span>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};
