/**
 * 抽卡演出 — N/R 走卡面揭晓，SR/SSR 走全屏剪影 → 星星暂停 → 最终背景图。
 *
 * 高稀有不再砸卡面，直接用角色抽卡背景图做主视觉；普通角色保留快速翻卡反馈。
 */
import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getCharacterById } from '@/data/characters';
import { playSound } from '@/lib/sound';
import {
  vibrate, VIBE, shakeKeyframes, dustAt, burstPurpleSides, burstGoldCelebration,
} from '@/lib/fx';
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

type Rarity = GachaResult['rarity'];

const rarityBorder = {
  N: 'border-slate-500/40',
  R: 'border-blue-400/50',
  SR: 'border-purple-400/60',
  SSR: 'border-amber-400/80',
};

const rarityGlow = {
  N: '',
  R: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
  SR: 'shadow-[0_0_25px_rgba(147,51,234,0.5)]',
  SSR: 'shadow-[0_0_40px_rgba(251,191,36,0.7)]',
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

const rarityStars = { N: 2, R: 3, SR: 4, SSR: 5 };
const rarityRank = { N: 0, R: 1, SR: 2, SSR: 3 };

const SHAKE_MAG: Record<Rarity, number> = { N: 4, R: 5, SR: 9, SSR: 15 };

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

function getGachaSilhouetteUrl(backgroundUrl?: string) {
  return backgroundUrl?.replace(/\/bg\/gacha\/([^/]+)\.(?:jpe?g|png)$/i, '/bg/gacha-silhouette/$1.png');
}

/* ────── 高稀有揭晓：角色背景图剪影 → 星星暂停 → 最终背景图 ────── */
function HighRarityReveal({
  result, onShake, onDone,
}: {
  result: GachaResult;
  onShake: (mag: number) => void;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<'silhouette' | 'stars' | 'flash' | 'final'>('silhouette');
  const character = getCharacterById(result.characterId) as GachaCharacter | undefined;
  const backgroundUrl = character?.gachaBackgroundUrl;
  const sceneUrl = backgroundUrl || character?.gachaPortraitUrl || character?.portraitUrl;
  const silhouetteUrl = getGachaSilhouetteUrl(backgroundUrl);
  const resolvedSceneUrl = assetUrl(sceneUrl);
  const resolvedSilhouetteUrl = assetUrl(silhouetteUrl);
  const composition = gachaSceneComposition[result.characterId] ?? {
    mobileFocus: '50% 50%',
    desktopFocus: '50% 50%',
    panel: 'left' as const,
  };
  const sceneStyle = {
    '--intro-focus-mobile': composition.mobileFocus,
    '--intro-focus-desktop': composition.desktopFocus,
  } as CSSProperties;
  const isSSR = result.rarity === 'SSR';
  const starCount = rarityStars[result.rarity];

  useEffect(() => {
    playSound('gacha-riser');
    vibrate(18);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => {
      setStage('stars');
      playSound('gacha-impact');
      onShake(isSSR ? 13 : 9);
      vibrate(isSSR ? VIBE.mid : VIBE.light);
    }, 680));
    timers.push(setTimeout(() => {
      setStage('flash');
      playSound(isSSR ? 'gacha-ssr' : 'gacha-upgrade');
      onShake(isSSR ? 16 : 11);
      vibrate(isSSR ? VIBE.heavy : VIBE.mid);
    }, 1450));
    timers.push(setTimeout(() => setStage('final'), 1580));
    timers.push(setTimeout(onDone, 2380));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.characterId]);

  return (
    <motion.div
      key={`${result.characterId}-${result.rarity}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={sceneStyle}
      className="absolute inset-0 overflow-hidden bg-[#02050d]"
    >
      {resolvedSceneUrl ? (
        <>
          <motion.img
            src={resolvedSceneUrl}
            alt=""
            aria-hidden={stage !== 'final'}
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{
              scale: stage === 'final' ? 1.02 : 1.1,
              opacity: stage === 'final' ? 1 : 0,
            }}
            transition={{ duration: stage === 'final' ? 0.46 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 h-full w-full object-cover [object-position:var(--intro-focus-mobile)] md:[object-position:var(--intro-focus-desktop)]"
          />
          <motion.img
            src={resolvedSceneUrl}
            alt=""
            aria-hidden="true"
            initial={{ scale: 1.06, opacity: 0 }}
            animate={{
              scale: stage === 'stars' ? 1.03 : 1.06,
              opacity: stage === 'final' ? 0 : 0.72,
            }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 h-full w-full object-cover [object-position:var(--intro-focus-mobile)] md:[object-position:var(--intro-focus-desktop)]"
            style={{ filter: 'brightness(0.34) saturate(0.82) contrast(1.08)' }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.1),transparent_28%),linear-gradient(180deg,#02050d,#0f172a)]" />
      )}

      {resolvedSilhouetteUrl && (
        <motion.img
          src={resolvedSilhouetteUrl}
          alt=""
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{
            opacity: stage === 'final' ? 0 : 1,
            scale: stage === 'stars' ? 1.02 : 1,
            y: stage === 'stars' ? 0 : 10,
          }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-10 h-full w-full object-cover [object-position:var(--intro-focus-mobile)] md:[object-position:var(--intro-focus-desktop)]"
        />
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: stage === 'final' ? 0 : 1 }}
        transition={{ duration: 0.35 }}
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,5,13,0.10)_0%,rgba(2,5,13,0.02)_46%,rgba(2,5,13,0.48)_100%)]"
      />

      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{
          scaleX: stage === 'silhouette' ? 0.35 : stage === 'stars' ? 1 : 0.25,
          opacity: stage === 'final' ? 0 : 0.9,
        }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-1/2 top-1/2 h-px w-[82vw] max-w-[760px] -translate-x-1/2 bg-gradient-to-r from-transparent via-white to-transparent"
      />
      <motion.div
        initial={{ x: '-52vw', opacity: 0 }}
        animate={{
          x: stage === 'silhouette' ? '-12vw' : '58vw',
          opacity: stage === 'final' ? 0 : stage === 'silhouette' ? 0.38 : 0.85,
        }}
        transition={{ duration: stage === 'silhouette' ? 0.62 : 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-[16%] h-[72vh] w-[2px] rotate-[18deg] bg-white/95 shadow-[0_0_26px_rgba(255,255,255,0.85)]"
      />

      <AnimatePresence>
        {(stage === 'stars' || stage === 'flash') && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.12 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-x-0 top-[44%] z-20 flex -translate-y-1/2 items-center justify-center gap-2 px-6 md:gap-4"
          >
            {Array.from({ length: starCount }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 2.3, opacity: 0, y: -18 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: i * 0.09, type: 'spring', damping: 13, stiffness: 430 }}
                className={cn(
                  'text-5xl font-black leading-none md:text-7xl',
                  isSSR ? 'text-amber-200' : 'text-purple-200',
                )}
                style={{
                  textShadow: isSSR
                    ? '0 0 18px rgba(251,191,36,0.9), 0 0 34px rgba(255,255,255,0.38)'
                    : '0 0 18px rgba(192,132,252,0.9), 0 0 34px rgba(255,255,255,0.3)',
                }}
              >
                ★
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {stage === 'flash' && (
        <motion.div
          initial={{ opacity: 0.92 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.32 }}
          className="absolute inset-0 z-30 bg-white"
        />
      )}

      {stage === 'final' && (
        <motion.div
          initial={{ opacity: 0.76 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.42 }}
          className={cn('absolute inset-0 z-20', isSSR ? 'bg-amber-50' : 'bg-purple-50')}
        />
      )}
    </motion.div>
  );
}

/* ────── 揭晓：砸牌 ────── */
function GachaCard({
  result, index, isRevealed, quiet, onReveal, onRevealFx,
}: {
  result: GachaResult;
  index: number;
  isRevealed: boolean;
  /** 长按跳过时静默揭晓：不放音/不喷粒子/不震屏 */
  quiet: boolean;
  onReveal: (index: number) => void;
  onRevealFx: (rarity: Rarity) => void;
}) {
  const isSSR = result.rarity === 'SSR';
  const cardRef = useRef<HTMLDivElement>(null);
  const character = getCharacterById(result.characterId) as GachaCharacter | undefined;
  const cardArtUrl = character?.gachaBackgroundUrl || character?.gachaPortraitUrl || character?.portraitUrl;
  const hasSceneCardArt = Boolean(character?.gachaBackgroundUrl);

  useEffect(() => {
    if (!isRevealed || quiet) return;
    playSound('card-slam');
    vibrate(isSSR ? VIBE.heavy : result.rarity === 'SR' ? VIBE.mid : VIBE.light);
    onRevealFx(result.rarity);
    dustAt(cardRef.current, result.rarity);
    const t = window.setTimeout(() => {
      if (isSSR) { burstGoldCelebration(2000); playSound('gacha-ssr'); }
      else if (result.rarity === 'SR') { burstPurpleSides(); playSound('gacha-char'); }
      else playSound('gacha-char');
    }, 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: -26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: 'easeOut' }}
      onClick={() => !isRevealed && onReveal(index)}
      className={cn('relative cursor-pointer', isRevealed ? rarityGlow[result.rarity] : '')}
    >
      <div
        className={cn(
          'relative h-44 w-28 overflow-hidden rounded-lg bg-slate-950 sm:h-52 sm:w-32',
          'border-2',
          isRevealed ? rarityBorder[result.rarity] : 'border-slate-600/50',
        )}
      >
        {/* 卡背 */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50">
          <div className="text-center">
            <div className="text-2xl text-amber-400/40">✦</div>
            <p className="mt-1 text-xs text-slate-500">点击翻开</p>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.05),transparent_70%)]" />
        </div>

        {/* 揭晓：卡面从天而降砸入 */}
        <AnimatePresence>
          {isRevealed && (
            <motion.div
              initial={{ scale: 1.9, y: -60, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ duration: 0.18, ease: 'easeIn' }}
              className="absolute inset-0"
            >
              <div className={cn('absolute inset-0 bg-gradient-to-b', rarityGradient[result.rarity])} />
              {cardArtUrl ? (
                <img
                  src={assetUrl(cardArtUrl)}
                  alt={result.name}
                  className={cn(
                    'absolute inset-0 h-full w-full transition-transform duration-300',
                    hasSceneCardArt ? 'scale-[1.18] object-cover object-center' : 'object-cover object-top',
                  )}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl text-white/20">人</span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-b from-black/26 via-transparent to-black/88" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.18),transparent_42%)]" />
              <div className="pointer-events-none absolute inset-[3px] rounded-md border border-white/18" />

              <div className="absolute left-1.5 right-1.5 top-1.5 z-10 flex items-start justify-between gap-1">
                {result.isNew ? (
                  <span className="rounded-sm bg-red-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                    NEW
                  </span>
                ) : <span />}
                <span
                  className={cn(
                    'rounded-sm px-1.5 py-0.5 text-[10px] font-black leading-none shadow-[0_2px_8px_rgba(0,0,0,0.35)]',
                    result.rarity === 'SSR'
                      ? 'bg-amber-400 text-amber-950'
                      : result.rarity === 'SR'
                        ? 'bg-purple-500 text-purple-50'
                        : result.rarity === 'R'
                          ? 'bg-blue-500 text-blue-50'
                          : 'bg-slate-500 text-slate-50',
                  )}
                >
                  {result.rarity}
                </span>
              </div>

              <div className="absolute inset-x-2 bottom-2 z-10">
                <p className={cn('truncate text-xs font-black drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]', rarityNameColor[result.rarity])}>{result.name}</p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-white/70 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">{result.title}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 落地冲击环 */}
      <AnimatePresence>
        {isRevealed && !quiet && (
          <motion.div
            initial={{ scale: 1, opacity: 0.9 }}
            animate={{ scale: 1.9, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn('pointer-events-none absolute -inset-1 rounded-xl border-2', rarityBorder[result.rarity])}
          />
        )}
      </AnimatePresence>

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

/* ────── 余韵：结算展示 ────── */
function GachaShowcase({
  results, activeIndex, onPrev, onNext, onComplete, onShake, showCompleteButton = true, showSwitchControls = true,
}: {
  results: GachaResult[];
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onComplete: () => void;
  onShake: (mag: number) => void;
  showCompleteButton?: boolean;
  showSwitchControls?: boolean;
}) {
  const result = results[activeIndex];
  const isSSR = result.rarity === 'SSR';
  const character = getCharacterById(result.characterId) as GachaCharacter | undefined;
  const portraitUrl = character?.gachaPortraitUrl || character?.portraitUrl;
  const backgroundUrl = character?.gachaBackgroundUrl;
  const resolvedBackgroundUrl = assetUrl(backgroundUrl);
  const resolvedPortraitUrl = assetUrl(portraitUrl);
  const hasSceneArt = Boolean(backgroundUrl);
  const quote = character?.gachaQuote || character?.dialogues?.[0]?.text || '你抽到了新的羁绊。';
  const tags = character?.gachaTags || [character?.element, result.title].filter(Boolean);
  const canSwitch = showSwitchControls && results.length > 1;
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

  /* 视差：跟随指针轻微偏移（伪 3D） */
  const [par, setPar] = useState({ x: 0, y: 0 });
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    setPar({
      x: (e.clientX / window.innerWidth - 0.5) * 2,
      y: (e.clientY / window.innerHeight - 0.5) * 2,
    });
  }, []);

  /* 台词打字机 */
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    setTyped(0);
    const start = setTimeout(() => {
      const iv = setInterval(() => {
        setTyped(n => {
          if (n >= quote.length) { clearInterval(iv); return n; }
          return n + 1;
        });
      }, 30);
    }, 850);
    return () => clearTimeout(start);
  }, [quote, activeIndex]);

  /* 入场音效编排：星星逐颗钉入；SSR 名字逐字砸出 */
  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    const starCount = rarityStars[result.rarity];
    for (let i = 0; i < starCount; i++) {
      ts.push(setTimeout(() => { playSound('star-pin'); if (isSSR) vibrate(10); }, 280 + i * 140));
    }
    if (isSSR) {
      vibrate(VIBE.mid);
      for (let i = 0; i < result.name.length; i++) {
        ts.push(setTimeout(() => { playSound('name-hit'); onShake(3); }, 620 + i * 85));
      }
    }
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  return (
    <motion.div
      key={`${result.characterId}-${activeIndex}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={sceneStyle}
      onPointerMove={handlePointerMove}
      className="relative h-full w-full overflow-hidden bg-[#030712]"
    >
      {/* 急刹变焦容器：背景+立绘整体 scale 入场 */}
      <motion.div
        initial={{ scale: isSSR ? 1.32 : 1.12 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0"
      >
        {resolvedBackgroundUrl ? (
          <img
            key={resolvedBackgroundUrl}
            src={resolvedBackgroundUrl}
            alt={result.name}
            className="absolute inset-0 h-full w-full object-cover [object-position:var(--gacha-focus-mobile)] md:[object-position:var(--gacha-focus-desktop)]"
            style={{ transform: `translate(${par.x * -8}px, ${par.y * -5}px) scale(1.05)` }}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,rgba(148,163,184,0.24),transparent_34%),linear-gradient(90deg,rgba(7,17,38,0.96)_0%,rgba(15,23,42,0.74)_42%,rgba(15,23,42,0.24)_72%,rgba(49,46,129,0.42)_100%)]" />
        )}

        {!hasSceneArt && resolvedPortraitUrl ? (
          <motion.img
            key={resolvedPortraitUrl}
            src={resolvedPortraitUrl}
            alt={result.name}
            initial={{ x: 90, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 22, stiffness: 110 }}
            className="absolute bottom-0 right-[8%] z-10 h-[96%] max-w-[62%] object-contain object-bottom drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)]"
            style={{ translateX: par.x * 12, translateY: par.y * 8 }}
          />
        ) : !hasSceneArt ? (
          <div className="absolute bottom-0 right-[15%] z-10 flex h-[86%] w-[36%] items-center justify-center text-8xl text-white/20">
            人
          </div>
        ) : null}
      </motion.div>

      {/* SSR 入场白闪 */}
      {isSSR && (
        <motion.div
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.55 }}
          className="pointer-events-none absolute inset-0 z-30 bg-amber-50"
        />
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
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.16, duration: 0.45, ease: 'easeOut' }}
        className={cn(
          'absolute z-20 flex max-w-[68vw] flex-col md:max-w-[30rem]',
          panelOnRight ? 'right-5 items-end text-right md:right-10' : 'left-5 items-start text-left md:left-10',
          panelOnTopMobile ? 'top-14 md:bottom-10 md:top-auto' : 'bottom-12 md:bottom-10',
        )}
      >
        {/* 星星逐颗钉入 */}
        <div className={cn('mb-2 flex items-center gap-1', panelOnRight && 'justify-end')}>
          {Array.from({ length: rarityStars[result.rarity] }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ y: -22, scale: 2, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ delay: 0.28 + i * 0.14, type: 'spring', damping: 13, stiffness: 420 }}
              className={cn(
                'text-2xl md:text-4xl',
                result.rarity === 'SSR'
                  ? 'text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.75)]'
                  : result.rarity === 'SR'
                    ? 'text-purple-200 drop-shadow-[0_0_10px_rgba(192,132,252,0.75)]'
                    : result.rarity === 'R'
                      ? 'text-blue-200 drop-shadow-[0_0_10px_rgba(96,165,250,0.65)]'
                      : 'text-slate-200 drop-shadow-[0_0_10px_rgba(226,232,240,0.5)]',
              )}
            >
              ★
            </motion.span>
          ))}
        </div>

        {/* 角色名：SSR 逐字砸出 */}
        {isSSR ? (
          <div className="flex bg-gradient-to-r from-amber-100 to-amber-500 bg-clip-text text-4xl font-black leading-none text-transparent drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)] md:text-7xl">
            {result.name.split('').map((ch, i) => (
              <motion.span
                key={i}
                initial={{ scale: 2.6, opacity: 0, y: -14 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: 0.62 + i * 0.085, type: 'spring', damping: 13, stiffness: 500 }}
                className="inline-block"
              >
                {ch}
              </motion.span>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.35 }}
            className={cn(
              'bg-gradient-to-r bg-clip-text text-4xl font-black leading-none text-transparent drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)] md:text-7xl',
              result.rarity === 'SR' ? 'from-purple-200 to-purple-600' : result.rarity === 'R' ? 'from-blue-200 to-blue-500' : 'from-slate-300 to-slate-500',
            )}
          >
            {result.name}
          </motion.div>
        )}

        <div className={cn('mt-3 flex flex-wrap gap-1.5 md:mt-5 md:gap-3', panelOnRight && 'justify-end')}>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-black shadow-[0_0_18px_rgba(255,255,255,0.24)] md:px-5 md:py-2 md:text-base',
              result.rarity === 'SSR'
                ? 'bg-amber-300/90 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.36)]'
                : result.rarity === 'SR'
                  ? 'bg-purple-300/90 text-purple-950 shadow-[0_0_18px_rgba(192,132,252,0.34)]'
                  : result.rarity === 'R'
                    ? 'bg-blue-300/90 text-blue-950'
                    : 'bg-slate-300/90 text-slate-950',
            )}
          >
            {result.rarity}
          </span>
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-white/30 bg-slate-950/34 px-3 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm md:px-5 md:py-2 md:text-base">
              {tag}
            </span>
          ))}
          {result.isNew && (
            <motion.span
              initial={{ scale: 3, opacity: 0, rotate: -28 }}
              animate={{ scale: 1, opacity: 1, rotate: -6 }}
              transition={{ delay: 1.05, type: 'spring', damping: 12, stiffness: 320 }}
              className="rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white shadow-lg md:px-5 md:py-2 md:text-base"
            >
              NEW
            </motion.span>
          )}
        </div>

        {/* 台词打字机（后续语音的同步挂载点） */}
        <p className="mt-3 max-h-[10vh] max-w-md overflow-hidden text-sm font-bold leading-relaxed text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.95)] md:mt-7 md:max-h-none md:text-2xl">
          {quote.slice(0, typed)}
        </p>

        <div className={cn('mt-4 flex items-center gap-2 md:gap-3', panelOnRight && 'justify-end')}>
          {canSwitch && (
            <span className="rounded-full border border-white/20 bg-slate-950/38 px-3 py-1.5 text-xs font-semibold text-white/82 backdrop-blur-sm md:text-sm">
              {activeIndex + 1}/{results.length}
            </span>
          )}
        </div>
      </motion.div>

      {showCompleteButton && (
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
      )}

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

