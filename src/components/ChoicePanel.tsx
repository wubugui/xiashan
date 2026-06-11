import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Choice {
  text: string;
  nextNodeId: string;
}

interface ChoicePanelProps {
  choices: Choice[];
  onSelect: (index: number) => void;
}

export default function ChoicePanel({ choices, onSelect }: ChoicePanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="mx-4 flex w-full max-w-md flex-col gap-4">
        {choices.map((choice, index) => (
          <motion.button
            key={choice.nextNodeId}
            initial={{ x: -60, opacity: 0, scale: 0.9 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            transition={{
              delay: 0.15 * index + 0.2,
              type: 'spring',
              damping: 20,
              stiffness: 200,
            }}
            whileHover={{
              scale: 1.03,
              boxShadow: '0 0 30px rgba(251, 191, 36, 0.3), 0 0 60px rgba(251, 191, 36, 0.1)',
            }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(index)}
            className={cn(
              'group relative overflow-hidden rounded-lg',
              'bg-slate-800/80 backdrop-blur-md',
              'border border-slate-600/50',
              'px-6 py-4 text-left',
              'transition-colors duration-200',
              'hover:border-amber-400/60',
              'hover:bg-slate-700/80',
            )}
          >
            {/* 左侧装饰条 */}
            <div
              className={cn(
                'absolute left-0 top-0 h-full w-1',
                'bg-gradient-to-b from-amber-400/0 via-amber-400/60 to-amber-400/0',
                'transition-all duration-300',
                'group-hover:via-amber-400 group-hover:w-1.5',
              )}
            />

            {/* 悬停光效 */}
            <div
              className={cn(
                'absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                'bg-gradient-to-r from-amber-400/5 via-transparent to-transparent',
              )}
            />

            {/* 序号 */}
            <span className="mr-3 text-sm font-bold text-amber-400/60 group-hover:text-amber-400">
              {index + 1}.
            </span>

            {/* 选项文本 */}
            <span className="relative text-base text-gray-200 group-hover:text-white">
              {choice.text}
            </span>

            {/* 右侧箭头 */}
            <motion.span
              className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400/0 transition-colors duration-200 group-hover:text-amber-400/80"
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              ›
            </motion.span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
