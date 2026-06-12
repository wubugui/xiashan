/**
 * 抽卡演出 — 三段式情绪曲线：蓄力（光束坠落）→ 揭晓（冲击帧，按稀有度分管线）→ 余韵（结算展示）。
 *
 * 参考主流抽卡游戏的套路：
 * - 光束色暗示本次最高稀有度（蓝 R / 紫 SR / 金 SSR），SSR 有 30% 概率「紫变金」升变彩蛋
 * - N/R 砸牌、SR 紫闪震屏、SSR 黑屏静默拍 → 金色星爆 → 全屏立绘急刹变焦
 * - 十连按稀有度从低到高揭晓，最高的压轴；跳过改长按防误触
 * 全部用 framer-motion + canvas-confetti + Web Audio 合成音 + 震动 API 实现，无视频资源。
 */
import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getCharacterById } from '@/data/characters';
import { playSound } from '@/lib/sound';
import {
  vibrate, VIBE, shakeKeyframes, dustAt, burstPurpleSides, burstGoldCelebration, goldRain,
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

/** 揭晓瞬间的全屏色闪（SR 以上才闪，N/R 靠震屏+尘爆） */
const FLASH_BG: Record<Rarity, string> = {
  N: 'bg-white',
  R: 'bg-blue-200',
  SR: 'bg-purple-300',
  SSR: 'bg-amber-100',
};

const SHAKE_MAG: Record<Rarity, number> = { N: 4, R: 5, SR: 9, SSR: 15 };

/** 蓄力光束配色 */
const BEAM_STYLE: Record<Rarity, { core: string; glow: string }> = {
  N: { core: '#e2e8f0', glow: 'rgba(148,163,184,0.55)' },
  R: { core: '#bfdbfe', glow: 'rgba(59,130,246,0.6)' },
  SR: { core: '#e9d5ff', glow: 'rgba(147,51,234,0.65)' },
  SSR: { core: '#fde68a', glow: 'rgba(251,191,36,0.7)' },
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

/* ────── 蓄力：光束坠落（色 = 本次最高稀有度；SSR 可能先伪装成紫再升变） ────── */
function BeamIntro({
  tease, finalTease, onShake, onDone,
}: {
  tease: Rarity;
  /** 升变后的真实色（与 tease 不同时触发紫变金演出） */
  finalTease: Rarity;
  onShake: (mag: number) => void;
  onDone: () => void;
}) {
  const upgraded = tease !== finalTease;
  const [stage, setStage] = useState<'drop' | 'impact' | 'upgrade'>('drop');
  const colorKey = stage === 'upgrade' ? finalTease : tease;
  const c = BEAM_STYLE[colorKey];

  useEffect(() => {
    playSound('gacha-riser');
    vibrate(15);
    const ts: ReturnType<typeof setTimeout>[] = [];
    ts.push(setTimeout(() => {
      setStage('impact');
      playSound('gacha-impact');
      onShake(tease === 'SSR' ? 14 : 9);
      vibrate(VIBE.mid);
    }, 520));
    if (upgraded) {
      ts.push(setTimeout(() => {
        setStage('upgrade');
        playSound('gacha-upgrade');
        onShake(18);
        vibrate(VIBE.heavy);
      }, 1250));
      ts.push(setTimeout(onDone, 2050));
    } else {
      ts.push(setTimeout(onDone, 1500));
    }
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* 光束本体：从顶部砸向中央 */}
      <motion.div
        key={`beam-${colorKey}`}
        initial={{ scaleY: 0, opacity: 0.9 }}
        animate={{ scaleY: 1, opacity: stage === 'drop' ? 0.9 : 1 }}
        transition={{ duration: 0.45, ease: [0.7, 0, 0.84, 0] }}
        className="absolute left-1/2 top-0 h-[52vh] w-16 -translate-x-1/2 origin-top sm:w-24"
        style={{ background: `linear-gradient(to bottom, transparent, ${c.glow} 35%, ${c.core})`, filter: 'blur(2px)' }}
      />
      <motion.div
        key={`core-${colorKey}`}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.45, ease: [0.7, 0, 0.84, 0] }}
        className="absolute left-1/2 top-0 h-[52vh] w-3 -translate-x-1/2 origin-top"
        style={{ background: `linear-gradient(to bottom, transparent, ${c.core})` }}
      />

      {/* 落点冲击：辉光 + 扩散环 */}
      {stage !== 'drop' && (
        <div className="absolute left-1/2 top-[52vh] -translate-x-1/2 -translate-y-1/2">
          <motion.div
            key={`glow-${colorKey}`}
            initial={{ scale: 0.4, opacity: 1 }}
            animate={{ scale: stage === 'upgrade' ? 2.2 : 1.4, opacity: 0.85 }}
            transition={{ duration: 0.4 }}
            className="h-36 w-36 rounded-full blur-xl"
            style={{ background: `radial-gradient(circle, ${c.core}, ${c.glow} 55%, transparent 75%)` }}
          />
          {[0, 0.18].map((d, i) => (
            <motion.div
              key={`ring-${colorKey}-${i}`}
              initial={{ scale: 0.3, opacity: 0.9 }}
              animate={{ scale: 4.6, opacity: 0 }}
              transition={{ duration: 0.85, delay: d, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full border-[3px]"
              style={{ borderColor: c.core }}
            />
          ))}
        </div>
      )}

      {/* 升变白闪（紫变金的瞬间） */}
      {stage === 'upgrade' && (
        <motion.div
          initial={{ opacity: 0.95 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.55 }}
          className="absolute inset-0 bg-amber-50"
        />
      )}
    </div>
  );
}

/* ────── 单抽 SSR 专属：黑屏静默拍 → 金色星爆 ────── */
function SSRCinematic({ onShake, onDone }: { onShake: (mag: number) => void; onDone: () => void }) {
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setBurst(true);
      playSound('gacha-ssr');
      burstGoldCelebration(2400);
      onShake(18);
      vibrate(VIBE.heavy);
    }, 380);
    const t2 = setTimeout(onDone, 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className="absolute inset-0 z-20 overflow-hidden bg-black">
      {burst && (
        <>
          {/* 金色射线星爆 */}
          <motion.div
            initial={{ scale: 0, rotate: -40, opacity: 1 }}
            animate={{ scale: 1.6, rotate: 12, opacity: 0.95 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 top-1/2 h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen"
            style={{
              background:
                'repeating-conic-gradient(from 0deg, rgba(251,191,36,0.85) 0deg 7deg, transparent 7deg 24deg), radial-gradient(circle, #fff7d6 0%, rgba(251,191,36,0.5) 26%, transparent 62%)',
            }}
          />
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="absolute inset-0 bg-amber-50"
          />
        </>
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
  const hasWideSceneArt = Boolean(character?.gachaBackgroundUrl);

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
          'relative h-44 w-28 overflow-hidden rounded-lg sm:h-52 sm:w-32',
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
              className="absolute inset-0 flex flex-col"
            >
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
  results, activeIndex, onPrev, onNext, onComplete, onShake,
}: {
  results: GachaResult[];
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onComplete: () => void;
  onShake: (mag: number) => void;
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

  /* 入场音效编排：星星逐颗钉入；SSR 名字逐字砸出 + 金粒瀑布 */
  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    const starCount = rarityStars[result.rarity];
    for (let i = 0; i < starCount; i++) {
      ts.push(setTimeout(() => { playSound('star-pin'); if (isSSR) vibrate(10); }, 280 + i * 140));
    }
    if (isSSR) {
      goldRain(2000);
      vibrate(VIBE.mid);
      for (let i = 0; i < result.name.length; i++) {
        ts.push(setTimeout(() => { playSound('name-hit'); onShake(3); }, 620 + i * 85));
      }
    }
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  /* SSR 漂浮金粒（结算页氛围） */
  const motes = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      left: `${(i * 37 + 11) % 100}%`,
      top: `${(i * 53 + 23) % 90}%`,
      size: 2 + (i % 3) * 1.5,
      dur: 3.2 + (i % 5) * 0.7,
      delay: (i % 7) * 0.45,
    })),
    [],
  );

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

      {/* 法阵环：SSR 缓慢旋转 */}
      <motion.div
        initial={{ rotate: -8, scale: 0.9, opacity: 0 }}
        animate={{ rotate: isSSR ? 352 : 0, scale: 1, opacity: 0.28 }}
        transition={isSSR
          ? { rotate: { duration: 26, repeat: Infinity, ease: 'linear' }, scale: { duration: 0.7 }, opacity: { duration: 0.7 } }
          : { duration: 0.7 }}
        className="pointer-events-none absolute left-1/2 top-[8%] h-[74vh] w-[74vh] -translate-x-1/2 rounded-full border-[5px] border-amber-100/45 mix-blend-screen"
      >
        <div className="absolute inset-12 rounded-full border border-amber-100/35" />
        <div className="absolute inset-24 rounded-full border border-amber-100/25" />
      </motion.div>

      {/* SSR 漂浮金粒 */}
      {isSSR && motes.map((m, i) => (
        <motion.span
          key={i}
          animate={{ y: [-8, 8, -8], opacity: [0.25, 0.85, 0.25] }}
          transition={{ duration: m.dur, repeat: Infinity, delay: m.delay, ease: 'easeInOut' }}
          className="pointer-events-none absolute rounded-full bg-amber-200"
          style={{ left: m.left, top: m.top, width: m.size, height: m.size, boxShadow: '0 0 8px rgba(251,191,36,0.9)' }}
        />
      ))}

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
              className="text-2xl text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.75)] md:text-4xl"
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
          <span className="rounded-full bg-amber-300/90 px-3 py-1 text-xs font-black text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.36)] md:px-5 md:py-2 md:text-base">
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

/* ────── 主组件 ────── */
export default function GachaAnimation({ results, isTenPull, onComplete }: GachaAnimationProps) {
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<'beam' | 'cinematic' | 'reveal' | 'done'>('beam');
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [flash, setFlash] = useState<{ k: number; rarity: Rarity } | null>(null);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shakeControls = useAnimationControls();

  const maxRarity = useMemo(
    () => results.reduce<Rarity>((best, r) => (rarityRank[r.rarity] > rarityRank[best] ? r.rarity : best), 'N'),
    [results],
  );
  /** 紫变金假出金：仅当真出 SSR 时 30% 概率先伪装成紫光 */
  const [fakeOut] = useState(() => maxRarity === 'SSR' && Math.random() < 0.3);
  const isSingleSSR = results.length === 1 && results[0].rarity === 'SSR';

  const doShake = useCallback((mag: number) => {
    void shakeControls.start(shakeKeyframes(mag), { duration: 0.38 });
  }, [shakeControls]);

  const handleRevealFx = useCallback((rarity: Rarity) => {
    doShake(SHAKE_MAG[rarity]);
    if (rarity === 'SR' || rarity === 'SSR') {
      setFlash(f => ({ k: (f?.k ?? 0) + 1, rarity }));
    }
  }, [doShake]);

  const handleReveal = useCallback((index: number) => {
    setRevealedIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  /* 蓄力结束 → 单抽 SSR 走专属 cinematic，其余进入揭晓 */
  const handleBeamDone = useCallback(() => {
    setPhase(isSingleSSR ? 'cinematic' : 'reveal');
  }, [isSingleSSR]);

  /* 揭晓排程：按稀有度从低到高，最高的压轴（揭晓前多停 0.7s 吊胃口） */
  useEffect(() => {
    if (phase !== 'reveal' || skipped) return;
    const order = results
      .map((_, i) => i)
      .sort((a, b) => rarityRank[results[a].rarity] - rarityRank[results[b].rarity]);
    let t = 350;
    const timers: ReturnType<typeof setTimeout>[] = [];
    order.forEach((idx, pos) => {
      if (pos === order.length - 1 && order.length > 1) t += 700;
      timers.push(setTimeout(() => handleReveal(idx), t));
      t += 430;
    });
    revealTimersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [phase, skipped, results, handleReveal]);

  /* 全部揭晓 → 进入结算展示（压轴/最高稀有度优先展示） */
  useEffect(() => {
    if (phase !== 'reveal') return;
    if (revealedIndices.size === results.length && results.length > 0) {
      const timer = setTimeout(() => {
        const featuredIndex = results.reduce((bestIndex, result, index) => {
          return rarityRank[result.rarity] > rarityRank[results[bestIndex].rarity] ? index : bestIndex;
        }, 0);
        setActiveResultIndex(featuredIndex);
        setPhase('done');
      }, skipped ? 250 : 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, revealedIndices, results, skipped]);

  /* 长按跳过（防误触） */
  const doSkip = useCallback(() => {
    setSkipped(true);
    revealTimersRef.current.forEach(clearTimeout);
    setRevealedIndices(new Set(results.map((_, i) => i)));
    setPhase(p => (p === 'beam' || p === 'cinematic') ? 'reveal' : p);
  }, [results]);

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

        {phase === 'beam' && (
          <BeamIntro
            tease={fakeOut ? 'SR' : maxRarity}
            finalTease={maxRarity}
            onShake={doShake}
            onDone={handleBeamDone}
          />
        )}

        {phase === 'cinematic' && (
          <SSRCinematic onShake={doShake} onDone={() => setPhase('done')} />
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
                  quiet={skipped}
                  onReveal={handleReveal}
                  onRevealFx={handleRevealFx}
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
            onShake={doShake}
          />
        )}
      </motion.div>

      {/* 揭晓瞬间的全屏色闪（SR 紫 / SSR 金） */}
      {flash && (
        <motion.div
          key={flash.k}
          initial={{ opacity: flash.rarity === 'SSR' ? 0.85 : 0.55 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onAnimationComplete={() => setFlash(null)}
          className={cn('pointer-events-none fixed inset-0 z-40', FLASH_BG[flash.rarity])}
        />
      )}

      {/* 长按跳过 */}
      {(phase === 'beam' || phase === 'reveal') && !skipped && (
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
