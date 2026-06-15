import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, RotateCcw, Undo2, UserPlus,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import type { ServiceTag } from '@/data/types';
import { cn } from '@/lib/utils';
import { playSound } from '@/lib/sound';
import { assetUrl } from '@/lib/assets';
import PageBackdrop from '@/components/PageBackdrop';
import { SCENE_BACKDROPS } from '@/lib/pageBackdrops';

/**
 * 深夜库房·搬货入位 — 便利屋后场的推箱小游戏。
 * 把📦货箱推到🅿库位，全部归位即收工领月光（夜班工钱）。
 * 与主游戏共用陪玩系统：可邀一位已入伙的女主搭把手——她按服务类型给被动
 * （多撤步 / 工钱加成），通关时有台词反应，每日首次搭货 +2 好感；她在场时就是
 * 她陪你一起推那只箱子。地图字符：# 货架 / @ 你 / $ 货箱 / . 库位 / * 已归位 / + 你站在库位上。
 */

interface Stage { name: string; map: string[] }
const STAGES: Stage[] = [
  { name: '收银台后的过道', map: ['#####', '#@$.#', '#####'] },
  { name: '今晚到货', map: ['#######', '#.$@$.#', '#######'] },
  { name: '冷藏库角落', map: ['######', '#@   #', '# $$ #', '# .. #', '#    #', '######'] },
  { name: '仓库深处', map: ['#######', '# ... #', '# $$$ #', '#  @  #', '#######'] },
];

const BASE_UNDO = 3; // 每关基础撤步次数

/** 陪玩被动：按服务类型给「撤步加成 / 工钱加成」 */
const PASSIVES: Record<string, { undo: number; payMult: number; desc: string }> = {
  补给: { undo: 0, payMult: 1.15, desc: '夜班补贴 · 工钱 +15%' },
  安抚: { undo: 3, payMult: 1.0, desc: '推错别慌 · 多 3 次撤步' },
  表达: { undo: 1, payMult: 1.1, desc: '边干边聊 · 撤步 +1、工钱 +10%' },
  情报: { undo: 2, payMult: 1.0, desc: '她记得路 · 多 2 次撤步' },
  观察: { undo: 2, payMult: 1.0, desc: '眼神好使 · 多 2 次撤步' },
  流程: { undo: 2, payMult: 1.0, desc: '流程熟练 · 多 2 次撤步' },
  技术: { undo: 1, payMult: 1.1, desc: '搬得稳当 · 撤步 +1、工钱 +10%' },
  维修: { undo: 1, payMult: 1.1, desc: '会使巧劲 · 撤步 +1、工钱 +10%' },
  路线: { undo: 2, payMult: 1.0, desc: '路线清楚 · 多 2 次撤步' },
  恢复: { undo: 3, payMult: 1.0, desc: '替你兜底 · 多 3 次撤步' },
  宠物: { undo: 1, payMult: 1.1, desc: '有它陪着 · 撤步 +1、工钱 +10%' },
  万能: { undo: 1, payMult: 1.15, desc: '样样都行 · 撤步 +1、工钱 +15%' },
};

type Pt = { r: number; c: number };
const key = (r: number, c: number) => `${r},${c}`;

interface Snap { boxes: Set<string>; player: Pt }
interface Board { walls: Set<string>; targets: Set<string>; rows: number; cols: number }

function parse(map: string[]): { board: Board; snap: Snap } {
  const walls = new Set<string>(), targets = new Set<string>(), boxes = new Set<string>();
  let player: Pt = { r: 0, c: 0 };
  map.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      const k = key(r, c);
      if (ch === '#') walls.add(k);
      else if (ch === '.') targets.add(k);
      else if (ch === '$') boxes.add(k);
      else if (ch === '*') { targets.add(k); boxes.add(k); }
      else if (ch === '+') { targets.add(k); player = { r, c }; }
      else if (ch === '@') player = { r, c };
    });
  });
  const cols = Math.max(...map.map((l) => l.length));
  return { board: { walls, targets, rows: map.length, cols }, snap: { boxes, player } };
}

