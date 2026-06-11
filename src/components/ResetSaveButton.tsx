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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
            onClick={() => setOpen(false)}
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
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>

              <div className="mb-4 pr-6">
                <h2 className="text-base font-black text-white">清空本地测试存档？</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  会删除角色、票券、委托进度、手机消息和每日签到记录。此操作只影响当前浏览器。
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-slate-800 py-2.5 text-sm font-bold text-slate-200"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={clearLocalSaveAndReload}
                  className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-black text-white shadow-lg shadow-rose-950/30"
                >
                  确认清空
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
