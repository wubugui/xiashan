import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearLocalSaveAndReload } from '@/lib/saveReset';

interface Props {
  className?: string;
  compact?: boolean;
}

export default function ResetSaveButton({ className, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  // 'warn' = 第一道（说明后果）；'final' = 第二道（最终二次确认），两道独立点击防误触
  const [step, setStep] = useState<'warn' | 'final'>('warn');
  const close = () => { setOpen(false); setStep('warn'); };

  return (
    <>
      <button
        type="button"
        onClick={() => { setStep('warn'); setOpen(true); }}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-400/30',
          'bg-rose-500/10 text-rose-200 shadow-lg shadow-rose-950/20 backdrop-blur-md',
          'transition-colors hover:bg-rose-500/20 active:scale-[0.98]',
          compact ? 'h-8 px-2.5 text-[11px] font-bold' : 'h-9 px-3 text-xs font-black',
          className,
        )}
      >
        <Trash2 size={compact ? 13 : 14} />
        {compact ? '清档' : '清空存档'}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
            onClick={close}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-2xl border border-rose-400/30 bg-slate-900 p-5 shadow-2xl"
            >
              <button
                type="button"
                onClick={close}
                className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>

              <div className="mb-4 pr-6">
                <h2 className="text-base font-black text-white">
                  {step === 'warn' ? '把便利屋的灯关掉，重新开张？' : '真的要从第一天重新来过？'}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {step === 'warn'
                    ? '这会清空你和她们之间的全部记忆——结识的人、攒下的灵石与票券、做过的委托、手机里的消息，都会随这盏灯一起熄灭，无法找回。下一次推门进来，一切从第一天重新开始。'
                    : '决定了就没有回头路：当前的进度会立刻全部清空、无法恢复。确定要送走现在这家便利屋、重新开张吗？'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => (step === 'final' ? setStep('warn') : close())}
                  className="flex-1 rounded-xl border border-white/10 bg-slate-800 py-2.5 text-sm font-bold text-slate-200"
                >
                  {step === 'warn' ? '再想想' : '返回'}
                </button>
                <button
                  type="button"
                  onClick={() => (step === 'warn' ? setStep('final') : clearLocalSaveAndReload())}
                  className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-black text-white shadow-lg shadow-rose-950/30"
                >
                  {step === 'warn' ? '我想好了' : '熄灯，重新开始'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
