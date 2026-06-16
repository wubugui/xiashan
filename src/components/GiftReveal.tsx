import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { playSound } from '@/lib/sound';
import GiftCard, { type GiftCardData } from '@/components/GiftCard';

/**
 * 信物揭示 — 关系加深解锁新信物时的「抽到 SSR」级演出。
 * 暗场 + 金色光爆 + 粒子 + SSR 音效，中央把信物卡华丽地翻出来。点任意处收下。
 */
export default function GiftReveal({ data, characterName, onClose }: { data: GiftCardData; characterName: string; onClose: () => void }) {
  useEffect(() => {
    playSound('gacha-ssr');
    confetti({ particleCount: 160, spread: 90, startVelocity: 42, origin: { y: 0.5 }, scalar: 1.1, colors: ['#fde68a', '#fbbf24', '#fff7cc', '#f59e0b'] });
    const t = window.setTimeout(() => confetti({ particleCount: 90, spread: 110, startVelocity: 30, origin: { y: 0.55 }, scalar: 0.9 }), 350);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/88 px-8 backdrop-blur-sm"
    >
      {/* 光爆 */}
      <motion.div
        initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1.6, opacity: [0, 0.55, 0] }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        className="pointer-events-none absolute h-[60vh] w-[60vh] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.7) 0%, rgba(251,191,36,0.15) 40%, transparent 70%)' }}
      />
      {/* 旋转光芒 */}
      <motion.div
        initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: 360, opacity: 0.25 }}
        transition={{ rotate: { duration: 18, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.8 } }}
        className="pointer-events-none absolute h-[90vh] w-[90vh]"
        style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(253,230,138,0.5) 12deg, transparent 24deg, transparent 60deg, rgba(253,230,138,0.4) 72deg, transparent 84deg)' }}
      />

      <motion.p
        initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
        className="relative z-10 mb-4 text-center text-base font-black tracking-wider text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]"
      >
        {characterName}把一件只给你的信物，交到了你手里
      </motion.p>

      <motion.div
        initial={{ scale: 0.6, rotateY: 90, opacity: 0 }}
        animate={{ scale: 1, rotateY: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 140, delay: 0.1 }}
        className="relative z-10 w-full max-w-[280px]"
        onClick={(e) => e.stopPropagation()}
      >
        <GiftCard data={data} variant="full" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
        className="relative z-10 mt-5 text-xs text-white/55"
      >
        点击任意处收下
      </motion.p>
    </motion.div>
  );
}
