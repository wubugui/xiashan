import { motion } from 'framer-motion';
import { Music2, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { primeBackgroundMusic, setBackgroundMusicEnabled } from '@/lib/backgroundMusic';

interface AudioPermissionGateProps {
  onComplete: () => void;
}

export default function AudioPermissionGate({ onComplete }: AudioPermissionGateProps) {
  const enterWithAudio = () => {
    setBackgroundMusicEnabled(true);
    primeBackgroundMusic();
    onComplete();
  };

  const enterMuted = () => {
    setBackgroundMusicEnabled(false);
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#050914] px-5"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(251,191,36,0.18),transparent_30%),radial-gradient(circle_at_18%_82%,rgba(236,72,153,0.12),transparent_34%),radial-gradient(circle_at_82%_76%,rgba(56,189,248,0.10),transparent_34%)]" />
      <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle,rgba(255,255,255,0.32)_1px,transparent_1px)] [background-size:18px_18px]" />

      <motion.div
        initial={{ y: 18, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className={cn(
          'relative w-full max-w-sm overflow-hidden rounded-2xl',
          'border border-white/12 bg-slate-950/78 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl',
        )}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-100/20 bg-amber-300/10 text-amber-100 shadow-[0_0_32px_rgba(251,191,36,0.18)]">
          <Music2 size={25} />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-black tracking-wide text-white">开启第25小时的声音</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            建议开启背景音乐与角色语音，夜色会更完整。
          </p>
        </div>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={enterWithAudio}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/25 transition active:scale-[0.98]"
          >
            <Volume2 size={18} />
            开启声音进入
          </button>
          <button
            type="button"
            onClick={enterMuted}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-bold text-slate-200 transition hover:bg-white/[0.07] active:scale-[0.98]"
          >
            <VolumeX size={17} />
            静音进入
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
