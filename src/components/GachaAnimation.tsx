import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getCharacterById } from '@/data/characters';
import { playSound } from '@/lib/sound';
import type { Character } from '@/data/types';
import { cn } from '@/lib/utils';
import { assetUrl } from '@/lib/assets';

interface GachaResult {
  characterId: string;
  name: string;
  rarity: 'N' | 'R' | 'SR' | 'SSR';
  title: string;
  isNew: boolean;
}

interface GachaAnimationProps {
  results: GachaResult[];
  isTenPull: boolean;
  onComplete: () => void;
}

type GachaCharacter = Character & {
  gachaPortraitUrl?: string;
  gachaBackgroundUrl?: string;
  gachaQuote?: string;
  gachaTags?: string[];
};

const rarityFlash = {
  N: 'bg-white/30',
  R: 'bg-blue-400/40',
  SR: 'bg-purple-500/50',
  SSR: 'bg-amber-400/60',
};

const rarityGlow = {
  N: '',
  R: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
  SR: 'shadow-[0_0_25px_rgba(147,51,234,0.5)]',
  SSR: 'shadow-[0_0_40px_rgba(251,191,36,0.7)]',
};

const rarityBorder = {
  N: 'border-slate-500/40',
  R: 'border-blue-400/50',
  SR: 'border-purple-400/60',
  SSR: 'border-amber-400/80',
};

const rarityGradient = {
  N: 'from-slate-600 to-slate-800',
  R: 'from-blue-600 to-blue-900',
  SR: 'from-purple-600 to-purple-900',
  SSR: 'from-amber-500 via-yellow-500 to-amber-600',
};

const rarityNameColor = {
  N: 'text-slate-300',
  R: 'text-blue-300',
  SR: 'text-purple-300',
  SSR: 'text-amber-300',
};

const rarityStars = {
  N: 2,
  R: 3,
  SR: 4,
  SSR: 5,
};

const rarityAccent = {
  N: 'from-slate-300 to-slate-500',
  R: 'from-blue-200 to-blue-500',
  SR: 'from-purple-200 to-purple-600',
  SSR: 'from-amber-100 to-amber-500',
};

const rarityRank = {
  N: 0,
  R: 1,
  SR: 2,
  SSR: 3,
};

const gachaSceneComposition: Record<string, { mobileFocus: string; desktopFocus: string; panel: 'left' | 'right'; mobilePanel?: 'top' | 'bottom' }> = {
  suli: { mobileFocus: '48% 50%', desktopFocus: '50% 50%', panel: 'left' },
  aruo: { mobileFocus: '58% 50%', desktopFocus: '50% 50%', panel: 'left' },
  sangluo: { mobileFocus: '56% 50%', desktopFocus: '50% 50%', panel: 'left' },
  aman: { mobileFocus: '38% 50%', desktopFocus: '50% 50%', panel: 'right' },
  shenzhaoning: { mobileFocus: '54% 50%', desktopFocus: '50% 50%', panel: 'left' },
  murongxue: { mobileFocus: '50% 50%', desktopFocus: '50% 50%', panel: 'left' },
  yunzhiyi: { mobileFocus: '42% 50%', desktopFocus: '50% 50%', panel: 'left' },
  linxia: { mobileFocus: '42% 50%', desktopFocus: '50% 50%', panel: 'right' },
};

function fireSSRConfetti() {
  const duration = 2000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#fbbf24', '#f59e0b', '#fcd34d', '#ffffff'],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#fbbf24', '#f59e0b', '#fcd34d', '#ffffff'],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
  confetti({
    particleCount: 80,
    spread: 100,
    origin: { y: 0.5 },
    colors: ['#fbbf24', '#f59e0b', '#fcd34d', '#ffffff', '#ef4444'],
  });
}

