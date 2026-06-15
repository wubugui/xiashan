import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Boxes,
  CreditCard,
  Gem,
  Heart,
  PackagePlus,
  RotateCcw,
  Ticket,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { characters } from '@/data/characters';
import { commissions } from '@/data/commissions';
import { allServiceCards } from '@/data/serviceCards';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useShopStore } from '@/store/useShopStore';
import { TUTORIAL_TOTAL } from '@/lib/tutorialFlow';
import { cn } from '@/lib/utils';
import GachaAnimation from '@/components/GachaAnimation';

const MAX_DEV_STONES = 999_999_999;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/45 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Wrench;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={15} className="text-amber-200" />
        <h3 className="text-sm font-black text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function DevButton({
  children,
  onClick,
  tone = 'default',
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'good' | 'bad' | 'warn';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'min-h-9 rounded-md border px-3 py-2 text-xs font-black transition',
        'disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'default' && 'border-white/12 bg-slate-900/86 text-slate-100 hover:border-white/24 hover:bg-slate-800',
        tone === 'good' && 'border-emerald-300/30 bg-emerald-500/16 text-emerald-100 hover:bg-emerald-500/24',
        tone === 'bad' && 'border-rose-300/30 bg-rose-500/16 text-rose-100 hover:bg-rose-500/24',
        tone === 'warn' && 'border-amber-300/30 bg-amber-500/16 text-amber-100 hover:bg-amber-500/24',
      )}
    >
      {children}
    </button>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-white/10 bg-slate-950/80 px-2 text-xs font-bold text-white outline-none focus:border-amber-200/60"
    >
      {children}
    </select>
  );
}

