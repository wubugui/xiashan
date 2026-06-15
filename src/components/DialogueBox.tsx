import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCssVarFromHeight } from '@/hooks/useCssVarFromHeight';

interface DialogueBoxProps {
  speaker?: string;
  speakerColor?: string;
  text: string;
  onNext: () => void;
  onSkipTyping: () => void;
}

export default function DialogueBox({
  speaker,
  speakerColor = 'text-amber-400',
  text,
  onNext,
  onSkipTyping,
}: DialogueBoxProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  /** 对白框实测高度 → --dlg-h：剧场立绘等浮层据此自适应定位（随平台/字数变化，禁止硬编码） */
  const boxRef = useRef<HTMLDivElement>(null);
  useCssVarFromHeight('--dlg-h', boxRef);

  useEffect(() => {
    setDisplayedText('');
    setCharIndex(0);
  }, [text]);

  useEffect(() => {
    if (charIndex < text.length) {
      const timer = setInterval(() => {
        setCharIndex((prev) => {
          const next = prev + 1;
          setDisplayedText(text.slice(0, next));
          return next;
        });
      }, 40);
      return () => clearInterval(timer);
    }
  }, [charIndex, text]);

  const handleClick = useCallback(() => {
    if (charIndex < text.length) {
      // 打字未完成，跳过打字直接显示全文
      setDisplayedText(text);
      setCharIndex(text.length);
      onSkipTyping();
    } else {
      // 打字已完成，推进到下一句
      onNext();
    }
  }, [charIndex, text, onSkipTyping, onNext]);

  return (
    <AnimatePresence>
      <motion.div
        ref={boxRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe"
        onClick={handleClick}
      >
        <div
          className={cn(
            'relative mx-auto max-w-3xl rounded-xl',
            'bg-slate-900/85 backdrop-blur-xl',
            'border border-slate-700/50',
            'shadow-[0_0_40px_rgba(0,0,0,0.5)]',
            'p-5 pt-4',
          )}
        >
          {/* 顶部装饰线 */}
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

          {/* 说话者名称 */}
          {speaker && (
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="mb-3"
            >
              <span
                className={cn(
                  'inline-block rounded-sm px-3 py-0.5 text-sm font-bold tracking-wider',
                  'bg-gradient-to-r from-amber-500/20 to-transparent',
                  'border-l-2 border-amber-400',
                  speakerColor,
                )}
              >
                {speaker}
              </span>
            </motion.div>
          )}

          {/* 对话文本 */}
          <div className="min-h-[4rem] text-base leading-relaxed text-gray-100 tracking-wide">
            {displayedText}
            {charIndex < text.length && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                className="ml-0.5 inline-block h-4 w-0.5 bg-amber-400 align-text-bottom"
              />
            )}
          </div>

          {/* 继续提示 */}
          {charIndex >= text.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 flex justify-end"
            >
              <motion.span
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className="text-xs text-amber-400/70"
              >
                ▼ 点击继续
              </motion.span>
            </motion.div>
          )}

          {/* 底部装饰线 */}
          <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-slate-600/30 to-transparent" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
