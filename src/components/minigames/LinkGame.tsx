import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, RotateCcw, Timer, Lightbulb, UserPlus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { getGiftCardById } from '@/data/collectibles';
import type { ServiceTag } from '@/data/types';
import { cn } from '@/lib/utils';
import { playSound } from '@/lib/sound';
import { assetUrl } from '@/lib/assets';
import PageBackdrop from '@/components/PageBackdrop';
import { SCENE_BACKDROPS } from '@/lib/pageBackdrops';

/**
 * 打烊后的理货时间 — 便利屋日结小游戏。
 * 拖动交换相邻商品，三连上架获得月光（营业额）；支持连锁、提示、死局自动洗牌。
 * 可邀请一位已入伙的女主陪玩：按服务类型给小被动、大消除时有台词反应、每日首次陪玩 +2 好感。
 */

const ROWS = 8;
const COLS = 6;
const CELL = 52;
const REWARD_PER_TILE = 5; // 每上架一件 5 月光
const DRAG_THRESHOLD = CELL * 0.28;
const HINT_COOLDOWN = 3; // 提示冷却（秒）
const FREE_HINTS_PER_DAY = 3;

/** 六种便利屋商品：颜色 + 图案双重区分 */
const TILE_STYLES: Record<string, { emoji: string; label: string; bg: string; border: string }> = {
  gem:     { emoji: '🌙', label: '月光',   bg: 'bg-gradient-to-br from-sky-400/80 to-blue-700/80',      border: 'border-sky-200/60' },
  coffee:  { emoji: '☕', label: '热咖啡', bg: 'bg-gradient-to-br from-amber-500/80 to-orange-800/80',  border: 'border-amber-200/60' },
  oden:    { emoji: '🍢', label: '关东煮', bg: 'bg-gradient-to-br from-rose-400/80 to-red-700/80',      border: 'border-rose-200/60' },
  catfood: { emoji: '🥫', label: '猫罐头', bg: 'bg-gradient-to-br from-violet-400/80 to-purple-800/80', border: 'border-violet-200/60' },
  parcel:  { emoji: '📦', label: '快递',   bg: 'bg-gradient-to-br from-emerald-400/80 to-teal-800/80',  border: 'border-emerald-200/60' },
  onigiri: { emoji: '🍙', label: '饭团',   bg: 'bg-gradient-to-br from-indigo-400/80 to-slate-700/80',  border: 'border-indigo-200/60' },
};
const KINDS = Object.keys(TILE_STYLES);

/**
 * 陪玩被动：按服务类型。全部围绕「理货连消刷月光」设计——尤其与江夏的自动连消叠加，
 * 让玩家搭配不同搭档刷得更爽（营业额倍率 / 连锁 / 猫罐头 / 暴击 / 每消固定 / 自动时长 / 自动手速）。
 */
interface CompanionPassive {
  desc: string;
  /** 营业额倍率（>1 加成） */
  revenueMult?: number;
  /** 连锁层数 + */
  chain?: number;
  /** 猫罐头🥫计分倍率 */
  catMult?: number;
  /** 每次消除暴击（翻倍）概率 */
  critChance?: number;
  /** 每次消除额外固定月光 */
  flatPerMatch?: number;
  /** 江夏自动连消时长 +秒 */
  durationBonus?: number;
  /** 江夏自动连消出手更快 */
  speedUp?: boolean;
}
const PASSIVES: Record<string, CompanionPassive> = {
  补给: { desc: '营业额 +20%', revenueMult: 1.20 },
  万能: { desc: '营业额 +25%（样样都行）', revenueMult: 1.25 },
  观察: { desc: '营业额 +15%', revenueMult: 1.15 },
  表达: { desc: '连锁加成 +1 层（连消更值钱）', chain: 1 },
  宠物: { desc: '猫罐头🥫计分 ×3', catMult: 3 },
  情报: { desc: '每次消除额外 +8 月光', flatPerMatch: 8 },
  技术: { desc: '暴击：每次消除 25% 概率翻倍', critChance: 0.25 },
  维修: { desc: '暴击：每次消除 25% 概率翻倍', critChance: 0.25 },
  安抚: { desc: '江夏自动连消时长 +8 秒', durationBonus: 8 },
  恢复: { desc: '江夏自动连消时长 +12 秒', durationBonus: 12 },
  流程: { desc: '江夏自动连消出手更快', speedUp: true },
  路线: { desc: '江夏自动连消出手更快', speedUp: true },
};