export default function DevPanel() {
  const [open, setOpen] = useState(false);
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? '');
  const [cardId, setCardId] = useState(allServiceCards[0]?.id ?? '');
  const [devGachaResults, setDevGachaResults] = useState<
    { characterId: string; name: string; rarity: 'N' | 'R' | 'SR' | 'SSR'; title: string; isNew: boolean }[]
  >([]);

  const tutorialStep = usePlayerStore((s) => s.tutorialStep);
  const spiritStones = usePlayerStore((s) => s.spiritStones);
  const normalTickets = usePlayerStore((s) => s.normalTickets);
  const hintTokens = usePlayerStore((s) => s.hintTokens);
  const reputation = usePlayerStore((s) => s.reputation);
  const bondShards = usePlayerStore((s) => s.bondShards);
  const supplyPityCounter = usePlayerStore((s) => s.supplyPityCounter);
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const relationshipStages = usePlayerStore((s) => s.relationshipStages);
  const dupeCount = usePlayerStore((s) => s.dupeCount);
  const hand = useShopStore((s) => s.hand);
  const fatigue = useShopStore((s) => s.fatigue);
  const money = useShopStore((s) => s.money);
  const trust = useShopStore((s) => s.trust);
  const shopRep = useShopStore((s) => s.rep);
  const gameOver = useShopStore((s) => s.gameOver);

  const setTutorialStep = usePlayerStore((s) => s.setTutorialStep);
  const addCharacter = usePlayerStore((s) => s.addCharacter);
  const addGachaResult = usePlayerStore((s) => s.addGachaResult);
  const addAffinity = usePlayerStore((s) => s.addAffinity);
  const advanceRelationshipStage = usePlayerStore((s) => s.advanceRelationshipStage);
  const setSupplyPityCounter = usePlayerStore((s) => s.setSupplyPityCounter);
  const resetGame = usePlayerStore((s) => s.resetGame);
  const addHandCard = useShopStore((s) => s.addHandCard);
  const startDay = useShopStore((s) => s.startDay);
  const startTutorialDay = useShopStore((s) => s.startTutorialDay);
  const resetDay = useShopStore((s) => s.resetDay);

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === characterId) ?? characters[0],
    [characterId],
  );
  const selectedCard = useMemo(
    () => allServiceCards.find((card) => card.id === cardId) ?? allServiceCards[0],
    [cardId],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        if (!event.repeat) setOpen((current) => !current);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const changeStones = useCallback((amount: number) => {
    usePlayerStore.setState((state) => ({
      spiritStones: Math.max(0, state.spiritStones + amount),
    }));
  }, []);

  const changeNormalTickets = useCallback((amount: number) => {
    usePlayerStore.setState((state) => ({
      normalTickets: Math.max(0, state.normalTickets + amount),
    }));
  }, []);

  const changeHintTokens = useCallback((amount: number) => {
    usePlayerStore.setState((state) => ({
      hintTokens: Math.max(0, state.hintTokens + amount),
    }));
  }, []);

  const changeReputation = useCallback((amount: number) => {
    usePlayerStore.setState((state) => ({
      reputation: Math.max(0, state.reputation + amount),
    }));
  }, []);

  const changeBondShards = useCallback((amount: number) => {
    usePlayerStore.setState((state) => ({
      bondShards: Math.max(0, state.bondShards + amount),
    }));
  }, []);

  const grantCharacter = useCallback((id: string) => {
    const character = characters.find((item) => item.id === id);
    if (!character) return;
    addCharacter(character.id);
    addGachaResult(character.id, character.rarity);
  }, [addCharacter, addGachaResult]);

  const pullSelectedCharacter = useCallback(() => {
    if (!selectedCharacter) return;
    const isNew = !ownedCharacters.some((character) => character.characterId === selectedCharacter.id);
    addCharacter(selectedCharacter.id);
    addGachaResult(selectedCharacter.id, selectedCharacter.rarity);
    setOpen(false);
    setDevGachaResults([{
      characterId: selectedCharacter.id,
      name: selectedCharacter.name,
      rarity: selectedCharacter.rarity,
      title: selectedCharacter.title,
      isNew,
    }]);
  }, [addCharacter, addGachaResult, ownedCharacters, selectedCharacter]);

  const grantAllCharacters = useCallback(() => {
    characters.forEach((character) => {
      addCharacter(character.id);
      addGachaResult(character.id, character.rarity);
    });
  }, [addCharacter, addGachaResult]);

  const maxSelectedCharacter = useCallback(() => {
    if (!selectedCharacter) return;
    usePlayerStore.setState((state) => ({
      affinityMap: { ...state.affinityMap, [selectedCharacter.id]: 100 },
      relationshipStages: { ...state.relationshipStages, [selectedCharacter.id]: 5 },
      dupeCount: { ...state.dupeCount, [selectedCharacter.id]: Math.max(5, state.dupeCount[selectedCharacter.id] ?? 0) },
    }));
    grantCharacter(selectedCharacter.id);
  }, [grantCharacter, selectedCharacter]);

  const grantSelectedCard = useCallback(() => {
    if (selectedCard) addHandCard(selectedCard);
  }, [addHandCard, selectedCard]);

  const unlockAllContent = useCallback(() => {
    const doneFlags = commissions.map((commission) => `commission_${commission.id}_done`);
    usePlayerStore.setState((state) => ({
      flags: Array.from(new Set([...state.flags, ...doneFlags])),
      ownedCharacters: characters.map((character) => {
        const existing = state.ownedCharacters.find((owned) => owned.characterId === character.id);
        return existing ?? { characterId: character.id, level: 1, exp: 0 };
      }),
      relationshipStages: characters.reduce<Record<string, number>>(
        (acc, character) => ({ ...acc, [character.id]: 5 }),
        { ...state.relationshipStages },
      ),
      affinityMap: characters.reduce<Record<string, number>>(
        (acc, character) => ({ ...acc, [character.id]: Math.max(acc[character.id] ?? 0, 100) }),
        { ...state.affinityMap },
      ),
      dupeCount: characters.reduce<Record<string, number>>(
        (acc, character) => ({ ...acc, [character.id]: Math.max(acc[character.id] ?? 0, 5) }),
        { ...state.dupeCount },
      ),
    }));
  }, []);

  if (!import.meta.env.DEV) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-[9998] rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-[10px] font-black text-slate-300/85 shadow-lg backdrop-blur transition hover:border-amber-200/45 hover:text-amber-100 active:scale-95"
        aria-label="打开开发者 GM 面板"
      >
        F2 GM
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[10000] flex justify-end bg-black/35 p-3 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <aside
            className="flex h-full w-full max-w-[28rem] flex-col overflow-hidden rounded-xl border border-white/12 bg-slate-950/96 shadow-[0_24px_80px_rgba(0,0,0,0.52)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Developer</p>
                <h2 className="text-lg font-black text-white">GM 面板</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-white/8 text-white/80 hover:bg-white/14 hover:text-white"
                aria-label="关闭开发者面板"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="月光" value={spiritStones.toLocaleString()} />
                <Stat label="普通券" value={normalTickets} />
                <Stat label="手牌" value={hand.length} />
                <Stat label="教程" value={tutorialStep === -1 ? '关闭' : tutorialStep} />
              </div>

              <Section title="资源" icon={Gem}>
                <div className="grid grid-cols-3 gap-2">
                  <DevButton onClick={() => changeStones(1_000)} tone="good">月光 +1k</DevButton>
                  <DevButton onClick={() => changeStones(100_000)} tone="good">月光 +10w</DevButton>
                  <DevButton onClick={() => usePlayerStore.setState({ spiritStones: MAX_DEV_STONES })} tone="warn">拉满</DevButton>
                  <DevButton onClick={() => changeStones(-1_000)} tone="bad">月光 -1k</DevButton>
                  <DevButton onClick={() => changeNormalTickets(10)}><Ticket size={13} className="mr-1 inline" />券 +10</DevButton>
                  <DevButton onClick={() => changeHintTokens(10)}>提示券 +10</DevButton>
                  <DevButton onClick={() => changeReputation(10)}>声望 +10</DevButton>
                  <DevButton onClick={() => changeBondShards(50)}>碎片 +50</DevButton>
                  <DevButton onClick={() => {
                    usePlayerStore.setState({ spiritStones: 0, normalTickets: 0, hintTokens: 0 });
                  }} tone="bad">清资源</DevButton>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Stat label="提示券" value={hintTokens} />
                  <Stat label="声望" value={reputation} />
                  <Stat label="缘分碎片" value={bondShards} />
                </div>
              </Section>

              <Section title="教程" icon={BookOpen}>
                <div className="grid grid-cols-3 gap-2">
                  <DevButton onClick={() => setTutorialStep(-1)} tone={tutorialStep === -1 ? 'good' : 'default'}>关闭教程</DevButton>
                  <DevButton onClick={() => setTutorialStep(0)} tone="warn">重开入口</DevButton>
                  <DevButton onClick={() => {
                    setTutorialStep(1);
                    startTutorialDay();
                  }} tone="warn">开始第 1 步</DevButton>
                  <DevButton onClick={() => setTutorialStep(Math.max(-1, tutorialStep - 1))}>上一步</DevButton>
                  <DevButton onClick={() => setTutorialStep(Math.min(TUTORIAL_TOTAL, Math.max(0, tutorialStep + 1)))}>下一步</DevButton>
                  <DevButton onClick={() => setTutorialStep(TUTORIAL_TOTAL)}>终幕</DevButton>
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-400">
                  当前: {tutorialStep === -1 ? '已关闭' : `${tutorialStep}/${TUTORIAL_TOTAL}`}。手动开关会随存档持久化，刷新后保持不变。
                </p>
              </Section>

              <Section title="角色 / 关系" icon={Users}>
                <Select value={characterId} onChange={setCharacterId}>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name} · {character.rarity} · {character.title}
                    </option>
                  ))}
                </Select>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <DevButton onClick={() => selectedCharacter && grantCharacter(selectedCharacter.id)} tone="good">获得角色</DevButton>
                  <DevButton onClick={pullSelectedCharacter} tone="warn">指定出卡</DevButton>
                  <DevButton onClick={() => selectedCharacter && addAffinity(selectedCharacter.id, 10)}><Heart size={13} className="mr-1 inline" />好感 +10</DevButton>
                  <DevButton onClick={() => selectedCharacter && advanceRelationshipStage(selectedCharacter.id)}>阶段 +1</DevButton>
                  <DevButton onClick={maxSelectedCharacter} tone="warn">选中拉满</DevButton>
                  <DevButton onClick={grantAllCharacters} tone="good">全角色</DevButton>
                  <DevButton onClick={unlockAllContent} tone="warn">全解锁</DevButton>
                </div>
                {selectedCharacter && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Stat label="好感" value={affinityMap[selectedCharacter.id] ?? 0} />
                    <Stat label="阶段" value={relationshipStages[selectedCharacter.id] ?? 0} />
                    <Stat label="信物" value={dupeCount[selectedCharacter.id] ?? 0} />
                  </div>
                )}
              </Section>

              <Section title="获得卡牌" icon={CreditCard}>
                <Select value={cardId} onChange={setCardId}>
                  {allServiceCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name} · {card.kind} · {card.type} · {card.rarity}
                    </option>
                  ))}
                </Select>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <DevButton onClick={grantSelectedCard} tone="good"><PackagePlus size={13} className="mr-1 inline" />加 1 张</DevButton>
                  <DevButton onClick={() => allServiceCards.filter((card) => card.rarity === 'SR').forEach(addHandCard)} tone="warn">全 SR</DevButton>
                  <DevButton onClick={() => allServiceCards.forEach(addHandCard)}>全卡各 1</DevButton>
                  <DevButton onClick={() => useShopStore.setState({ hand: [] })} tone="bad">清空手牌</DevButton>
                </div>
              </Section>

              <Section title="抽卡 / 局内" icon={Boxes}>
                <div className="grid grid-cols-3 gap-2">
                  <DevButton onClick={() => setSupplyPityCounter(14)} tone="warn">下抽保底人物</DevButton>
                  <DevButton onClick={() => setSupplyPityCounter(0)}>补给保底清零</DevButton>
                  <DevButton onClick={() => usePlayerStore.setState({ pityCounter: 59 })}>旧池 SSR 保底</DevButton>
                  <DevButton onClick={startDay} tone="good">开新一天</DevButton>
                  <DevButton onClick={resetDay}>重置当天</DevButton>
                  <DevButton onClick={() => useShopStore.setState({ gameOver: false })}>取消打烊</DevButton>
                  <DevButton onClick={() => useShopStore.setState({ fatigue: 0, money: 999, trust: 99, rep: 99, gameOver: false })} tone="warn">局内拉满</DevButton>
                  <DevButton onClick={() => usePlayerStore.setState({ dailyActions: {}, freeHints: { date: '', used: 0 } })}>清每日限制</DevButton>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  <Stat label="疲劳" value={fatigue} />
                  <Stat label="资金" value={money} />
                  <Stat label="信任" value={trust} />
                  <Stat label="口碑" value={shopRep} />
                  <Stat label="保底" value={supplyPityCounter} />
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-400">
                  今日状态: {gameOver ? '已打烊' : '营业中'}；已拥有角色 {ownedCharacters.length}/{characters.length}
                </p>
              </Section>

              <Section title="危险操作" icon={RotateCcw}>
                <div className="grid grid-cols-2 gap-2">
                  <DevButton
                    tone="bad"
                    onClick={() => {
                      if (!window.confirm('确认重置玩家存档？这个操作会清空角色、资源、剧情进度。')) return;
                      resetGame();
                    }}
                  >
                    重置玩家存档
                  </DevButton>
                  <DevButton
                    tone="bad"
                    onClick={() => {
                      if (!window.confirm('确认清空便利屋当天局内状态？')) return;
                      useShopStore.setState({
                        fatigue: 0,
                        rep: 5,
                        money: 20,
                        trust: 0,
                        commission: null,
                        isRevisit: false,
                        loc: null,
                        routes: [],
                        board: [],
                        objectivesDone: [],
                        sideJobs: [],
                        pendingScene: null,
                        done: {},
                        hand: [],
                        log: [],
                        gameOver: false,
                        lastCardType: null,
                        intel: [],
                        offTask: 0,
                      });
                    }}
                  >
                    清空局内状态
                  </DevButton>
                </div>
              </Section>
            </div>
          </aside>
        </div>
      )}

      {devGachaResults.length > 0 && (
        <GachaAnimation
          results={devGachaResults}
          isTenPull={false}
          onComplete={() => setDevGachaResults([])}
        />
      )}
    </>
  );
}