/* ────── 主组件 ────── */
export default function GachaAnimation({ results, isTenPull, onComplete }: GachaAnimationProps) {
  const indexedResults = useMemo(
    () => results.map((result, index) => ({ result, index })),
    [results],
  );
  const highRevealOrder = useMemo(
    () => indexedResults
      .filter(({ result }) => result.rarity === 'SR' || result.rarity === 'SSR')
      .sort((a, b) => {
        const byRarity = rarityRank[b.result.rarity] - rarityRank[a.result.rarity];
        return byRarity === 0 ? a.index - b.index : byRarity;
      })
      .map(({ index }) => index),
    [indexedResults],
  );
  const normalRevealOrder = useMemo(
    () => indexedResults
      .filter(({ result }) => result.rarity === 'N' || result.rarity === 'R')
      .sort((a, b) => {
        const byRarity = rarityRank[b.result.rarity] - rarityRank[a.result.rarity];
        return byRarity === 0 ? a.index - b.index : byRarity;
      })
      .map(({ index }) => index),
    [indexedResults],
  );
  const featuredIndex = useMemo(() => {
    if (results.length === 0) return 0;
    return results.reduce((bestIndex, result, index) => (
      rarityRank[result.rarity] > rarityRank[results[bestIndex].rarity] ? index : bestIndex
    ), 0);
  }, [results]);
  const initialPhase = highRevealOrder.length > 0
    ? 'highReveal'
    : normalRevealOrder.length > 0
      ? 'reveal'
      : 'done';

  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<'highReveal' | 'highShowcase' | 'reveal' | 'done'>(initialPhase);
  const [activeHighRevealIndex, setActiveHighRevealIndex] = useState(0);
  const [activeResultIndex, setActiveResultIndex] = useState(featuredIndex);
  const [skipped, setSkipped] = useState(false);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shakeControls = useAnimationControls();
  const hasHighReveal = highRevealOrder.length > 0;
  const allNormalsRevealed = normalRevealOrder.length > 0
    && normalRevealOrder.every((index) => revealedIndices.has(index));

  const doShake = useCallback((mag: number) => {
    void shakeControls.start(shakeKeyframes(mag), { duration: 0.38 });
  }, [shakeControls]);

  const handleRevealFx = useCallback((rarity: Rarity) => {
    doShake(SHAKE_MAG[rarity]);
  }, [doShake]);

  const handleReveal = useCallback((index: number) => {
    setRevealedIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const activeHighResultIndex = highRevealOrder[activeHighRevealIndex];
  const activeHighResult = activeHighResultIndex === undefined ? undefined : results[activeHighResultIndex];

  useEffect(() => {
    revealTimersRef.current.forEach(clearTimeout);
    clearTimeout(skipTimerRef.current);
    setRevealedIndices(new Set());
    setActiveHighRevealIndex(0);
    setActiveResultIndex(featuredIndex);
    setSkipped(false);
    setPhase(initialPhase);
  }, [featuredIndex, initialPhase, results]);

  const finishHighReveal = useCallback(() => {
    const nextHighRevealIndex = activeHighRevealIndex + 1;
    setActiveResultIndex(highRevealOrder[activeHighRevealIndex] ?? featuredIndex);

    if (nextHighRevealIndex < highRevealOrder.length || normalRevealOrder.length > 0) {
      setPhase('highShowcase');
      return;
    }

    setPhase('done');
  }, [activeHighRevealIndex, featuredIndex, highRevealOrder, normalRevealOrder.length]);

  const continueAfterHighShowcase = useCallback(() => {
    const nextHighRevealIndex = activeHighRevealIndex + 1;
    if (nextHighRevealIndex < highRevealOrder.length) {
      setActiveHighRevealIndex(nextHighRevealIndex);
      setPhase('highReveal');
      return;
    }

    setActiveResultIndex(featuredIndex);
    setPhase(normalRevealOrder.length > 0 ? 'reveal' : 'done');
  }, [activeHighRevealIndex, featuredIndex, highRevealOrder.length, normalRevealOrder.length]);

  useEffect(() => {
    if (phase !== 'highShowcase') return;
    const timer = setTimeout(continueAfterHighShowcase, 1800);
    return () => clearTimeout(timer);
  }, [continueAfterHighShowcase, phase]);

  /* 普通卡揭晓排程：R/N 直接砸卡面；SR/SSR 已经按 SSR → SR 的顺序揭晓。 */
  useEffect(() => {
    if (phase !== 'reveal' || skipped) return;
    if (normalRevealOrder.length === 0) return;
    let t = 260;
    const timers: ReturnType<typeof setTimeout>[] = [];
    normalRevealOrder.forEach((idx) => {
      timers.push(setTimeout(() => handleReveal(idx), t));
      t += 330;
    });
    revealTimersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [phase, skipped, normalRevealOrder, handleReveal]);

  /* 普通卡全部揭晓：纯普通池进结算展示；已有高稀有展示时只等待用户收下，避免本体二次播放。 */
  useEffect(() => {
    if (phase !== 'reveal') return;
    if (normalRevealOrder.length === 0) {
      setActiveResultIndex(featuredIndex);
      setPhase('done');
      return;
    }
    if (allNormalsRevealed) {
      if (hasHighReveal) return;
      const timer = setTimeout(() => {
        setActiveResultIndex(featuredIndex);
        setPhase('done');
      }, skipped ? 250 : 760);
      return () => clearTimeout(timer);
    }
  }, [allNormalsRevealed, featuredIndex, hasHighReveal, normalRevealOrder.length, phase, skipped]);

  /* 长按跳过（防误触） */
  const doSkip = useCallback(() => {
    setSkipped(true);
    revealTimersRef.current.forEach(clearTimeout);
    setRevealedIndices(new Set(normalRevealOrder));
    setActiveResultIndex(featuredIndex);
    setPhase((currentPhase) => {
      if (currentPhase === 'done') return currentPhase;
      return normalRevealOrder.length > 0 ? 'reveal' : 'done';
    });
  }, [featuredIndex, normalRevealOrder]);

  const startSkipHold = useCallback(() => {
    skipTimerRef.current = setTimeout(doSkip, 600);
  }, [doSkip]);

  const cancelSkipHold = useCallback(() => {
    clearTimeout(skipTimerRef.current);
  }, []);

  const showPreviousResult = useCallback(() => {
    setActiveResultIndex((index) => (index - 1 + results.length) % results.length);
  }, [results.length]);

  const showNextResult = useCallback(() => {
    setActiveResultIndex((index) => (index + 1) % results.length);
  }, [results.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 backdrop-blur-md"
    >
      {/* 震屏容器：所有演出内容都在里面晃 */}
      <motion.div animate={shakeControls} className="relative flex h-full w-full flex-col">

        {phase === 'highReveal' && activeHighResult && (
          <HighRarityReveal
            key={`${activeHighResult.characterId}-${activeHighResultIndex}`}
            result={activeHighResult}
            onShake={doShake}
            onDone={finishHighReveal}
          />
        )}

        {phase === 'highShowcase' && activeHighResultIndex !== undefined && (
          <GachaShowcase
            results={results}
            activeIndex={activeHighResultIndex}
            onPrev={showPreviousResult}
            onNext={showNextResult}
            onComplete={continueAfterHighShowcase}
            onShake={doShake}
            showCompleteButton={false}
            showSwitchControls={false}
          />
        )}

        {phase === 'reveal' && (
          <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6">
            <div className={cn('flex flex-wrap items-center justify-center gap-3', isTenPull ? 'max-w-md' : '')}>
              {normalRevealOrder.map((index) => {
                const result = results[index];
                return (
                <GachaCard
                  key={`${result.characterId}-${index}`}
                  result={result}
                  index={index}
                  isRevealed={revealedIndices.has(index)}
                  quiet={skipped}
                  onReveal={handleReveal}
                  onRevealFx={handleRevealFx}
                />
                );
              })}
            </div>
            {hasHighReveal && allNormalsRevealed && (
              <motion.button
                onClick={onComplete}
                initial={{ y: 18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: skipped ? 0 : 0.45, duration: 0.32, ease: 'easeOut' }}
                className="group absolute bottom-8 left-1/2 z-40 flex h-10 -translate-x-1/2 items-center gap-3 rounded-full border border-white/20 bg-slate-950/44 px-4 text-sm font-bold text-white/88 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-amber-200/70 hover:bg-slate-950/58 hover:text-amber-100 md:h-11 md:px-5"
              >
                <span className="h-px w-7 bg-gradient-to-r from-transparent via-amber-200/75 to-amber-200/20" />
                <span className="tracking-[0.18em]">收下羁绊</span>
                <ChevronRight size={17} strokeWidth={2.2} className="-ml-1 text-amber-200/90 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            )}
          </div>
        )}

        {phase === 'done' && results.length > 0 && (
          <GachaShowcase
            results={results}
            activeIndex={activeResultIndex}
            onPrev={showPreviousResult}
            onNext={showNextResult}
            onComplete={onComplete}
            onShake={doShake}
          />
        )}
      </motion.div>

      {/* 长按跳过 */}
      {(phase === 'highReveal' || (phase === 'reveal' && !allNormalsRevealed)) && !skipped && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-8 left-0 right-0 z-30 flex shrink-0 justify-center px-4"
        >
          <button
            onPointerDown={startSkipHold}
            onPointerUp={cancelSkipHold}
            onPointerLeave={cancelSkipHold}
            className={cn(
              'select-none rounded-lg px-6 py-2.5 text-sm font-medium',
              'bg-slate-800/80 text-gray-300',
              'border border-slate-600/50',
              'active:bg-slate-700/80 active:text-white',
              'transition-colors duration-200',
            )}
          >
            长按跳过动画
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
