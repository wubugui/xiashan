import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { preloadAllAssets } from '@/lib/preloader';
import { cn } from '@/lib/utils';

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cacheHit = false;
    preloadAllAssets((l, t) => {
      if (l === 1 && t === 1) cacheHit = true;
      setLoaded(l);
      setTotal(t);
    }).then(() => {
      setTimeout(onComplete, cacheHit ? 120 : 350);
    });
  }, [onComplete]);

  const pct = total > 0 ? (loaded / total) * 100 : 0;
  const indeterminate = total === 0;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-[#080b18]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,216,128,0.20),transparent_30%),radial-gradient(circle_at_18%_72%,rgba(236,72,153,0.14),transparent_32%),radial-gradient(circle_at_84%_78%,rgba(56,189,248,0.12),transparent_34%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,rgba(255,255,255,0.32)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/10" />
      <div className="absolute left-1/2 top-1/2 h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-200/10" />

      <div className="relative z-10 flex w-full max-w-xs flex-col items-center gap-10 px-8">
        <div className="text-center">
          <div
            className={cn(
              'mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[1.35rem]',
              'border border-amber-100/20 bg-white/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl',
            )}
          >
            <span
              className="bg-gradient-to-br from-amber-200 via-rose-100 to-fuchsia-200 bg-clip-text text-4xl font-black leading-none text-transparent"
              style={{ fontFamily: '"Didot","Bodoni 72","Times New Roman",serif' }}
            >
              25
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-[0.18em] text-amber-100">
            25时便利屋
          </h1>
          <p className="mt-2 text-xs tracking-[0.24em] text-rose-100/55">
            夜色正在点亮货架
          </p>
        </div>

        <div className="w-full">
          <div className="mb-2 flex justify-between text-xs text-slate-400">
            <span>{indeterminate ? '检查资源' : '加载中'}</span>
            <span>{loaded} / {total}</span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
            {indeterminate ? (
              <motion.div
                className="absolute top-0 h-full w-1/3 rounded-full bg-gradient-to-r from-amber-300 via-rose-300 to-fuchsia-400"
                animate={{ left: ['-33%', '133%'] }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
              />
            ) : (
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-rose-300 to-fuchsia-400"
                initial={{ width: '0%' }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
