import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FaceSlapProps {
  characterName: string;
  enemyName: string;
  enemyLine: string;
  characterLine: string;
  resultText: string;
  onComplete: () => void;
}

type Phase = 'shake' | 'enemy' | 'character' | 'result';

export default function FaceSlapEffect({
  characterName,
  enemyName,
  enemyLine,
  characterLine,
  resultText,
  onComplete,
}: FaceSlapProps) {
  const [phase, setPhase] = useState<Phase>('shake');

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 震屏阶段 0.6s
    timers.push(setTimeout(() => setPhase('enemy'), 600));
    // 敌方台词 1.5s
    timers.push(setTimeout(() => setPhase('character'), 2100));
    // 主角台词 1.5s
    timers.push(setTimeout(() => setPhase('result'), 3600));
    // 结果展示 2s 后关闭
    timers.push(setTimeout(() => onComplete(), 5600));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          x: phase === 'shake' ? [0, -8, 8, -6, 6, -3, 3, 0] : 0,
        }}
        transition={{
          x: { duration: 0.5, ease: 'easeOut' },
          opacity: { duration: 0.2 },
        }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm"
      >
        {/* 背景冲击波 */}
        <motion.div
          animate={{
            scale: phase === 'character' ? [1, 2, 1.5] : 1,
            opacity: phase === 'character' ? [0.3, 0.6, 0] : 0,
          }}
          transition={{ duration: 0.8 }}
          className="absolute h-64 w-64 rounded-full bg-amber-400/20 blur-3xl"
        />

        {/* 敌方台词 */}
        <AnimatePresence>
          {phase === 'enemy' && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30, scale: 0.9 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="absolute text-center"
            >
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-3 text-sm font-bold tracking-widest text-red-500/80"
              >
                {enemyName}
              </motion.p>
              <motion.p
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', damping: 12 }}
                className={cn(
                  'text-2xl font-black sm:text-3xl',
                  'bg-gradient-to-r from-red-400 via-red-500 to-red-400',
                  'bg-clip-text text-transparent',
                  'drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]',
                )}
              >
                「{enemyLine}」
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 主角台词 */}
        <AnimatePresence>
          {phase === 'character' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 200 }}
              className="absolute text-center"
            >
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-3 text-sm font-bold tracking-widest text-amber-400/80"
              >
                {characterName}
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, type: 'spring', damping: 12 }}
                className={cn(
                  'text-3xl font-black sm:text-4xl',
                  'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300',
                  'bg-clip-text text-transparent',
                  'drop-shadow-[0_0_25px_rgba(251,191,36,0.6)]',
                )}
              >
                「{characterLine}」
              </motion.p>

              {/* 金色粒子效果 */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    opacity: 1,
                    x: 0,
                    y: 0,
                    scale: 1,
                  }}
                  animate={{
                    opacity: 0,
                    x: (Math.random() - 0.5) * 200,
                    y: (Math.random() - 0.5) * 200,
                    scale: 0,
                  }}
                  transition={{ duration: 1, delay: 0.2 + i * 0.05, ease: 'easeOut' }}
                  className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-amber-400"
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 结果展示 */}
        <AnimatePresence>
          {phase === 'result' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 150 }}
              className="absolute text-center"
            >
              <motion.div
                animate={{
                  textShadow: [
                    '0 0 20px rgba(251,191,36,0.5)',
                    '0 0 40px rgba(251,191,36,0.8)',
                    '0 0 20px rgba(251,191,36,0.5)',
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className={cn(
                  'text-4xl font-black tracking-wider sm:text-5xl',
                  'bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300',
                  'bg-clip-text text-transparent',
                )}
              >
                {resultText}
              </motion.div>

              {/* 装饰线 */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mt-4 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