function GachaCard({
  result,
  index,
  isRevealed,
  onReveal,
}: {
  result: GachaResult;
  index: number;
  isRevealed: boolean;
  onReveal: (index: number) => void;
}) {
  const isSSR = result.rarity === 'SSR';
  const character = getCharacterById(result.characterId) as GachaCharacter | undefined;
  const cardArtUrl = character?.gachaBackgroundUrl || character?.gachaPortraitUrl || character?.portraitUrl;
  const hasWideSceneArt = Boolean(character?.gachaBackgroundUrl);

  useEffect(() => {
    if (!isRevealed) return;
    playSound('card-flip');
    const t = window.setTimeout(() => {
      if (isSSR) { fireSSRConfetti(); playSound('gacha-ssr'); }
      else playSound('gacha-char');
    }, 300);
    return () => window.clearTimeout(t);
  }, [isRevealed, isSSR]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, rotateY: 180 }}
      animate={{
        opacity: 1,
        scale: 1,
        rotateY: isRevealed ? 0 : 180,
      }}
      transition={{
        delay: index * 0.15,
        duration: 0.6,
        type: 'spring',
        damping: 15,
      }}
      onClick={() => !isRevealed && onReveal(index)}
      className={cn('relative cursor-pointer perspective-[800px]', isRevealed ? rarityGlow[result.rarity] : '')}
    >
      <motion.div
        animate={isRevealed ? { rotateY: 0 } : { rotateY: 180 }}
        transition={{ duration: 0.6, type: 'spring', damping: 15 }}
        className={cn(
          'relative h-44 w-28 overflow-hidden rounded-lg sm:h-52 sm:w-32',
          'border-2',
          isRevealed ? rarityBorder[result.rarity] : 'border-slate-600/50',
        )}
      >
        <div
          className={cn(
            'absolute inset-0 backface-hidden flex items-center justify-center',
            'bg-gradient-to-br from-slate-800 to-slate-900',
            'border border-slate-700/50',
          )}
        >
          <div className="text-center">
            <div className="text-2xl text-amber-400/40">✦</div>
            <p className="mt-1 text-xs text-slate-500">点击翻开</p>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.05),transparent_70%)]" />
        </div>

        <AnimatePresence>
          {isRevealed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col">
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className={cn('absolute inset-0 z-10', rarityFlash[result.rarity])}
              />
              <div className={cn('relative flex-1 overflow-hidden bg-gradient-to-b', rarityGradient[result.rarity])}>
                {cardArtUrl ? (
                  <>
                    {hasWideSceneArt && (
                      <img
                        src={assetUrl(cardArtUrl)}
                        alt=""
                        className="absolute inset-0 h-full w-full scale-125 object-cover object-center opacity-45 blur-sm"
                        aria-hidden="true"
                      />
                    )}
                    <img
                      src={assetUrl(cardArtUrl)}
                      alt={result.name}
                      className={cn(
                        'relative z-[1] h-full w-full opacity-95',
                        hasWideSceneArt ? 'object-contain object-center p-1.5' : 'object-cover object-top',
                      )}
                    />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-3xl text-white/20">人</span>
                  </div>
                )}

                <div className="absolute right-1 top-1">
                  <span
                    className={cn(
                      'rounded-sm px-1 py-0.5 text-[10px] font-bold',
                      result.rarity === 'SSR'
                        ? 'bg-amber-500/90 text-amber-950'
                        : result.rarity === 'SR'
                          ? 'bg-purple-500/80 text-purple-100'
                          : result.rarity === 'R'
                            ? 'bg-blue-500/80 text-blue-100'
                            : 'bg-slate-500/80 text-slate-100',
                    )}
                  >
                    {result.rarity}
                  </span>
                </div>

                {result.isNew && (
                  <div className="absolute left-1 top-1">
                    <span className="rounded-sm bg-red-500/90 px-1 py-0.5 text-[10px] font-bold text-white">
                      NEW
                    </span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-slate-900 to-transparent" />
              </div>

              <div className="bg-slate-900/90 px-2 py-1.5">
                <p className={cn('truncate text-xs font-bold', rarityNameColor[result.rarity])}>{result.name}</p>
                <p className="truncate text-[10px] text-gray-500">{result.title}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {isRevealed && isSSR && (
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
          className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent"
        />
      )}
    </motion.div>
  );
}

function GachaShowcase({
  results,
  activeIndex,
  onPrev,
  onNext,
  onComplete,
}: {
  results: GachaResult[];
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onComplete: () => void;
}) {
  const result = results[activeIndex];
  const character = getCharacterById(result.characterId) as GachaCharacter | undefined;
  const portraitUrl = character?.gachaPortraitUrl || character?.portraitUrl;
  const backgroundUrl = character?.gachaBackgroundUrl;
  const resolvedBackgroundUrl = assetUrl(backgroundUrl);
  const resolvedPortraitUrl = assetUrl(portraitUrl);
  const hasSceneArt = Boolean(backgroundUrl);
  const quote = character?.gachaQuote || character?.dialogues?.[0]?.text || '你抽到了新的羁绊。';
  const tags = character?.gachaTags || [character?.element, result.title].filter(Boolean);
  const canSwitch = results.length > 1;
  const composition = gachaSceneComposition[result.characterId] ?? {
    mobileFocus: '50% 50%',
    desktopFocus: '50% 50%',
    panel: 'left' as const,
  };
  const panelOnRight = composition.panel === 'right';
  const panelOnTopMobile = composition.mobilePanel === 'top';
  const sceneStyle = {
    '--gacha-focus-mobile': composition.mobileFocus,
    '--gacha-focus-desktop': composition.desktopFocus,
  } as CSSProperties;

  return (
    <motion.div
      key={`${result.characterId}-${activeIndex}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={sceneStyle}
      className="relative h-full w-full overflow-hidden bg-[#030712]"
    >
      {resolvedBackgroundUrl ? (
        <motion.img
          key={resolvedBackgroundUrl}
          src={resolvedBackgroundUrl}
          alt={result.name}
          initial={{ opacity: 0.92 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          className="absolute inset-0 h-full w-full object-cover [object-position:var(--gacha-focus-mobile)] md:[object-position:var(--gacha-focus-desktop)]"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,rgba(148,163,184,0.24),transparent_34%),linear-gradient(90deg,rgba(7,17,38,0.96)_0%,rgba(15,23,42,0.74)_42%,rgba(15,23,42,0.24)_72%,rgba(49,46,129,0.42)_100%)]" />
      )}
      <div
        className={cn(
          'absolute inset-0',
          panelOnRight
            ? 'bg-[linear-gradient(180deg,rgba(3,7,18,0.02)_0%,rgba(3,7,18,0.14)_45%,rgba(3,7,18,0.9)_100%)] md:bg-[linear-gradient(270deg,rgba(3,7,18,0.9)_0%,rgba(15,23,42,0.62)_28%,rgba(15,23,42,0.16)_55%,rgba(3,7,18,0.02)_100%)]'
            : 'bg-[linear-gradient(180deg,rgba(3,7,18,0.02)_0%,rgba(3,7,18,0.14)_45%,rgba(3,7,18,0.9)_100%)] md:bg-[linear-gradient(90deg,rgba(3,7,18,0.9)_0%,rgba(15,23,42,0.62)_28%,rgba(15,23,42,0.16)_55%,rgba(3,7,18,0.02)_100%)]',
        )}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,255,255,0.16),transparent_24%),radial-gradient(circle_at_52%_58%,rgba(251,191,36,0.16),transparent_34%)] opacity-80" />
      <div className="absolute inset-0 opacity-[0.13] [background-image:radial-gradient(circle,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.72)]" />

      <motion.div
        initial={{ rotate: -8, scale: 0.9, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 0.28 }}
        transition={{ duration: 0.7 }}
        className="pointer-events-none absolute left-1/2 top-[8%] h-[74vh] w-[74vh] -translate-x-1/2 rounded-full border-[5px] border-amber-100/45 mix-blend-screen"
      >
        <div className="absolute inset-12 rounded-full border border-amber-100/35" />
        <div className="absolute inset-24 rounded-full border border-amber-100/25" />
      </motion.div>

      {!hasSceneArt && resolvedPortraitUrl ? (
        <motion.img
          key={resolvedPortraitUrl}
          src={resolvedPortraitUrl}
          alt={result.name}
          initial={{ x: 90, opacity: 0, scale: 0.92 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 22, stiffness: 110 }}
          className="absolute bottom-0 right-[8%] z-10 h-[96%] max-w-[62%] object-contain object-bottom drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)]"
        />
      ) : !hasSceneArt ? (
        <div className="absolute bottom-0 right-[15%] z-10 flex h-[86%] w-[36%] items-center justify-center text-8xl text-white/20">
          人
        </div>
      ) : null}

      <motion.div
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.16, duration: 0.45, ease: 'easeOut' }}
        className={cn(
          'absolute z-20 flex max-w-[68vw] flex-col md:max-w-[30rem]',
          panelOnRight ? 'right-5 items-end text-right md:right-10' : 'left-5 items-start text-left md:left-10',
          panelOnTopMobile ? 'top-14 md:bottom-10 md:top-auto' : 'bottom-12 md:bottom-10',
        )}
      >
        <div className={cn('mb-2 flex items-center gap-1', panelOnRight && 'justify-end')}>
          {Array.from({ length: rarityStars[result.rarity] }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.06 }}
              className="text-2xl text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.75)] md:text-4xl"
            >
              ★
            </motion.span>
          ))}
        </div>
        <div className={cn('bg-gradient-to-r bg-clip-text text-4xl font-black leading-none text-transparent drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)] md:text-7xl', rarityAccent[result.rarity])}>
          {result.name}
        </div>
        <div className={cn('mt-3 flex flex-wrap gap-1.5 md:mt-5 md:gap-3', panelOnRight && 'justify-end')}>
          <span className="rounded-full bg-amber-300/90 px-3 py-1 text-xs font-black text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.36)] md:px-5 md:py-2 md:text-base">
            {result.rarity}
          </span>
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-white/30 bg-slate-950/34 px-3 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm md:px-5 md:py-2 md:text-base">
              {tag}
            </span>
          ))}
          {result.isNew && (
            <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white shadow-lg md:px-5 md:py-2 md:text-base">
              NEW
            </span>
          )}
        </div>
        <p className="mt-3 max-h-[10vh] max-w-md overflow-hidden text-sm font-bold leading-relaxed text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.95)] md:mt-7 md:max-h-none md:text-2xl">
          {quote}
        </p>
        <div className={cn('mt-4 flex items-center gap-2 md:gap-3', panelOnRight && 'justify-end')}>
          {canSwitch && (
            <span className="rounded-full border border-white/20 bg-slate-950/38 px-3 py-1.5 text-xs font-semibold text-white/82 backdrop-blur-sm md:text-sm">
              {activeIndex + 1}/{results.length}
            </span>
          )}
        </div>
      </motion.div>

      <motion.button
        onClick={onComplete}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.28, duration: 0.38, ease: 'easeOut' }}
        className="group absolute bottom-4 left-1/2 z-40 flex h-10 -translate-x-1/2 items-center gap-3 rounded-full border border-white/20 bg-slate-950/30 px-4 text-sm font-bold text-white/88 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-amber-200/70 hover:bg-slate-950/44 hover:text-amber-100 md:bottom-7 md:h-11 md:px-5"
      >
        <span className="h-px w-7 bg-gradient-to-r from-transparent via-amber-200/75 to-amber-200/20" />
        <span className="tracking-[0.18em]">收下羁绊</span>
        <ChevronRight size={17} strokeWidth={2.2} className="-ml-1 text-amber-200/90 transition-transform group-hover:translate-x-0.5" />
      </motion.button>

      {canSwitch && (
        <>
          <button
            onClick={onPrev}
            className="absolute left-5 top-1/2 z-30 flex h-16 w-16 -translate-y-1/2 items-center justify-center text-white/70 hover:text-white"
            aria-label="上一个角色"
          >
            <ChevronLeft size={64} strokeWidth={1.6} />
          </button>
          <button
            onClick={onNext}
            className="absolute right-5 top-1/2 z-30 flex h-16 w-16 -translate-y-1/2 items-center justify-center text-white/70 hover:text-white"
            aria-label="下一个角色"
          >
            <ChevronRight size={64} strokeWidth={1.6} />
          </button>
        </>
      )}

    </motion.div>
  );
}

export default function GachaAnimation({ results, isTenPull, onComplete }: GachaAnimationProps) {
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<'intro' | 'reveal' | 'done'>('intro');
  const [activeResultIndex, setActiveResultIndex] = useState(0);

  const handleReveal = useCallback((index: number) => {
    setRevealedIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const handleRevealAll = useCallback(() => {
    setRevealedIndices(new Set(results.map((_, i) => i)));
  }, [results]);

  const showPreviousResult = useCallback(() => {
    setActiveResultIndex((index) => (index - 1 + results.length) % results.length);
  }, [results.length]);

  const showNextResult = useCallback(() => {
    setActiveResultIndex((index) => (index + 1) % results.length);
  }, [results.length]);

  useEffect(() => {
    const timer = setTimeout(() => setPhase('reveal'), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== 'reveal' || !isTenPull) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    results.forEach((_, i) => {
      const timer = setTimeout(() => {
        handleReveal(i);
      }, i * 300 + 200);
      timers.push(timer);
    });
    return () => timers.forEach(clearTimeout);
  }, [phase, isTenPull, results, handleReveal]);

  useEffect(() => {
    if (revealedIndices.size === results.length && results.length > 0) {
      const timer = setTimeout(() => {
        const featuredIndex = results.reduce((bestIndex, result, index) => {
          return rarityRank[result.rarity] > rarityRank[results[bestIndex].rarity] ? index : bestIndex;
        }, 0);
        setActiveResultIndex(featuredIndex);
        setPhase('done');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [revealedIndices, results]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 backdrop-blur-md"
    >
      {phase === 'intro' && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.8] }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="h-32 w-32 rounded-full bg-gradient-to-r from-amber-400/30 to-purple-500/30 blur-2xl" />
        </motion.div>
      )}

      {phase === 'reveal' && (
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6">
          <div className={cn('flex flex-wrap items-center justify-center gap-3', isTenPull ? 'max-w-md' : '')}>
            {results.map((result, index) => (
              <GachaCard
                key={`${result.characterId}-${index}`}
                result={result}
                index={index}
                isRevealed={revealedIndices.has(index)}
                onReveal={handleReveal}
              />
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <GachaShowcase
          results={results}
          activeIndex={activeResultIndex}
          onPrev={showPreviousResult}
          onNext={showNextResult}
          onComplete={onComplete}
        />
      )}

      {phase === 'reveal' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative z-30 flex shrink-0 justify-center px-4 pb-8"
        >
          <button
            onClick={handleRevealAll}
            className={cn(
              'rounded-lg px-6 py-2.5 text-sm font-medium',
              'bg-slate-800/80 text-gray-300',
              'border border-slate-600/50',
              'hover:bg-slate-700/80 hover:text-white',
              'transition-colors duration-200',
            )}
          >
            跳过动画
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
