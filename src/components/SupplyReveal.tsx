import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { playSound } from '@/lib/sound';
import { vibrate, VIBE, shakeKeyframes } from '@/lib/fx';

/**
 * 补给池非人物出货的开箱演出：悬念抖动 → 翻牌揭示。
 * tier 'rare'（SR 卡 / 灵石大袋）带金光特写 + 彩带，需点击关闭；
 * tier 'normal' 短暂展示后自动关闭。
 * 人物出货不走这里（用全屏 GachaAnimation）。
 */
export interface RevealItem {
  tier: 'normal' | 'rare';
  icon: string;
  name: string;
  /** 类型/数量等副标题 */
  sub: string;
  desc: string;
  pityRemain: number;
}

export default function SupplyReveal({ item, onClose }: { item: RevealItem; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
    const t1 = window.setTimeout(() => {
      setRevealed(true);
      vibrate(item.tier === 'rare' ? VIBE.heavy : VIBE.light);
      if (item.tier === 'rare') {
        playSound('gacha-impact');
        confetti({ particleCount: 120, spread: 80, startVelocity: 38, origin: { y: 0.5 }, scalar: 0.9 });
      }
    }, 650);
    let t2: number | undefined;
    if (item.tier === 'normal') {
      t2 = window.setTimeout(onClose, 650 + 1600);
    }
    return () => { window.clearTimeout(t1); if (t2) window.clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-8 backdrop-blur-sm"
      onClick={() => revealed && onClose()}
    >
      <AnimatePresence mode="wait">
        {!revealed ? (
          /* 悬念：卡背抖动发光 */
          <motion.div
            key="back"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{
              scale: [0.8, 1, 0.97, 1.02, 1],
              opacity: 1,
              rotate: [0, -3, 3, -2, 0],
            }}
            transition={{ duration: 0.6 }}
            className="flex h-48 w-36 items-center justify-center rounded-2xl border-2 border-violet-400/60 bg-gradient-to-br from-violet-800 to-slate-900 shadow-[0_0_40px_rgba(167,139,250,0.5)]"
          >
            <motion.span
              animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-4xl"
            >
              ✦
            </motion.span>
          </motion.div>
        ) : (
          /* 揭示：稀有货砸入 + 抖一下 */
          <motion.div
            key="front"
            initial={{ scale: 1.7, opacity: 0 }}
            animate={item.tier === 'rare'
              ? { scale: 1, opacity: 1, ...shakeKeyframes(7) }
              : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className={cn(
              'w-64 rounded-2xl border-2 p-5 text-center shadow-2xl',
              item.tier === 'rare'
                ? 'border-amber-300 bg-gradient-to-b from-amber-900/80 to-slate-900 shadow-[0_0_60px_rgba(251,191,36,0.55)]'
                : 'border-sky-400/50 bg-slate-900 shadow-sky-500/20',
            )}
          >
            {item.tier === 'rare' && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-1 text-xs font-black tracking-widest text-amber-300"
              >
                ✨ 稀有补给 ✨
              </motion.p>
            )}
            <motion.div
              animate={item.tier === 'rare' ? { scale: [1, 1.15, 1] } : undefined}
              transition={{ duration: 0.8, repeat: item.tier === 'rare' ? Infinity : 0, repeatDelay: 0.6 }}
              className="text-5xl"
            >
              {item.icon}
            </motion.div>
            <p className={cn('mt-2 text-lg font-black', item.tier === 'rare' ? 'text-amber-200' : 'text-white')}>
              {item.name}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{item.sub}</p>
            <p className="mt-2 text-[11px] leading-snug text-slate-400">{item.desc}</p>
            <p className="mt-3 text-[10px] font-bold text-pink-300">💗 距人物保底还剩 {item.pityRemain} 抽</p>
            <p className="mt-1 text-[10px] text-slate-600">{item.tier === 'rare' ? '点击收下' : '点击关闭'}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
