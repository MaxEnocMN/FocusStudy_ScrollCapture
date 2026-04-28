/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { ArrowUp, ArrowDown, ChevronsUp, ChevronsDown } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';

// --- CONSTANTS ---
const CHUNK_HEIGHT = 3000; // Safer chunk height for mobile GPU
const DEFAULT_WIDTH = 1362;
const DEFAULT_HEIGHT = 23692;

export default function App() {
  const [imageObject, setImageObject] = useState<HTMLImageElement | null>(null);
  const [fileSessionId, setFileSessionId] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dimensions, setDimensions] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  
  const scrollY = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Measure screen
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight || 800 : 800);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth || 1200 : 1200);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setViewportHeight(window.innerHeight || 800);
      setViewportWidth(window.innerWidth || 1200);
    };
    handleResize(); // Execute immediately
    
    // Add a slight delay to capture correct dimensions in some environments (like frames)
    const timeout = setTimeout(handleResize, 100);
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, []);

  // Premium Inertia Spring
  const smoothY = useSpring(scrollY, {
    stiffness: 100,
    damping: 30,
    mass: 1,
  });

  // Calculate Scale
  const scale = useMemo(() => {
    const w = dimensions.width || DEFAULT_WIDTH;
    const vw = viewportWidth || 1200;
    return (vw * 0.95) / w;
  }, [viewportWidth, dimensions.width]);

  const scaledHeight = useMemo(() => {
    return (dimensions.height || DEFAULT_HEIGHT) * scale;
  }, [dimensions.height, scale]);

  const canvasWidth = useMemo(() => {
    return Math.max(1, Math.floor((dimensions.width || DEFAULT_WIDTH) * scale));
  }, [dimensions.width, scale]);

  // Scroll Limits
  const centerPos = useMemo(() => viewportHeight / 2, [viewportHeight]);
  const minScroll = useMemo(() => centerPos - scaledHeight, [centerPos, scaledHeight]);
  const maxScroll = useMemo(() => centerPos, [centerPos]);

  // Initial centering
  useEffect(() => {
    if (viewportHeight > 0) {
      scrollY.set(centerPos);
    }
  }, [viewportHeight, centerPos, scrollY]);

  // Handle File
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setDimensions({ width: img.width, height: img.height });
        setImageObject(img);
        setFileSessionId(prev => prev + 1);
        setIsProcessing(false);
        scrollY.set(viewportHeight / 2);
      };
      img.onerror = () => {
        alert("Could not decode image.");
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      alert("Could not read file.");
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  // Papyrus Segments Calculation
  const chunks = useMemo(() => {
    if (!imageObject) return [];
    const arr = [];
    let currentY = 0;
    while (currentY < dimensions.height) {
      const h = Math.min(CHUNK_HEIGHT, dimensions.height - currentY);
      arr.push({ y: currentY, h });
      currentY += h;
    }
    return arr;
  }, [dimensions.height, imageObject]);

  // Depth & Progress Logic
  const depth = useTransform(smoothY, (val) => {
    const d = Math.max(0, (centerPos - val) / (scale || 1));
    return Math.round(d);
  });

  const progressValue = useTransform(smoothY, (val) => {
    const range = maxScroll - minScroll;
    const p = ((maxScroll - val) / (range || 1)) * 100;
    return Math.max(0, Math.min(100, p));
  });

  const progressPercent = useTransform(progressValue, (p) => `${p}%`);

  const arrowUpOpacity = useTransform(progressValue, [0, 5], [0, 1]);
  const arrowDownOpacity = useTransform(progressValue, [95, 100], [1, 0]);

  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  const resetApp = useCallback(() => {
    setImageObject(null);
    setFileSessionId(0);
    scrollY.set(viewportHeight / 2); 
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [scrollY, viewportHeight]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartRef.current.x;
    const startY = touchStartRef.current.y;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const duration = Date.now() - touchStartRef.current.time;

    // Gesture: Top-Right to Bottom-Left
    // 1. Started in top-right area (top 30%, right 30%)
    // 2. Ended in bottom-left area (bottom 30%, left 30%)
    // 3. Fast enough gesture
    if (duration < 500) {
      const startedTopRight = startX > viewportWidth * 0.7 && startY < viewportHeight * 0.3;
      const endedBottomLeft = endX < viewportWidth * 0.3 && endY > viewportHeight * 0.7;

      if (startedTopRight && endedBottomLeft) {
        resetApp();
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#121212] select-none touch-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef}
        onChange={onFileChange}
      />

      {/* Papyrus Roll Visual Effects */}
      <div className="vignette z-30" />
      
      {/* Curved Roll Shadows (Simulating the Papyri edge) */}
      <div className="absolute top-[30%] left-0 w-full h-[40px] bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-30" />
      <div className="absolute bottom-[30%] left-0 w-full h-[40px] bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-30" />
      
      {/* Center Focus Guides */}
      <div className="focus-guides z-30">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-white/20 rounded-full blur-[1px]" />
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-white/20 rounded-full blur-[1px]" />
      </div>

      {/* UI: Header */}
      <div className="absolute top-0 left-0 w-full p-6 md:p-10 flex justify-between items-start pointer-events-none z-40">
        <div className="status-pill backdrop-blur-md border-white/5 bg-black/20">PAPYRUS • STUDY</div>
        {imageObject && (
          <motion.div className="status-pill text-[#888] backdrop-blur-md bg-black/20">
            DEPTH: <DepthDisplay value={depth} /> PX
          </motion.div>
        )}
      </div>

      {/* Navigation Arrows & Jump Buttons */}
      {imageObject && (
        <>
          <motion.div 
            style={{ opacity: arrowUpOpacity }}
            className="absolute top-24 left-8 z-[60] pointer-events-none flex flex-col items-center gap-2"
          >
            <button 
              onClick={(e) => {
                e.stopPropagation();
                scrollY.set(maxScroll);
              }}
              className="p-4 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all group pointer-events-auto cursor-pointer backdrop-blur-sm"
              title="Jump to Start"
            >
              <ChevronsUp className="w-5 h-5 text-white/60 group-hover:text-white/90" />
            </button>
            <div className="w-[1px] h-4 bg-white/10" />
            <ArrowUp className="w-4 h-4 text-white/20 animate-bounce" />
          </motion.div>

          <motion.div 
            style={{ opacity: arrowDownOpacity }}
            className="absolute bottom-24 left-8 z-[60] pointer-events-none flex flex-col items-center gap-2"
          >
            <ArrowDown className="w-4 h-4 text-white/20 animate-bounce" />
            <div className="w-[1px] h-4 bg-white/10" />
            <button 
              onClick={(e) => {
                e.stopPropagation();
                scrollY.set(minScroll);
              }}
              className="p-4 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all group pointer-events-auto cursor-pointer backdrop-blur-sm"
              title="Jump to End"
            >
              <ChevronsDown className="w-5 h-5 text-white/60 group-hover:text-white/90" />
            </button>
          </motion.div>
        </>
      )}

      {/* Loading/Empty State */}
      {!imageObject && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-6">
              <div className="w-12 h-12 border-2 border-white/5 border-t-white/60 rounded-full animate-spin" />
              <p className="text-[10px] tracking-[4px] text-[#555] uppercase font-mono">Unrolling Ancient Scroll...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-8">
              <div className="text-center space-y-4">
                <h1 className="text-white/80 text-xl tracking-[10px] uppercase font-light">Papyrus</h1>
                <p className="text-[#444] text-[9px] tracking-[3px] uppercase max-w-[200px] leading-relaxed">
                  Deep focus reading environment for long vertical captures.
                </p>
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="status-pill !pointer-events-auto hover:bg-white/10 active:scale-95 transition-all text-white border-white/20 hover:border-white/40 cursor-pointer"
              >
                Load PNG Capture
              </button>
            </div>
          )}
        </div>
      )}

      {/* Navigation Hint */}
      {imageObject && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-6 pointer-events-none z-40"
        >
          <div className="w-[1px] h-20 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <p className="text-[9px] [writing-mode:vertical-rl] tracking-[6px] text-[#444] uppercase font-bold">Slide to Study</p>
          <div className="w-[1px] h-20 bg-gradient-to-t from-transparent via-white/10 to-transparent" />
        </motion.div>
      )}

      {/* Progress Bar Footer */}
      {imageObject && (
        <div className="absolute bottom-10 left-0 w-full flex flex-col items-center pointer-events-none z-40">
          <div className="w-48 h-[1px] bg-white/5 relative overflow-hidden">
            <motion.div 
              className="absolute left-0 top-0 h-full bg-[#555]"
              style={{ width: progressPercent }}
            />
          </div>
          <div className="mt-4 text-[8px] tracking-[4px] text-[#333] uppercase">Session Progress</div>
        </div>
      )}

      {/* The Scrollable Papyrus */}
      {imageObject && (
        <motion.div
          className="absolute left-0 right-0 z-10"
          style={{ 
            y: smoothY,
            willChange: 'transform',
            transformStyle: 'preserve-3d'
          }}
          drag="y"
          dragConstraints={{ top: minScroll, bottom: maxScroll }}
          dragElastic={0.1}
        >
          <div className="flex flex-col items-center">
            {chunks.map((chunk, i) => (
              <PapyrusChunk 
                key={`${fileSessionId}-${i}`}
                image={imageObject}
                chunk={chunk}
                scale={scale}
                canvasWidth={canvasWidth}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * HIGH-PERFORMANCE CANVAS RENDERER
 * Renders a specific slice of the image to a canvas to stay within GPU limits.
 */
interface ChunkProps {
  image: HTMLImageElement;
  chunk: { y: number; h: number };
  scale: number;
  canvasWidth: number;
}

const PapyrusChunk: React.FC<ChunkProps> = ({ image, chunk, scale, canvasWidth }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Fixed scaled height to be integer
    const targetHeight = Math.floor(chunk.h * scale);

    // Clear and draw
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(
      image,
      0, chunk.y, image.width, chunk.h,
      0, 0, canvasWidth, targetHeight
    );
  }, [image, chunk, scale, canvasWidth]);

  return (
    <canvas 
      ref={canvasRef}
      width={canvasWidth}
      height={Math.floor(chunk.h * scale)}
      className="block"
      style={{
        width: '95vw',
        height: 'auto',
        backgroundColor: '#121212'
      }}
    />
  );
};

/**
 * Utility component to display a motion value without re-rendering the parent.
 */
function DepthDisplay({ value }: { value: any }) {
  const ref = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    return value.on("change", (v: number) => {
      if (ref.current) {
        ref.current.textContent = Math.round(v).toLocaleString();
      }
    });
  }, [value]);

  return <span ref={ref} className="text-white font-mono">{Math.round(value.get()).toLocaleString()}</span>;
}

