import { PhoneOff } from 'lucide-react';
import { getCharacterById } from '@/data/characters';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assetUrl } from '@/lib/assets';

interface InCallProps {
  characterId: string;
  dialogueLines: string[];
  onEnd: () => void;
  /** 关系够不够：false = 无人接听（响一会儿自动挂） */
  willAnswer?: boolean;
}

const avatarColors: Record<string, string> = {
  suli: '#4FC3F7',
  aruo: '#66BB6A',
  sangluo: '#5C6BC0',
  aman: '#FF7043',
  shenzhaoning: '#FFA726',
  murongxue: '#42A5F5',
  yunzhiyi: '#8D6E63',
  linxia: '#FFCA28',
};

type Phase = 'ringing' | 'connected' | 'noanswer';

export default function InCall({ characterId, dialogueLines, onEnd, willAnswer = true }: InCallProps) {
  const character = getCharacterById(characterId);
  const color = avatarColors[characterId] || '#999';

  const [phase, setPhase] = useState<Phase>('ringing');
  const [callSeconds, setCallSeconds] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const charIndexRef = useRef(0);

  // 呼叫中 → 接通 / 无人接听
  useEffect(() => {
    const t = setTimeout(() => setPhase(willAnswer ? 'connected' : 'noanswer'), 2600);
    return () => clearTimeout(t);
  }, [willAnswer]);

  // 无人接听：再停 1.8s 自动挂断
  useEffect(() => {
    if (phase !== 'noanswer') return;
    const t = setTimeout(onEnd, 1800);
    return () => clearTimeout(t);
  }, [phase, onEnd]);

  // 接通后才计时
  useEffect(() => {
    if (phase !== 'connected') return;
    const timer = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // 接通后才跑台词打字机
  useEffect(() => {
    if (phase !== 'connected') return;
    if (currentLineIndex >= dialogueLines.length) return;
    const line = dialogueLines[currentLineIndex];
    setIsTyping(true);
    charIndexRef.current = 0;
    setDisplayedText('');
    const typeTimer = setInterval(() => {
      charIndexRef.current++;
      setDisplayedText(line.slice(0, charIndexRef.current));
      if (charIndexRef.current >= line.length) {
        clearInterval(typeTimer);
        setIsTyping(false);
        setTimeout(() => setCurrentLineIndex((i) => i + 1), 2000);
      }
    }, 50);
    return () => clearInterval(typeTimer);
  }, [phase, currentLineIndex, dialogueLines]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const statusText = phase === 'ringing' ? '正在呼叫…' : phase === 'noanswer' ? '无人接听' : formatDuration(callSeconds);

  return (
    <div
      className="flex h-full flex-col items-center"
      style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0c29 100%)' }}
    >
      {/* 头像 */}
      <div className="mt-12">
        {character?.avatarUrl ? (
          <motion.img
            src={assetUrl(character.avatarUrl)}
            alt={character.name}
            animate={phase === 'ringing' ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ repeat: phase === 'ringing' ? Infinity : 0, duration: 1.2, ease: 'easeInOut' }}
            className={`h-24 w-24 rounded-full object-cover shadow-xl ring-2 ${phase === 'noanswer' ? 'opacity-50 ring-white/10' : 'ring-white/20'}`}
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold text-white shadow-xl" style={{ backgroundColor: color }}>
            {character?.name.charAt(0) || '?'}
          </div>
        )}
      </div>

      {/* 名称 + 状态 */}
      <h2 className="mt-4 text-lg font-semibold text-white">{character?.name || '未知号码'}</h2>
      <p className={`mt-1 text-sm ${phase === 'noanswer' ? 'text-white/60' : 'text-white/40'}`}>{statusText}</p>

      {/* 对话文本区域（仅接通后） */}
      <div className="mt-8 w-full flex-1 overflow-y-auto px-6">
        {phase === 'connected' && (
          <>
            <AnimatePresence>
              {dialogueLines.slice(0, currentLineIndex).map((line, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-3 rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3">
                  <p className="text-sm leading-relaxed text-white/80">{line}</p>
                </motion.div>
              ))}
            </AnimatePresence>
            {currentLineIndex < dialogueLines.length && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-3 rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3">
                <p className="text-sm leading-relaxed text-white/80">
                  {displayedText}
                  {isTyping && (
                    <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.5 }} className="ml-0.5 inline-block h-4 w-0.5 bg-white/60 align-middle" />
                  )}
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* 挂断按钮 */}
      <div className="pb-10 pt-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onEnd}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/30"
        >
          <PhoneOff size={28} className="text-white" />
        </motion.button>
      </div>
    </div>
  );
}
