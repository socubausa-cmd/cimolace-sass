import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const ThreeDMarquee = ({ images = [], className }) => {
  const chunkSize = Math.ceil(images.length / 3);
  const chunks = Array.from({ length: 3 }, (_, colIndex) => {
    const start = colIndex * chunkSize;
    return images.slice(start, start + chunkSize);
  });

  return (
    <div
      className={cn('w-full overflow-hidden rounded-xl', className)}
      style={{ height: '520px', perspective: '1200px' }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '680px',
            height: '680px',
            flexShrink: 0,
            transform: 'scale(1.25)',
          }}
        >
          <div
            style={{
              transform: 'rotateX(45deg) rotateZ(45deg)',
              transformStyle: 'preserve-3d',
              position: 'relative',
              top: 0,
              right: '-50%',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              width: '100%',
              height: '100%',
              transformOrigin: 'top left',
            }}
          >
            {chunks.map((subarray, colIndex) => (
              <motion.div
                key={colIndex + 'marquee'}
                animate={{ y: colIndex % 2 === 0 ? 80 : -80 }}
                transition={{
                  duration: colIndex % 2 === 0 ? 10 : 14,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  ease: 'easeInOut',
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                {subarray.map((src, imageIndex) => (
                  <div
                    key={imageIndex + src}
                    style={{
                      width: '100%',
                      height: '160px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      backgroundColor: '#1a1a2e',
                    }}
                  >
                    <img
                      src={src}
                      draggable={false}
                      alt={`App ${imageIndex + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        userSelect: 'none',
                      }}
                    />
                  </div>
                ))}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreeDMarquee;