export default function SokobanGame({ onExit }: { onExit: () => void }) {
  const addSpiritStones = usePlayerStore((s) => s.addSpiritStones);
  const tryDailyAction = usePlayerStore((s) => s.tryDailyAction);
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const minigameCompanion = usePlayerStore((s) => s.minigameCompanion);
  const setMinigameCompanion = usePlayerStore((s) => s.setMinigameCompanion);
  const addAffinity = usePlayerStore((s) => s.addAffinity);

  /* ── 陪玩搭档（与理货小游戏共用 minigameCompanion）── */
  const companionOwned = ownedCharacters.find((o) => o.characterId === minigameCompanion);
  const companion = companionOwned ? getCharacterById(companionOwned.characterId) : undefined;
  const passive = companion ? PASSIVES[companion.serviceType as ServiceTag] ?? PASSIVES.万能 : null;
  const maxUndo = BASE_UNDO + (passive?.undo ?? 0);

  const companionLines = useMemo(() => {
    if (!companion) return [];
    const lvl = companionOwned?.level ?? 1;
    const dialogues = companion.dialogues.filter((d) => d.level <= lvl).map((d) => d.text);
    const phrases = companion.phonePersonality?.commonPhrases ?? [];
    return [...dialogues, ...phrases];
  }, [companion, companionOwned]);

  const [idx, setIdx] = useState(0);
  const [board, setBoard] = useState<Board>(() => parse(STAGES[0].map).board);
  const [snap, setSnap] = useState<Snap>(() => parse(STAGES[0].map).snap);
  const [history, setHistory] = useState<Snap[]>([]);
  const [undoLeft, setUndoLeft] = useState(maxUndo);
  const [steps, setSteps] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [companionSay, setCompanionSay] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const say = useCallback(() => {
    if (companionLines.length === 0) return;
    setCompanionSay(companionLines[Math.floor(Math.random() * companionLines.length)]);
    window.setTimeout(() => setCompanionSay(null), 2600);
  }, [companionLines]);

  const load = useCallback((i: number) => {
    const { board: b, snap: s } = parse(STAGES[i].map);
    setIdx(i); setBoard(b); setSnap(s);
    setHistory([]); setUndoLeft(maxUndo); setSteps(0);
    setCleared(false); setNotice(null);
  }, [maxUndo]);

  /** 每日首次搭货 +2 好感 */
  useEffect(() => {
    if (!companion) return;
    if (tryDailyAction(`minigame:${companion.id}`)) {
      addAffinity(companion.id, 2);
      setNotice(`${companion.name}来后场搭把手，好感 +2 💕`);
      window.setTimeout(() => setNotice(null), 2400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companion?.id]);

  const move = useCallback((dr: number, dc: number) => {
    if (cleared) return;
    setSnap((prev) => {
      const { r, c } = prev.player;
      const nr = r + dr, nc = c + dc;
      if (board.walls.has(key(nr, nc))) return prev;
      const boxes = new Set(prev.boxes);
      let pushed = false;
      if (boxes.has(key(nr, nc))) {
        const br = nr + dr, bc = nc + dc;
        if (board.walls.has(key(br, bc)) || boxes.has(key(br, bc))) return prev; // 推不动
        boxes.delete(key(nr, nc));
        boxes.add(key(br, bc));
        pushed = true;
      }
      setHistory((h) => [...h, prev]);
      setSteps((s) => s + 1);
      playSound(pushed ? 'btn-confirm' : 'touchend');

      const next: Snap = { boxes, player: { r: nr, c: nc } };
      const win = [...board.targets].every((t) => next.boxes.has(t));
      if (win) {
        setCleared(true);
        playSound('stage-up');
        confetti({ particleCount: 110, spread: 64, origin: { y: 0.6 } });
        const last = idx === STAGES.length - 1;
        const mult = passive?.payMult ?? 1;
        const baseDaily = [20, 30, 45, 60][idx] ?? 30;
        const fresh = tryDailyAction(`sokoban_lv:${idx}`);
        const base = fresh ? Math.round(baseDaily * mult) : 5;
        const bonus = last && tryDailyAction('sokoban_all') ? 80 : 0;
        addSpiritStones(base + bonus);
        if (companion) say();
        if (last) {
          setAllDone(true);
          setNotice(`后场全部归位，收工！夜班工钱 +${base + bonus} 🌙`);
        } else {
          setNotice(`「${STAGES[idx].name}」清完了 · 工钱 +${base}${bonus ? ` +${bonus}` : ''} 🌙`);
        }
      }
      return next;
    });
  }, [cleared, board, idx, passive, companion, say, addSpiritStones, tryDailyAction]);

  const undo = useCallback(() => {
    if (cleared || undoLeft <= 0) return;
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setSnap(prev);
      setUndoLeft((u) => u - 1);
      setSteps((s) => Math.max(0, s - 1));
      playSound('tab-switch');
      return h.slice(0, -1);
    });
  }, [cleared, undoLeft]);

  // 键盘：方向键移动，Z/Backspace 撤步
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m: Record<string, [number, number]> = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
      };
      if (m[e.key]) { e.preventDefault(); move(...m[e.key]); }
      else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, undo]);

  const cellKind = (r: number, c: number) => {
    const k = key(r, c);
    if (board.walls.has(k)) return 'wall';
    const isTarget = board.targets.has(k), isBox = snap.boxes.has(k);
    const isPlayer = snap.player.r === r && snap.player.c === c;
    if (isBox) return isTarget ? 'box-ok' : 'box';
    if (isPlayer) return isTarget ? 'player-on' : 'player';
    if (isTarget) return 'target';
    return 'floor';
  };

  const placed = [...board.targets].filter((t) => snap.boxes.has(t)).length;
  const avatarSrc = companion ? assetUrl(companion.avatarUrl) : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050914] pb-nav" style={{ userSelect: 'none' }}>
      <PageBackdrop
        image={SCENE_BACKDROPS.store.image}
        mobileImage={SCENE_BACKDROPS.store.mobileImage}
        position={SCENE_BACKDROPS.store.position}
        overlayClassName="from-slate-950/55 via-slate-950/72 to-slate-950/92"
      />
      <div className="pointer-events-none absolute inset-x-0 top-14 z-[1] flex justify-around text-2xl opacity-[0.06]">
        <span>📦</span><span>🏪</span><span>📦</span><span>🌙</span><span>📦</span>
      </div>

      <div className="relative z-10">
        {/* 顶栏 */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-slate-950/78 px-4 py-3 backdrop-blur-xl">
          <button onClick={onExit} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20" aria-label="返回">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black tracking-wide text-white">📦 深夜库房·搬货入位</h1>
            <p className="truncate text-xs font-medium text-sky-300">「{STAGES[idx].name}」· 第 {idx + 1}/{STAGES.length} 区</p>
          </div>
          <button onClick={() => load(idx)} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/20">
            <RotateCcw size={13} /> 重来
          </button>
        </div>

        {/* 陪玩搭档条 */}
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 pt-2">
          {companion ? (
            <button onClick={() => setShowPicker(true)} className="flex flex-1 items-center gap-2 rounded-xl border border-pink-400/30 bg-pink-500/10 px-3 py-1.5 text-left">
              <img src={assetUrl(companion.avatarUrl)} alt={companion.name} className="h-8 w-8 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">{companion.name} 陪你搬货中</p>
                <p className="text-[10px] text-pink-300">{passive?.desc}</p>
              </div>
              <span className="text-[10px] text-slate-500">更换</span>
            </button>
          ) : (
            <button onClick={() => setShowPicker(true)} className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left">
              <UserPlus size={16} className="text-slate-400" />
              <p className="text-xs text-slate-400">
                {ownedCharacters.length > 0 ? '叫一位伙伴来后场搭把手（有被动加成）' : '还没有伙伴——抽到人物后可叫她来帮忙搬货'}
              </p>
            </button>
          )}
        </div>

        {/* 进度 + 撤步 */}
        <div className="mx-auto flex max-w-md items-center justify-between px-4 pt-2 text-xs text-slate-300">
          <span>📦 已归位 <b className="text-base font-black text-sky-300">{placed}/{board.targets.size}</b> · 步数 {steps}</span>
          <button
            onClick={undo}
            disabled={cleared || undoLeft <= 0 || history.length === 0}
            className="flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 font-bold text-sky-300 hover:bg-sky-500/30 disabled:opacity-40"
          >
            <Undo2 size={13} /> 撤步 {undoLeft}
          </button>
        </div>

        {/* 棋盘 */}
        <div className="mx-auto mt-3 max-w-md px-4">
          <div className="mx-auto w-fit rounded-2xl border border-white/10 bg-slate-900/70 p-2">
            {Array.from({ length: board.rows }).map((_, r) => (
              <div key={r} className="flex">
                {Array.from({ length: board.cols }).map((_, c) => {
                  const t = cellKind(r, c);
                  return (
                    <div
                      key={c}
                      className={cn(
                        'relative flex h-11 w-11 items-center justify-center text-2xl',
                        t === 'wall'
                          ? 'rounded-[4px] border border-slate-600/60 bg-gradient-to-br from-slate-600/80 to-slate-800/80'
                          : 'rounded-[4px] bg-slate-800/30',
                        (t === 'target' || t === 'player-on' || t === 'box-ok') && 'ring-1 ring-sky-400/50',
                      )}
                    >
                      {/* 库位底标 */}
                      {(t === 'target') && <span className="text-base opacity-70">🅿</span>}
                      {t === 'box' && <span>📦</span>}
                      {t === 'box-ok' && <span className="drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]">✅</span>}
                      {(t === 'player' || t === 'player-on') && (
                        avatarSrc
                          ? <img src={avatarSrc} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-pink-300/70" />
                          : <span>🧑</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 方向键 */}
        <div className="mx-auto mt-5 w-fit">
          <div className="flex justify-center">
            <Dpad icon={ArrowUp} onClick={() => move(-1, 0)} />
          </div>
          <div className="flex justify-center gap-2">
            <Dpad icon={ArrowLeft} onClick={() => move(0, -1)} />
            <Dpad icon={ArrowDown} onClick={() => move(1, 0)} />
            <Dpad icon={ArrowRight} onClick={() => move(0, 1)} />
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-white/45">手机点方向键，电脑可用 ↑↓←→，Z 撤步</p>
      </div>

      {/* 搭档台词气泡 */}
      <AnimatePresence>
        {companion && companionSay && (
          <motion.div
            key={companionSay}
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            className="pointer-events-none fixed left-1/2 z-[110] flex w-[88%] max-w-sm -translate-x-1/2 items-start gap-2 rounded-2xl border border-pink-400/40 bg-slate-900/95 px-3 py-2.5 shadow-xl backdrop-blur"
            style={{ bottom: 'calc(var(--nav-h, 0px) + 92px)' }}
          >
            <img src={assetUrl(companion.avatarUrl)} alt={companion.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
            <div>
              <p className="text-[10px] font-bold text-pink-300">{companion.name}</p>
              <p className="text-xs leading-relaxed text-slate-100">{companionSay}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 通关 / 提示 */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-x-0 z-[120] flex justify-center px-4" style={{ bottom: 'calc(var(--nav-h, 0px) + 24px)' }}
          >
            <div className="flex items-center gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 shadow-xl ring-1 ring-sky-400/30">
              <span className="text-sm font-bold text-sky-100">{notice}</span>
              {cleared && (allDone ? (
                <button onClick={() => load(0)} className="shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-black text-white">从头再来</button>
              ) : (
                <button onClick={() => load(idx + 1)} className="shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-black text-white">下一区 →</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 搭档选择弹窗 */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 px-5 backdrop-blur-sm"
            onClick={() => setShowPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-4 shadow-2xl"
            >
              <p className="mb-3 text-center text-sm font-black text-white">叫谁来后场搭把手？</p>
              {ownedCharacters.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">还没有伙伴——去「便利屋补给池」抽到人物后再来叫她吧。</p>
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
                        onClick={() => { setMinigameCompanion(c.id); setUndoLeft(BASE_UNDO + p.undo); setShowPicker(false); }}
                        className={cn('rounded-xl border p-2.5 text-left', active ? 'border-pink-400/70 bg-pink-500/15' : 'border-white/10 bg-white/5 hover:border-white/25')}
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
                  onClick={() => { setMinigameCompanion(null); setUndoLeft(BASE_UNDO); setShowPicker(false); }}
                  className="mt-3 w-full rounded-xl bg-slate-800 py-2 text-xs font-bold text-slate-400"
                >
                  今晚自己搬
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Dpad({ icon: Icon, onClick }: { icon: typeof ArrowUp; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="m-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white/85 ring-1 ring-white/15 transition-all active:scale-90 active:bg-white/20"
    >
      <Icon size={24} />
    </button>
  );
}
