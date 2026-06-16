import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { playSound } from '@/lib/sound';
import { assetUrl } from '@/lib/assets';
import type { DateScene } from '@/data/scenes';

/**
 * 约会解锁场景的揭示：把这次约会的场景图华丽地展开，配她那句「这次去了哪」。
 * 提示这段回忆已收入心动名册。点任意处收下。
 */
export default function DateReveal({ scene, characterName, onClose }: { scene: DateScene; characterName: string; onClose: () => void }) {
  useEffect(() => {
    playSound('stage-up');
    confetti({ particleCount: 120, spread: 80, startVelocity: 36, origin: { y: 0.5 }, scalar: 1, colors: ['#fda4af', '#fb7185', '#fff', '#f9a8d4'] });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/85 px-6 backdrop-blur-sm"
    >
      <motion.p
        initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
        className="relative z-10 mb-3 text-center text-sm font-bold tracking-wide text-rose-200"
      >
        和{characterName}的约会 · 新回忆
      </motion.p>

      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 16, stiffness: 150, delay: 0.05 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border-2 border-rose-300/60 shadow-[0_0_30px_rgba(251,113,133,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={assetUrl(scene.image)} alt={scene.title} className="aspect-video w-full object-cover" />
        <div className="bg-gradient-to-t from-black/90 to-black/40 p-4">
          <p className="text-lg font-black text-white">{scene.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-100/90">{scene.dateHook}</p>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        className="relative z-10 mt-4 text-center text-[11px] text-white/55"
      >
        这段回忆已收入「心动名册」· 点击任意处收下
      </motion.p>
    </motion.div>
  );
}
