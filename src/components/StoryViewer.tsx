import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { assetUrl } from '@/lib/assets';

interface StoryViewerProps {
  title: string;
  image?: string;
  paragraphs: string[];
  onClose: () => void;
}

/**
 * 全屏图文记述查看器：立绘 + 逐段点按推进的文字。
 * 用于影像回放中尚无视频素材的条目（关系阶段解锁内容等）。
 */
export default function StoryViewer({ title, image, paragraphs, onClose }: StoryViewerProps) {
  /** 已展示到第几段（含） */
  const [revealed, setRevealed] = useState(0);
  const isLast = revealed >= paragraphs.length - 1;

  const advance = () => {
    if (isLast) onClose();
    else setRevealed(r => r + 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[300] flex flex-col bg-black"
      onClick={advance}
    >
      {/* 立绘区 */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {image ? (
          <img
            src={assetUrl(image)}
            alt={title}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-slate-900 to-black" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />

        {/* 关闭 */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          <X size={18} />
        </button>

        <p className="absolute left-4 top-5 text-sm font-bold text-white/80 drop-shadow">{title}</p>
      </div>

      {/* 文字区 */}
      <div className="shrink-0 px-5 pb-8 pt-2" style={{ minHeight: '38%' }}>
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          <AnimatePresence initial={false}>
            {paragraphs.slice(0, revealed + 1).map((p, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: i === revealed ? 1 : 0.45 }}
                transition={{ duration: 0.35 }}
                className="text-sm leading-relaxed text-white"
              >
                {p}
              </motion.p>
            ))}
          </AnimatePresence>
          <p className="mt-1 text-center text-[10px] text-white/30">
            {isLast ? '点按任意处结束' : `点按继续 · ${revealed + 1}/${paragraphs.length}`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