interface Tile { id: number; kind: string }
let UID = 1;
const mkTile = (kind: string): Tile => ({ id: UID++, kind });

/* ───── 工具函数 ───── */

function buildGrid(): Tile[][] {
  const g: Tile[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < COLS; c++) {
      let kind: string;
      let t = 0;
      do {
        kind = KINDS[Math.floor(Math.random() * KINDS.length)];
        t++;
      } while (
        t < 12 &&
        ((c >= 2 && row[c - 1]?.kind === kind && row[c - 2]?.kind === kind) ||
          (r >= 2 && g[r - 1]?.[c]?.kind === kind && g[r - 2]?.[c]?.kind === kind))
      );
      row.push(mkTile(kind));
    }
    g.push(row);
  }
  return g;
}

function findMatches(g: Tile[][]): Set<string> {
  const hit = new Set<string>();
  for (let r = 0; r < ROWS; r++) {
    let s = 0;
    for (let c = 1; c <= COLS; c++) {
      if (c < COLS && g[r][c].kind === g[r][s].kind) continue;
      if (c - s >= 3) for (let k = s; k < c; k++) hit.add(`${r},${k}`);
      s = c;
    }
  }
  for (let c = 0; c < COLS; c++) {
    let s = 0;
    for (let r = 1; r <= ROWS; r++) {
      if (r < ROWS && g[r][c].kind === g[s][c].kind) continue;
      if (r - s >= 3) for (let k = s; k < r; k++) hit.add(`${k},${c}`);
      s = r;
    }
  }
  return hit;
}

function collapse(g: Tile[][], toRemove: Set<string>): Tile[][] {
  const next: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null as unknown as Tile));
  for (let c = 0; c < COLS; c++) {
    const col: Tile[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!toRemove.has(`${r},${c}`)) col.push(g[r][c]);
    }
    for (let r = ROWS - 1; r >= 0; r--) {
      next[r][c] = col.shift() ?? mkTile(KINDS[Math.floor(Math.random() * KINDS.length)]);
    }
  }
  return next;
}

function findHint(g: Tile[][]): [number, number, number, number] | null {
  const trySwap = (ar: number, ac: number, br: number, bc: number) => {
    const next = g.map((row) => [...row]);
    [next[ar][ac], next[br][bc]] = [next[br][bc], next[ar][ac]];
    return findMatches(next).size > 0;
  };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS && trySwap(r, c, r, c + 1)) return [r, c, r, c + 1];
      if (r + 1 < ROWS && trySwap(r, c, r + 1, c)) return [r, c, r + 1, c];
    }
  }
  return null;
}

/* ───── 组件 ───── */

