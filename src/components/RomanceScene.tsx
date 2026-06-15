/**
 * 心动场景播放器：演一个恋爱节点——对白 → 选择 → 她的反应 → 落幕。
 * 比委托剧场轻(无出牌挑战),纯 AVG;复用 DialogueBox 打字机。
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DialogueBox from '@/components/DialogueBox';
import { useCssVarFromHeight } from '@/hooks/useCssVarFromHeight';
import { getCharacterById } from '@/data/characters';
import { getLocationById } from '@/data/locations';
import { assetCssBackground, assetUrl } from '@/lib/assets';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import type { RomanceBeat, RomanceChoiceOption, RomanceLine } from '@/data/romanceArcs';

interface Props {
  characterId: string;
  beat: RomanceBeat;
  /** 落幕：带回玩家选的选项(无选择则 null),供调用方结算默契/奖励 */
  onComplete: (chosen: RomanceChoiceOption | null) => void;
}

type Phase = 'lines' | 'choice' | 'reaction';

export default function RomanceScene({ characterId, beat, onComplete }: Props) {
  const character = getCharacterById(characterId);
  const [phase, setPhase] = useState<Phase>('lines');
  const [lineIndex, setLineIndex] = useState(0);
  const [chosen, setChosen] = useState<RomanceChoiceOption | null>(null);
  /** 选择面板实测高度 → --romance-panel-h：立绘据此让位，与 --dlg-h 取大者，全程贴住底部 UI */
  const choiceRef = useRef<HTMLDivElement>(null);
  useCssVarFromHeight('--romance-panel-h', choiceRef);

  const lines: RomanceLine[] = phase === 'reaction' && chosen ? chosen.reaction : beat.scene.lines;
  const line = lines[lineIndex];
  const sheSpeaking = line?.speaker === characterId;

  const bg = useMemo(() => {
    const locId = beat.scene.location;
    const b = locId ? getLocationById(locId)?.bg : undefined;
    return assetCssBackground(b) ?? assetCssBackground('url("/bg/scene/street-storefront.jpg") center / cover no-repeat');
  }, [beat.scene.location]);

  const advanceLines = useCallback(() => {
    playSound('dialog-next');
    if (lineIndex < lines.length - 1) {
      setLineIndex((i) => i + 1);
      return;
    }
    // 一段对白播完
    if (phase === 'lines') {
      if (beat.scene.choice) {
        setPhase('choice');
      } else {
        onComplete(null);
      }
    } else if (phase === 'reaction') {
      onComplete(chosen);
    }
  }, [lineIndex, lines.length, phase, beat.scene.choice, chosen, onComplete]);

  const pickOption = useCallback((opt: RomanceChoiceOption) => {
    playSound('btn-confirm');
    setChosen(opt);
    setLineIndex(0);
    setPhase('reaction');
  }, []);

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black">
      {/* 背景 */}
      <div className="absolute inset-0" style={{ background: bg }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/45" />

      {/* 顶栏 */}
      <div className="absolute left-0 right-0 top-0 z-20 px-4 pt-3">
        <span className="rounded-full bg-rose-500/30 border border-rose-400/40 px-2.5 py-0.5 text-[11px] font-bold text-rose-100">
          心动 · {beat.title}
        </span>
        <span className="ml-2 text-[10px] text-white/50">{beat.phase}</span>
      </div>

      {/* 她的立绘 */}
      {character && (
        <div
          className="pointer-events-none absolute inset-x-0 top-[10vh] z-10 flex items-end justify-center"
          style={{ bottom: 'calc(max(var(--dlg-h, 0px), var(--romance-panel-h, 0px)) - 6vh)' }}
        >
          {/* 立绘 PNG 底部约 5% 透明留白，多压 6vh 进对白框（被框盖住）以消除底边缝隙；scale 从底部放大 */}
          <motion.img
            src={assetUrl(character.portraitUrl)}
            alt={character.name}
            style={{ transformOrigin: 'bottom center' }}
            animate={{
              opacity: phase === 'choice' || sheSpeaking ? 1 : 0.8,
              scale: phase === 'choice' || sheSpeaking ? 1.12 : 1.08,
              filter: phase === 'choice' || sheSpeaking ? 'brightness(1)' : 'brightness(0.78)',
            }}
            transition={{ duration: 0.35 }}
            className="max-h-full max-w-[96vw] object-contain object-bottom drop-shadow-2xl"
          />
        </div>
      )}

      {/* 选择面板 */}
      <AnimatePresence>
        {phase === 'choice' && beat.scene.choice && (
          <motion.div
            ref={choiceRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute bottom-0 left-0 right-0 z-40 rounded-t-2xl border-t border-white/10 bg-slate-900/95 backdrop-blur-xl p-4 pb-safe"
          >
            <p className="mb-3 text-sm font-bold text-white">{beat.scene.choice.prompt}</p>
            <div className="space-y-2">
              {beat.scene.choice.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => pickOption(opt)}
                  className="w-full rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-left text-sm text-rose-50 active:scale-[0.99] transition-all hover:border-rose-300/50 hover:bg-rose-500/15"
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 对白框 */}
      {phase !== 'choice' && line && (
        <DialogueBox
          speaker={sheSpeaking ? character?.name : undefined}
          speakerColor={cn(sheSpeaking ? 'text-rose-300' : 'text-slate-300')}
          text={line.text}
          onNext={advanceLines}
          onSkipTyping={() => {}}
        />
      )}
    </div>
  );
}
