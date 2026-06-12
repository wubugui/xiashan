import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { preloadAllAssets } from '@/lib/preloader';

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    preloadAllAssets((l, t) => {
      setLoaded(l);
      setTotal(t);
    }).then(() => {
      setTimeout(onComplete, 350);
    });
  }, [onComplete]);

  const pct = total > 0 ? (loaded / total) * 100 : 0;
  const indeterminate = total === 0;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#101827]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute -right-16 top-0 h-28 w-[40vw] -skew-x-[28deg] bg-fuchsia-500/40" />
      <div className="absolute -left-14 top-24 h-24 w-[22vw] -skew-x-[28deg] bg-purple-500/40" />
      <div className="absolute -bottom-20 right-0 h-48 w-[64vw] -skew-x-[24deg] bg-fuchsia-500/40" />

      <div className="relative z-10 flex w-full max-w-xs flex-col items-center gap-10 px-8">
        <div className="text-center">
          <div className="mb-3 text-5xl">🏪</div>
          <h1 className="text-2xl font-black tracking-widest text-white">仙山便利屋</h1>
          <p className="mt-2 text-xs text-slate-400">正在加载资源…</p>
        </div>

        <div className="w-full">
          <div className="mb-2 flex justify-between text-xs text-slate-500">
            <span>加载中</span>
            <span>{loaded} / {total}</span>
          </div>

          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            {indeterminate ? (
              <motion.div
                className="absolute top-0 h-full w-1/3 rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500"
                animate={{ left: ['-33%', '133%'] }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
              />
            ) : (
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500"
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