export default function LinkGame({ onExit }: { onExit: () => void }) {
  const addSpiritStones = usePlayerStore((s) => s.addSpiritStones);
  const hintTokens = usePlayerStore((s) => s.hintTokens);
  const freeHints = usePlayerStore((s) => s.freeHints);
  const consumeMinigameHint = usePlayerStore((s) => s.consumeMinigameHint);
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const minigameCompanion = usePlayerStore((s) => s.minigameCompanion);
  const setMinigameCompanion = usePlayerStore((s) => s.setMinigameCompanion);
  const addAffinity = usePlayerStore((s) => s.addAffinity);
  const tryDailyAction = usePlayerStore((s) => s.tryDailyAction);
  const equippedGift = usePlayerStore((s) => s.equippedGift);
  const dailyActions = usePlayerStore((s) => s.dailyActions);

  const [grid, setGrid] = useState<Tile[][]>(() => buildGrid());
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [combo, setCombo] = useState(0);
  const [hintPair, setHintPair] = useState<Set<string> | null>(null);
  const [hintReadyAt, setHintReadyAt] = useState(0);
  const [reshuffled, setReshuffled] = useState(false);
  const [hintNotice, setHintNotice] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  /** 陪玩台词气泡 */
  const [companionSay, setCompanionSay] = useState<string | null>(null);
  /** 随身信物自动连消：结束时间戳 + 剩余秒数 */
  const [autoEndAt, setAutoEndAt] = useState<number | null>(null);
  const [autoRemain, setAutoRemain] = useState(0);

  const drag = useRef<{ r: number; c: number; x: number; y: number } | null>(null);
  const [dragVisual, setDragVisual] = useState<{ r: number; c: number; dx: number; dy: number } | null>(null);

  /* ── 陪玩搭档 ── */
  const companionOwned = ownedCharacters.find((o) => o.characterId === minigameCompanion);
  const companion = companionOwned ? getCharacterById(companionOwned.characterId) : undefined;
  const passive = companion ? PASSIVES[companion.serviceType as ServiceTag] ?? PASSIVES.万能 : null;

  /** 她的随机台词（角色台词 + 手机口头禅混合） */
  const companionLines = useMemo(() => {
    if (!companion) return [];
    const lvl = companionOwned?.level ?? 1;
    const dialogues = companion.dialogues.filter((d) => d.level <= lvl).map((d) => d.text);
    const phrases = companion.phonePersonality?.commonPhrases ?? [];
    return [...dialogues, ...phrases];
  }, [companion, companionOwned]);

  const sayRandom = useCallback(() => {
    if (companionLines.length === 0) return;
    setCompanionSay(companionLines[Math.floor(Math.random() * companionLines.length)]);
    window.setTimeout(() => setCompanionSay(null), 2400);
  }, [companionLines]);

  /** 每日首次陪玩 +2 好感 */
  useEffect(() => {
    if (!companion) return;
    if (tryDailyAction(`minigame:${companion.id}`)) {
      addAffinity(companion.id, 4);
      setHintNotice(`和${companion.name}一起理货，好感 +4 💕`);
      window.setTimeout(() => setHintNotice(null), 2400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companion?.id]);

  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const hintCooldown = HINT_COOLDOWN;
  const hintCooldownLeft = Math.max(0, Math.ceil((hintReadyAt - Date.now()) / 1000));
  const maxFree = FREE_HINTS_PER_DAY;
  const today = new Date().toISOString().slice(0, 10);
  const freeLeft = Math.max(0, maxFree - (freeHints.date === today ? freeHints.used : 0));

  /** 死局检测：无可消除一步时自动洗牌 */
  const ensurePlayable = useCallback((g: Tile[][]) => {
    if (findHint(g)) return;
    playSound('reshuffle');
    setReshuffled(true);
    window.setTimeout(() => setReshuffled(false), 1600);
    setGrid(buildGrid());
  }, []);

  /** 连锁消除 */
  const cascade = useCallback(
    (g: Tile[][], depth: number) => {
      const matches = findMatches(g);
      if (matches.size === 0) {
        setBusy(false);
        setCombo(0);
        ensurePlayable(g);
        return;
      }
      // 计分：搭档被动叠加自动/手动连消——猫罐头倍率、连锁层数、营业额倍率、暴击、每消固定
      const p = passive;
      let base = 0;
      for (const key of matches) {
        const [r, c] = key.split(',').map(Number);
        const isCat = g[r][c].kind === 'catfood';
        base += REWARD_PER_TILE * (isCat ? (p?.catMult ?? 1) : 1);
      }
      let earned = base * Math.max(1, depth + (p?.chain ?? 0));
      if (p?.revenueMult) earned = Math.ceil(earned * p.revenueMult);
      if (p?.critChance && Math.random() < p.critChance) earned *= 2;
      earned += (p?.flatPerMatch ?? 0);

      addSpiritStones(earned);
      setScore((s) => s + earned);
      setFlashing(matches);
      setCombo(depth);

      try { navigator.vibrate?.(depth >= 2 ? 60 : 25); } catch { /* 不支持则忽略 */ }
      playSound(depth >= 2 ? 'match-combo' : 'match');
      confetti({
        particleCount: Math.min(80, matches.size * 6 + depth * 10),
        spread: 60,
        startVelocity: 28,
        origin: { y: 0.55 },
        scalar: 0.8,
      });
      // 大消除/连锁时她有反应
      if (matches.size >= 6 || depth >= 2) sayRandom();

      window.setTimeout(() => {
        const next = collapse(g, matches);
        setFlashing(new Set());
        setGrid(next);
        window.setTimeout(() => cascade(next, depth + 1), 110);
      }, 420);
    },
    [addSpiritStones, ensurePlayable, passive, sayRandom],
  );

  const attemptSwap = useCallback(
    (ar: number, ac: number, br: number, bc: number) => {
      if (busy) return;
      if (br < 0 || br >= ROWS || bc < 0 || bc >= COLS) return;
      setBusy(true);
      setHintPair(null);

      const next = grid.map((row) => [...row]);
      [next[ar][ac], next[br][bc]] = [next[br][bc], next[ar][ac]];

      const matches = findMatches(next);
      if (matches.size === 0) {
        setGrid(next);
        try { navigator.vibrate?.(10); } catch { /* ignore */ }
        window.setTimeout(() => {
          setGrid(grid);
          setBusy(false);
        }, 180);
        return;
      }
      playSound('swap');
      setGrid(next);
      window.setTimeout(() => cascade(next, 1), 80);
    },
    [busy, grid, cascade],
  );

  /* ── 随身信物：江夏的「自动连消」礼物（autoLink）── */
  const autoGift = useMemo(() => {
    const g = getGiftCardById(equippedGift);
    return g && g.effect.kind === 'autoLink' ? g : null;
  }, [equippedGift]);
  const autoAvailable = dailyActions['gift_active'] !== new Date().toISOString().slice(0, 10);

  const startAuto = useCallback(() => {
    if (!autoGift || autoEndAt !== null) return;
    if (!tryDailyAction('gift_active')) return;
    playSound('stage-up');
    // 安抚/恢复型搭档延长自动连消时长
    const bonusMs = (passive?.durationBonus ?? 0) * 1000;
    setAutoEndAt(Date.now() + (autoGift.effect.durationSec ?? 20) * 1000 + bonusMs);
  }, [autoGift, autoEndAt, tryDailyAction, passive]);

  // 倒计时 + 到点停止
  useEffect(() => {
    if (autoEndAt === null) { setAutoRemain(0); return; }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((autoEndAt - Date.now()) / 1000));
      setAutoRemain(rem);
      if (rem <= 0) setAutoEndAt(null);
    };
    tick();
    const iv = window.setInterval(tick, 300);
    return () => window.clearInterval(iv);
  }, [autoEndAt]);

  // 自动驱动：空闲时找一步可消除的交换并执行，连成节奏由 cascade 接管（快而有过程）
  useEffect(() => {
    if (autoEndAt === null || busy || Date.now() >= autoEndAt) return;
    const hint = findHint(grid);
    if (!hint) { setGrid(buildGrid()); return; } // 死局 → 重洗
    // 流程/路线型搭档让出手更快
    const delay = passive?.speedUp ? 110 : 200;
    const t = window.setTimeout(() => attemptSwap(hint[0], hint[1], hint[2], hint[3]), delay);
    return () => window.clearTimeout(t);
  }, [autoEndAt, busy, grid, attemptSwap, passive]);

  /** 提示：每日免费(情报/观察型陪玩+1)，之后消耗提示券 */
  const showHint = useCallback(() => {
    if (busy || Date.now() < hintReadyAt) return;
    const hint = findHint(grid);
    if (!hint) {
      ensurePlayable(grid);
      return;
    }
    const source = consumeMinigameHint(maxFree);
    if (source === 'none') {
      setHintNotice('今日免费提示用完了，提示券也没有了——去「便利屋补给池」抽几张💡吧！');
      window.setTimeout(() => setHintNotice(null), 2600);
      return;
    }
    if (source === 'token') {
      setHintNotice('消耗 1 张提示券 💡');
      window.setTimeout(() => setHintNotice(null), 1600);
    }
    const [r1, c1, r2, c2] = hint;
    setHintPair(new Set([`${r1},${c1}`, `${r2},${c2}`]));
    setHintReadyAt(Date.now() + hintCooldown * 1000);
    window.setTimeout(() => setHintPair(null), 2500);
  }, [busy, grid, hintReadyAt, hintCooldown, maxFree, ensurePlayable, consumeMinigameHint]);

  const onPointerDown = (r: number, c: number, e: React.PointerEvent) => {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { r, c, x: e.clientX, y: e.clientY };
    setDragVisual({ r, c, dx: 0, dy: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setDragVisual({ r: drag.current.r, c: drag.current.c, dx, dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    const { r, c } = drag.current;
    drag.current = null;
    setDragVisual(null);

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        attemptSwap(r, c, r, c + (dx > 0 ? 1 : -1));
      } else {
        attemptSwap(r, c, r + (dy > 0 ? 1 : -1), c);
      }
    }
  };

  const newGame = () => {
    setGrid(buildGrid());
    setFlashing(new Set());
    setScore(0);
    setSeconds(0);
    setBusy(false);
    setCombo(0);
    setHintPair(null);
    drag.current = null;
    setDragVisual(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050914]" style={{ userSelect: 'none' }}>
      <PageBackdrop
        image={SCENE_BACKDROPS.store.image}
        mobileImage={SCENE_BACKDROPS.store.mobileImage}
        position={SCENE_BACKDROPS.store.position}
        overlayClassName="from-slate-950/50 via-slate-950/60 to-slate-950/90"
      />
      {/* 便利屋氛围 */}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-[1] flex justify-around text-2xl opacity-[0.07]">
        <span>🏪</span><span>🌙</span><span>🏪</span><span>🌙</span><span>🏪</span>
      </div>

      <div className="relative z-10">
        {/* 顶栏（顶部安全区：避开刘海/状态栏，多平台自适应） */}
        <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/78 backdrop-blur-xl pt-safe">
          <div className="flex items-center gap-3 px-4 pb-3">
            <button
              onClick={onExit}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black tracking-wide text-white">🏪 打烊后的理货时间</h1>
              <p className="text-xs font-medium text-amber-300">三连上架商品，营业额换月光</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white">
              <Timer size={14} className="text-amber-300" />
              {mmss}
            </div>
          </div>
        </div>

        {/* 陪玩搭档条 */}
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 pt-2">
          {companion ? (
            <button
              onClick={() => setShowPicker(true)}
              className="flex flex-1 items-center gap-2 rounded-xl border border-pink-400/30 bg-pink-500/10 px-3 py-1.5 text-left"
            >
              <img src={assetUrl(companion.avatarUrl)} alt={companion.name} className="h-8 w-8 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">{companion.name} 陪你理货中</p>
                <p className="text-[10px] text-pink-300">{passive?.desc}</p>
              </div>
              <span className="text-[10px] text-slate-500">更换</span>
            </button>
          ) : (
            <button
              onClick={() => setShowPicker(true)}
              className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left"
            >
              <UserPlus size={16} className="text-slate-400" />
              <p className="text-xs text-slate-400">
                {ownedCharacters.length > 0 ? '邀一位伙伴陪你理货（有被动加成）' : '还没有伙伴——抽到人物后可邀她一起理货'}
              </p>
            </button>
          )}
        </div>

        {/* 随身信物：江夏「自动连消」 */}
        {autoGift && (
          <div className="mx-auto max-w-md px-4 pt-2">
            {autoEndAt !== null ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/15 px-3 py-2 shadow-[0_0_14px_rgba(251,191,36,0.25)]">
                <img src={assetUrl(autoGift.asset)} alt={autoGift.name} className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-amber-300/60" />
                <p className="flex-1 text-xs font-bold text-amber-200">江夏正帮你飞快理货…</p>
                <span className="rounded bg-amber-400 px-2 py-0.5 text-[11px] font-black text-amber-950 tabular-nums">{autoRemain}s</span>
              </div>
            ) : autoAvailable ? (
              <button
                onClick={startAuto}
                className="flex w-full items-center gap-2.5 rounded-xl border-2 border-amber-300/70 bg-gradient-to-r from-amber-500/20 to-amber-400/5 p-2 text-left shadow-[0_0_14px_rgba(251,191,36,0.25)] transition-all active:scale-[0.99]"
              >
                <img src={assetUrl(autoGift.asset)} alt={autoGift.name} className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-amber-300/60" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-amber-200">动用随身信物 · {autoGift.name}</p>
                  <p className="truncate text-[10px] text-amber-100/80">{autoGift.effect.active}</p>
                </div>
                <span className="shrink-0 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-amber-950">SSR</span>
              </button>
            ) : (
              <p className="text-center text-[10px] text-amber-300/60">随身信物「{autoGift.name}」今日已动用</p>
            )}
          </div>
        )}

        {/* 营业额 + 提示 + 重开 */}
        <div className="mx-auto flex max-w-md items-center justify-between px-4 pt-2 pb-1 text-xs text-slate-300">
          <span>
            🧾 今晚营业额 <b className="text-lg font-black text-amber-300">{score}</b> 🌙
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={showHint}
              disabled={busy || hintCooldownLeft > 0}
              className="flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-1.5 font-bold text-amber-300 hover:bg-amber-500/30 disabled:opacity-40"
            >
              <Lightbulb size={13} />
              {hintCooldownLeft > 0 ? `提示 ${hintCooldownLeft}s` : freeLeft > 0 ? `提示 ${freeLeft}/${maxFree}` : `提示 💡×${hintTokens}`}
            </button>
            <button
              onClick={newGame}
              className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20"
            >
              <RotateCcw size={13} /> 重开
            </button>
          </div>
        </div>

        {/* 货架（棋盘） */}
        <div
          className="mx-auto mt-2 w-fit touch-none"
          style={{ touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="relative" style={{ width: COLS * CELL, height: ROWS * CELL }}>
            {grid.map((row, r) =>
              row.map((tile, c) => {
                const key = `${r},${c}`;
                const isFlashing = flashing.has(key);
                const isHinted = hintPair?.has(key) ?? false;
                const isDragging = dragVisual?.r === r && dragVisual?.c === c;
                const dx = isDragging ? dragVisual!.dx : 0;
                const dy = isDragging ? dragVisual!.dy : 0;
                const style = TILE_STYLES[tile.kind] ?? TILE_STYLES.gem;

                const isDragTarget =
                  dragVisual !== null &&
                  !isDragging &&
                  (() => {
                    const { r: dr, c: dc, dx: ddx, dy: ddy } = dragVisual;
                    if (Math.abs(ddx) >= Math.abs(ddy)) {
                      return r === dr && c === dc + (ddx > 0 ? 1 : -1);
                    } else {
                      return c === dc && r === dr + (ddy > 0 ? 1 : -1);
                    }
                  })();

                return (
                  <div
                    key={tile.id}
                    onPointerDown={(e) => onPointerDown(r, c, e)}
                    style={{
                      position: 'absolute',
                      left: c * CELL + 2,
                      top: r * CELL + 2,
                      width: CELL - 4,
                      height: CELL - 4,
                      zIndex: isDragging ? 50 : 1,
                      transform: isDragging
                        ? `translate(${dx}px,${dy}px) scale(1.12)`
                        : 'translate(0,0) scale(1)',
                      transition: isDragging ? 'none' : 'transform 0.13s ease',
                      cursor: busy ? 'default' : 'grab',
                      touchAction: 'none',
                    }}
                  >
                    <motion.div
                      animate={
                        isFlashing
                          ? { scale: [1, 1.35, 0], opacity: [1, 1, 0] }
                          : isHinted
                            ? { scale: [1, 1.12, 1] }
                            : { scale: 1, opacity: 1 }
                      }
                      transition={
                        isFlashing
                          ? { duration: 0.38, times: [0, 0.45, 1], ease: 'easeOut' }
                          : isHinted
                            ? { duration: 0.6, repeat: Infinity }
                            : { duration: 0.08 }
                      }
                      className={cn(
                        'flex h-full w-full items-center justify-center rounded-xl border-2',
                        style.bg,
                        isFlashing
                          ? 'border-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.9)]'
                          : isHinted
                            ? 'border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.8)]'
                            : isDragging
                              ? 'border-white/80 shadow-[0_8px_24px_rgba(0,0,0,0.5)]'
                              : isDragTarget
                                ? 'border-white/60'
                                : style.border,
                      )}
                    >
                      <span className="pointer-events-none text-2xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]">
                        {style.emoji}
                      </span>
                    </motion.div>
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* 陪玩台词气泡 */}
        <AnimatePresence>
          {companion && companionSay && (
            <motion.div
              key={companionSay}
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              style={{ bottom: 'calc(var(--nav-h, 0px) + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
              className="pointer-events-none fixed left-1/2 z-50 flex w-[88%] max-w-sm -translate-x-1/2 items-start gap-2 rounded-2xl border border-pink-400/40 bg-slate-900/95 px-3 py-2.5 shadow-xl backdrop-blur"
            >
              <img src={assetUrl(companion.avatarUrl)} alt={companion.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
              <div>
                <p className="text-[10px] font-bold text-pink-300">{companion.name}</p>
                <p className="text-xs leading-relaxed text-slate-100">{companionSay}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 消除/连锁/洗牌/提示 提示层 */}
        <AnimatePresence>
          {flashing.size > 0 && (
            <motion.div
              key="flash-label"
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="pointer-events-none fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-amber-500/90 px-6 py-3 text-center shadow-xl backdrop-blur"
            >
              <p className="text-xl font-black text-amber-950">
                {combo >= 2 ? `🔗 连续上架 ×${combo}！` : flashing.size >= 9 ? '🔥 货架爆满！' : flashing.size >= 6 ? '✨ 大补货！' : '🛒 上架成功！'}
              </p>
              <p className="text-sm font-bold text-amber-900">营业额 +{flashing.size * REWARD_PER_TILE * Math.max(1, combo)}🌙{combo >= 2 ? '（连锁加成）' : ''}</p>
            </motion.div>
          )}
          {hintNotice && (
            <motion.div
              key="hint-notice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none fixed inset-x-0 top-[30%] z-50 flex justify-center px-4"
            >
              <div className="max-w-xs rounded-2xl bg-slate-800/95 border border-amber-400/40 px-4 py-3 text-center shadow-xl">
                <p className="text-sm font-bold leading-relaxed text-amber-200 break-words">{hintNotice}</p>
              </div>
            </motion.div>
          )}
          {reshuffled && (
            <motion.div
              key="reshuffle-label"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-sky-500/90 px-6 py-3 text-center shadow-xl"
            >
              <p className="text-base font-black text-sky-950">🔀 货架没法整理了，重新摆一遍</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 陪玩选择弹窗 */}
        <AnimatePresence>
          {showPicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-5 backdrop-blur-sm"
              onClick={() => setShowPicker(false)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 16, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-4 shadow-2xl"
              >
                <p className="mb-3 text-center text-sm font-black text-white">邀谁一起理货？</p>
                {ownedCharacters.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500">还没有伙伴——去「便利屋补给池」抽到人物后再来邀她吧。</p>
                ) : (
                  <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
                    {ownedCharacters.map((o) => {
                      const c = getCharacterById(o.characterId);
                      if (!c) return null;
                      const p = PASSIVES[c.serviceType as ServiceTag] ?? PASSIVES.万能;
                      const active = minigameCompanion === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => { setMinigameCompanion(c.id); setShowPicker(false); }}
                          className={cn(
                            'rounded-xl border p-2.5 text-left',
                            active ? 'border-pink-400/70 bg-pink-500/15' : 'border-white/10 bg-white/5 hover:border-white/25',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <img src={assetUrl(c.avatarUrl)} alt={c.name} className="h-8 w-8 rounded-full object-cover" />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-white">{c.name}</p>
                              <p className="text-[9px] text-slate-400">{c.serviceType}</p>
                            </div>
                          </div>
                          <p className="mt-1.5 text-[10px] leading-snug text-pink-300">{p.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
                {minigameCompanion && (
                  <button
                    onClick={() => { setMinigameCompanion(null); setShowPicker(false); }}
                    className="mt-3 w-full rounded-xl bg-slate-800 py-2 text-xs font-bold text-slate-400"
                  >
                    今晚自己理
                  </button>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
