import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, TrendingUp, Heart } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { getRelationshipStages, getStageInfo, getNextStage } from '@/data/relationship';
import { dupesNeededForStage } from '@/engine/bondEngine';
import { expForLevel } from '@/engine/shopEngine';
import { getRomanceArc, type RomanceBeat, type RomanceChoiceOption } from '@/data/romanceArcs';
import { beatStatus } from '@/engine/romanceEngine';
import { getCollectibles, type Collectible } from '@/data/collectibles';
import { resolveAvatarFallout } from '@/engine/avatarFallout';
import { passedOverReactions } from '@/engine/passedOver';
import { evaluateAll } from '@/engine/conditionEngine';
import RomanceScene from '@/components/RomanceScene';
import StoryViewer from '@/components/StoryViewer';
import { cn } from '@/lib/utils';
import { playSound } from '@/lib/sound';
import { assetUrl } from '@/lib/assets';
import PageBackdrop from '@/components/PageBackdrop';
import { backdropForCharacter } from '@/lib/pageBackdrops';

type TabType = 'info' | 'upgrade' | 'romance' | 'collect';

const rarityGradient = {
  N: 'from-slate-600 to-slate-800',
  R: 'from-blue-600 to-blue-900',
  SR: 'from-purple-600 to-purple-900',
  SSR: 'from-amber-500 via-yellow-600 to-amber-700',
};

const rarityBadge = {
  N: 'bg-slate-500/80 text-slate-100',
  R: 'bg-blue-500/80 text-blue-100',
  SR: 'bg-purple-500/80 text-purple-100',
  SSR: 'bg-amber-500/90 text-amber-950',
};

const rarityLabel = {
  N: 'text-slate-400',
  R: 'text-blue-400',
  SR: 'text-purple-400',
  SSR: 'text-amber-400',
};

const UPGRADE_COST = 100;

export default function CharacterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const relationshipStages = usePlayerStore((s) => s.relationshipStages);
  const spiritStones = usePlayerStore((s) => s.spiritStones);
  const addSpiritStones = usePlayerStore((s) => s.addSpiritStones);
  const addExp = usePlayerStore((s) => s.addExp);
  const addAffinity = usePlayerStore((s) => s.addAffinity);
  const advanceRelationshipStage = usePlayerStore((s) => s.advanceRelationshipStage);
  const tryDailyAction = usePlayerStore((s) => s.tryDailyAction);
  const dupeCount = usePlayerStore((s) => s.dupeCount);
  // 心动系统
  const reputation = usePlayerStore((s) => s.reputation);
  const completedNodes = usePlayerStore((s) => s.completedNodes);
  const flags = usePlayerStore((s) => s.flags);
  const romanceProgress = usePlayerStore((s) => s.romanceProgress);
  const xinyiTarget = usePlayerStore((s) => s.xinyiTarget);
  const advanceRomance = usePlayerStore((s) => s.advanceRomance);
  const addMomo = usePlayerStore((s) => s.addMomo);
  const displayPortrait = usePlayerStore((s) => s.displayPortrait);
  const setDisplayPortrait = usePlayerStore((s) => s.setDisplayPortrait);
  const displayAvatar = usePlayerStore((s) => s.displayAvatar);
  const setDisplayAvatar = usePlayerStore((s) => s.setDisplayAvatar);
  const setPlayerAvatar = usePlayerStore((s) => s.setPlayerAvatar);
  const setFlag = usePlayerStore((s) => s.setFlag);
  const addPhoneMessage = usePlayerStore((s) => s.addPhoneMessage);

  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [interactionResponse, setInteractionResponse] = useState<string | null>(null);
  // 正在演的节点；replay=true 时是「重温」已解锁的故事，不重复结算奖励
  const [playingBeat, setPlayingBeat] = useState<{ beat: RomanceBeat; replay: boolean } | null>(null);
  // 收藏里正在回看的 CG 短篇
  const [openCg, setOpenCg] = useState<{ title: string; image?: string; paragraphs: string[] } | null>(null);
  // 收藏里点开的操作面板（设为她头像/主视觉/我的头像）
  const [sheetItem, setSheetItem] = useState<Collectible | null>(null);
  // 「设为我的头像」高博弈二次确认
  const [confirmMine, setConfirmMine] = useState<Collectible | null>(null);
  // 收藏操作的轻提示
  const [collectToast, setCollectToast] = useState<string | null>(null);
  const flash = (msg: string) => { setCollectToast(msg); window.setTimeout(() => setCollectToast((c) => (c === msg ? null : c)), 3200); };

  const character = id ? getCharacterById(id) : undefined;
  const ownedChar = ownedCharacters.find((c) => c.characterId === id);
  const owned = !!ownedChar;

  const level = ownedChar?.level || 1;
  const exp = ownedChar?.exp || 0;
  const affinity = id ? affinityMap[id] ?? 0 : 0;
  const stage = id ? relationshipStages[id] ?? 0 : 0;
  const stageInfo = id ? getStageInfo(id, stage) : undefined;
  const nextStage = id ? getNextStage(id, stage) : undefined;
  const maxStage = id ? getRelationshipStages(id).length : 0;
  /** 卡数 + 好感双门槛：第 N 阶需要累计 N 张她的信物卡（重复卡是关系钥匙） */
  const dupes = id ? dupeCount[id] ?? 0 : 0;
  const dupesNeeded = nextStage ? dupesNeededForStage(nextStage.stage) : 0;
  const hasDupesForNext = dupes >= dupesNeeded;
  const expToLevel = expForLevel(level);
  const expPercent = Math.min((exp / expToLevel) * 100, 100);

  // 当前等级可用的对话
  const currentDialogue = useMemo(() => {
    if (!character) return '';
    const available = character.dialogues
      .filter((d) => d.level <= level)
      .sort((a, b) => b.level - a.level);
    return available[0]?.text || character.dialogues[0]?.text || '';
  }, [character, level]);

  // 当前等级可用的效果
  const availableEffects = useMemo(() => {
    if (!character) return [];
    return character.effects.filter((e) => e.level <= level);
  }, [character, level]);

  // 下一级效果预览
  const nextLevelEffects = useMemo(() => {
    if (!character) return [];
    return character.effects.filter((e) => e.level > level).sort((a, b) => a.level - b.level);
  }, [character, level]);

  const handleAdvanceStage = () => {
    playSound('stage-up');
    if (!character || !owned || !nextStage) return;
    if (affinity < nextStage.threshold) return;
    if (!hasDupesForNext) return;
    // 每角色每日最多推进一阶，保住养成节奏（设计文档 6.3）
    if (!tryDailyAction(`stage:${character.id}`)) {
      setInteractionResponse('（今天的相处已经够多了，关系的事……明天再继续吧。）');
      setTimeout(() => setInteractionResponse(null), 3000);
      return;
    }
    advanceRelationshipStage(character.id);
    setInteractionResponse(nextStage.text);
    setTimeout(() => setInteractionResponse(null), 6000);
  };

  const handleUpgrade = () => {
    if (!id || spiritStones < UPGRADE_COST) return;
    addSpiritStones(-UPGRADE_COST);
    addExp(id, 50); // store.addExp 内部自动连升级，无需在此手动 levelUp
  };

  /* ── 心动线 ── */
  const romanceArc = id ? getRomanceArc(id) : undefined;
  const progress = id ? romanceProgress[id] ?? 0 : 0;
  const condState = {
    spiritStones, reputation,
    ownedCharacters: ownedCharacters.map((c) => ({ characterId: c.characterId, level: c.level })),
    affinityMap, relationshipStages, completedNodes, flags, dupeCount,
  };

  /** 节点演完落幕：结算默契 + 奖励 + 进度 +1（重温模式只看不结算） */
  const handleBeatComplete = (chosen: RomanceChoiceOption | null) => {
    const playing = playingBeat;
    setPlayingBeat(null);
    if (!playing || !id) return;
    if (playing.replay) return; // 重温已解锁的故事，不重复结算
    const beat = playing.beat;
    if (chosen?.momo) addMomo(id, chosen.momo);
    // 告白门：没确认心意就不过门——留在门前，可重来
    if (beat.isGate && !chosen?.gateConfirm) return;
    const r = beat.reward;
    if (r?.affinity) addAffinity(id, r.affinity);
    if (r?.advanceStage) advanceRelationshipStage(id);
    if (r?.unlockFlag) setFlag(r.unlockFlag);
    if (r?.wechat) {
      addPhoneMessage({ id: `romance_${beat.id}_${Date.now()}`, characterId: id, type: 'wechat', content: r.wechat, timestamp: Date.now(), read: false });
    }
    if (beat.isGate) {
      usePlayerStore.getState().setXinyiTarget(id);
      // 确认心意后，其他有好感的老婆会发来一条得体的"退场"消息——不再默默被锁
      const reactions = passedOverReactions({
        chosenId: id,
        ownedCharacterIds: ownedCharacters.map((c) => c.characterId),
        affinityMap,
      });
      for (const r of reactions) {
        addPhoneMessage({
          id: `passedover_${r.characterId}_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
          characterId: r.characterId, type: 'wechat', content: r.message, timestamp: Date.now(), read: false,
        });
      }
    }
    advanceRomance(id);
  };

  /** 设为我的头像（高博弈）：换头像 + 结算她的甜蜜/反感 + 别人吃醋，反应以微信发来 */
  const applyMineAvatar = (item: Collectible) => {
    if (!id) return;
    setPlayerAvatar(item.asset, id);
    const reactions = resolveAvatarFallout({
      chosenId: id,
      affinityMap,
      ownedCharacterIds: ownedCharacters.map((c) => c.characterId),
      xinyiTarget,
    });
    for (const r of reactions) {
      if (r.affinityDelta) addAffinity(r.characterId, r.affinityDelta);
      if (r.message) {
        addPhoneMessage({
          id: `avatar_react_${r.characterId}_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
          characterId: r.characterId, type: 'wechat', content: r.message, timestamp: Date.now(), read: false,
        });
      }
    }
    const self = reactions.find((r) => r.characterId === id);
    const jealous = reactions.filter((r) => r.kind === 'jealous').length;
    const head = self?.kind === 'sweet' ? `头像换成了 ${character?.name} · 她很受用 💗`
      : self?.kind === 'flattered' ? `头像换成了 ${character?.name} · 她有点受宠若惊`
        : `头像换成了 ${character?.name} · 她似乎不太自在…`;
    flash(jealous > 0 ? `${head}（另外 ${jealous} 个人也看到了，去微信看看）` : `${head}（去微信看她的反应）`);
  };

  if (!character) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-500">角色未找到</p>
      </div>
    );
  }

  const defaultHeroArt = character.gachaBackgroundUrl || character.portraitUrl;
  // 设为展示：玩家选过就用她选的那张，否则用默认主视觉
  const heroArtUrl = (id && displayPortrait[id]) || defaultHeroArt;
  const pageBackdrop = backdropForCharacter(character.id);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050914] pb-nav">
      <PageBackdrop
        image={pageBackdrop.image}
        mobileImage={pageBackdrop.mobileImage}
        position={pageBackdrop.position}
        overlayClassName="from-slate-950/60 via-slate-950/80 to-slate-950/95"
      />

      {/* 返回按钮 */}
      <div className="absolute left-4 top-4 z-30">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur-sm hover:bg-black/60"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* 角色立绘区域 */}
      <div
        className={cn(
          'relative z-10 flex h-72 items-center justify-center',
          'bg-gradient-to-b',
          rarityGradient[character.rarity],
        )}
      >
        {heroArtUrl ? (
          <img
            src={assetUrl(heroArtUrl)}
            alt={character.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-center">
            <span className="text-6xl text-white/20">人</span>
          </div>
        )}

        {/* 底部渐变 */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950 to-transparent" />

        {/* 稀有度徽章 */}
        <div className="absolute right-4 top-4">
          <span
            className={cn(
              'rounded-md px-2.5 py-1 text-sm font-bold',
              rarityBadge[character.rarity],
            )}
          >
            {character.rarity}
          </span>
        </div>
      </div>

      {/* 角色信息 */}
      <div className="relative z-10 px-5 pt-2">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">{character.name}</h1>
            <p className={cn('text-sm', rarityLabel[character.rarity])}>{character.title}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">等级</p>
            <p className="text-lg font-bold text-white">Lv.{level}</p>
          </div>
        </div>

        {/* 属性条 */}
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
          <span>属性: <span className={rarityLabel[character.rarity]}>{character.element}</span></span>
          <span>好感: <span className="text-pink-400">{affinity}</span></span>
          <span>关系: <span className="text-rose-300">{stageInfo?.name ?? (owned ? '初识' : '委托人')}</span></span>
        </div>

        {/* 当前台词 */}
        {currentDialogue && (
          <div className="mt-4 rounded-lg bg-slate-800/40 px-4 py-3">
            <p className="text-sm leading-relaxed text-slate-300 italic">"{currentDialogue}"</p>
          </div>
        )}
      </div>

      {/* 标签栏 */}
      <div className="relative z-10 mt-5 flex border-b border-white/10 px-5">
        {([
          ...(romanceArc ? [{ id: 'romance' as TabType, label: '心动' }] : []),
          { id: 'info' as TabType, label: '信息' },
          { id: 'collect' as TabType, label: '收藏' },
          { id: 'upgrade' as TabType, label: '养成' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex-1 py-3 text-sm font-medium transition-colors duration-200',
              activeTab === tab.id ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="charTabIndicator"
                className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-amber-400"
              />
            )}
          </button>
        ))}
      </div>

      {/* 标签内容 */}
      <div className="relative z-10 px-5 pt-4">
        {/* 心动标签：逐格解锁的成就墙 + 路线图 */}
        {activeTab === 'romance' && romanceArc && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <p className="text-xs leading-relaxed text-rose-200/70">{romanceArc.theme}</p>
            {romanceArc.beats.map((beat, i) => {
              const status = id ? beatStatus(id, i, progress, condState, xinyiTarget) : 'locked';
              const done = status === 'done';
              const available = status === 'available';
              return (
                <div
                  key={beat.id}
                  className={cn(
                    'rounded-xl border p-3',
                    done ? 'border-rose-400/40 bg-rose-500/10'
                      : available ? 'border-amber-400/60 bg-amber-500/10 shadow-[0_0_16px_rgba(251,191,36,0.2)]'
                        : 'border-white/10 bg-slate-800/30',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-sm font-bold', done ? 'text-rose-200' : available ? 'text-amber-200' : 'text-slate-500')}>
                      {done || available ? `${beat.phase} · ${beat.title}` : `${beat.phase} · ???`}
                    </span>
                    <span className="shrink-0 text-[10px]">
                      {done ? '💗 已解锁' : available ? '✨ 可进行' : '🔒'}
                    </span>
                  </div>
                  {/* 指引：锁着/可进时显示怎么挣到 */}
                  {!done && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{beat.guide}</p>
                  )}
                  {/* 已解锁：可重温这段故事 */}
                  {done && (
                    <button
                      onClick={() => { playSound('dialog-next'); setPlayingBeat({ beat, replay: true }); }}
                      className="mt-2.5 w-full rounded-lg border border-rose-400/30 bg-rose-500/10 py-2 text-xs font-bold text-rose-200 active:scale-[0.99] transition-all hover:bg-rose-500/15"
                    >
                      ↺ 重温这段
                    </button>
                  )}
                  {available && (
                    <button
                      onClick={() => { playSound('challenge-appear'); setPlayingBeat({ beat, replay: false }); }}
                      className="mt-2.5 w-full rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 py-2 text-xs font-black text-white active:scale-[0.99] transition-all"
                    >
                      ▶ 去见她
                    </button>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* 收藏标签：她的表情/立绘，靠刷主流程解锁。锁着=剪影+指引 */}
        {activeTab === 'collect' && (() => {
          const items = character ? getCollectibles(character) : [];
          const unlockedCount = items.filter((it) => evaluateAll(it.unlock, condState)).length;
          return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <p className="text-xs text-slate-400">收藏 {unlockedCount}/{items.length} · 刷得越多，集得越全</p>
              <p className="text-[11px] text-slate-500">点已解锁的图：可设为她的头像、专属主视觉，或设成你自己的头像；带 📖 的短篇点开回看。</p>
              <div className="grid grid-cols-3 gap-2">
                {items.map((it) => {
                  const unlocked = evaluateAll(it.unlock, condState);
                  const isCg = it.kind === 'cg';
                  const isExpr = it.kind === 'expr';
                  // 当前是否正被采用：表情看头像槽，立绘看主视觉槽
                  const active = unlocked && (isExpr
                    ? (id ? displayAvatar[id] === it.asset : false)
                    : (!isCg && heroArtUrl === it.asset));
                  const actionLabel = isCg ? '回看' : isExpr ? '设为头像' : '设为展示';
                  const activeLabel = isExpr ? '头像中' : '展示中';
                  const onClick = () => {
                    if (!unlocked) return;
                    playSound('btn-confirm');
                    if (isCg && it.cg) setOpenCg(it.cg);
                    else setSheetItem(it);
                  };
                  return (
                    <button
                      key={it.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={onClick}
                      className={cn(
                        'group overflow-hidden rounded-lg border bg-slate-900/60 text-left transition-all',
                        active ? 'border-amber-400/70 shadow-[0_0_14px_rgba(251,191,36,0.25)]' : 'border-white/10',
                        unlocked && !active && 'hover:border-amber-300/40 active:scale-[0.98]',
                        !unlocked && 'cursor-default',
                      )}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-slate-800">
                        {unlocked ? (
                          <>
                            <img src={assetUrl(it.asset)} alt={it.name} className="h-full w-full object-cover object-top" loading="lazy" />
                            {isCg && (
                              <span className="absolute right-1 top-1 rounded bg-rose-500/85 px-1 py-0.5 text-[9px] font-bold text-white">📖</span>
                            )}
                            {active ? (
                              <span className="absolute left-1 top-1 rounded bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">{activeLabel}</span>
                            ) : (
                              <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[10px] font-medium text-amber-200 opacity-0 transition-opacity group-hover:opacity-100">
                                {actionLabel}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <img src={assetUrl(it.asset)} alt="" aria-hidden className="h-full w-full object-cover object-top opacity-15 blur-md grayscale" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1 text-center">
                              <span className="text-lg">{isCg ? '📖' : '🔒'}</span>
                              <span className="text-[10px] leading-tight text-amber-300/80">{it.hint}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <p className={cn('px-1.5 py-1 text-center text-[11px]', active ? 'text-amber-300' : unlocked ? 'text-slate-200' : 'text-slate-600')}>
                        {unlocked ? it.name : '???'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          );
        })()}

        {/* 信息标签 */}
        {activeTab === 'info' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* 描述 */}
            <div>
              <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-500">角色描述</h3>
              <p className="text-sm leading-relaxed text-slate-300">{character.description}</p>
            </div>


            {/* 效果列表 */}
            <div>
              <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-500">技能效果</h3>
              <div className="space-y-2">
                {availableEffects.map((effect, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-slate-800/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-bold',
                          effect.type === 'story'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-blue-500/20 text-blue-400',
                        )}
                      >
                        {effect.type === 'story' ? '剧情' : '被动'}
                      </span>
                      <span className="text-xs text-slate-400">Lv.{effect.level}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{effect.description}</p>
                    {effect.type === 'passive' && (
                      <p className={cn('mt-1 text-[11px]', level >= 10 ? 'text-emerald-400' : 'text-amber-400/70')}>
                        {level >= 10 ? '✦ 已精通：特质加成翻倍' : `升至 Lv.10 精通：特质加成翻倍（还差 ${10 - level} 级）`}
                      </p>
                    )}
                  </div>
                ))}
                {availableEffects.length === 0 && (
                  <p className="text-xs text-slate-600">暂无已解锁效果</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* 养成标签 · 关系阶段（承重：引荐/视频/手机事件都看它）*/}
        {activeTab === 'upgrade' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* 关系阶段：好感是温度、信物（她的卡）是钥匙 */}
            <div className="rounded-xl bg-slate-800/40 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm text-slate-400">
                  <Heart size={14} className="text-rose-400" />
                  关系阶段
                </span>
                <span className="text-sm font-bold text-rose-300">
                  {stage}/{maxStage} · {stageInfo?.name ?? (owned ? '初识' : '委托人')}
                </span>
              </div>
              {nextStage ? (
                <>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>下一阶：{nextStage.name}</span>
                      <span>好感 {Math.min(affinity, nextStage.threshold)}/{nextStage.threshold}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((affinity / nextStage.threshold) * 100, 100)}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-400"
                      />
                    </div>
                    {/* 信物门槛：好感是温度，信物是钥匙，缺一不可 */}
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-slate-500">信物（她的卡）</span>
                      <span className={hasDupesForNext ? 'text-emerald-300' : 'text-amber-300'}>
                        {'💌'.repeat(Math.min(dupes, dupesNeeded))}{'🖤'.repeat(Math.max(0, dupesNeeded - dupes))} {Math.min(dupes, dupesNeeded)}/{dupesNeeded}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleAdvanceStage}
                    disabled={!owned || affinity < nextStage.threshold || !hasDupesForNext}
                    className={cn(
                      'mt-3 w-full rounded-lg py-2 text-sm font-bold transition-colors',
                      owned && affinity >= nextStage.threshold && hasDupesForNext
                        ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white'
                        : 'cursor-not-allowed bg-slate-700/40 text-slate-500',
                    )}
                  >
                    {!owned
                      ? '抽到她后才能加深关系'
                      : affinity < nextStage.threshold
                        ? '好感不足'
                        : !hasDupesForNext
                          ? `还差 ${dupesNeeded - dupes} 张她的信物卡（补给/引荐获得）`
                          : '加深关系'}
                  </button>
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-500">关系已满阶——她是二十五时的常客了。</p>
              )}
            </div>

            {!owned && (
              <p className="rounded-lg bg-slate-800/30 px-3 py-2 text-xs leading-relaxed text-slate-500">
                她还只是便利屋的委托人。多帮她完成委托、好感不会白攒；等你们够熟，补给频道里就有机会遇见她，把她留在身边。
              </p>
            )}

            {/* 关系推进反馈 */}
            {interactionResponse && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl bg-slate-800/60 px-4 py-3"
              >
                <p className="text-sm leading-relaxed text-slate-300">{interactionResponse}</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* 养成标签 · 等级培养 */}
        {activeTab === 'upgrade' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* 当前等级 */}
            <div className="rounded-xl bg-slate-800/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">当前等级</span>
                <span className="text-lg font-bold text-white">Lv.{level}</span>
              </div>
              {/* 经验条 */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>经验值</span>
                  <span>{exp}/{expToLevel}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${expPercent}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* 升级按钮 */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleUpgrade}
              disabled={spiritStones < UPGRADE_COST}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl py-3',
                'bg-gradient-to-r from-amber-500 to-amber-600',
                'text-base font-bold text-amber-950',
                'shadow-[0_0_20px_rgba(251,191,36,0.3)]',
                'transition-all duration-200',
                spiritStones < UPGRADE_COST && 'cursor-not-allowed opacity-50',
              )}
            >
              <TrendingUp size={18} />
              培养角色 (🌙 {UPGRADE_COST})
            </motion.button>

            {/* 下一级效果预览 */}
            {nextLevelEffects.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-500">升级预览</h3>
                <div className="space-y-2">
                  {nextLevelEffects.map((effect, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-slate-800/30 px-3 py-2 border border-dashed border-slate-700/30"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                          Lv.{effect.level}
                        </span>
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-bold',
                            effect.type === 'story'
                              ? 'bg-amber-500/10 text-amber-400/60'
                              : 'bg-blue-500/10 text-blue-400/60',
                          )}
                        >
                          {effect.type === 'story' ? '剧情' : '被动'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{effect.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* 心动场景演出 */}
      {playingBeat && id && (
        <RomanceScene key={playingBeat.beat.id + (playingBeat.replay ? '-r' : '')} characterId={id} beat={playingBeat.beat} onComplete={handleBeatComplete} />
      )}

      {/* 收藏里回看的 CG 短篇 */}
      {openCg && (
        <StoryViewer title={openCg.title} image={openCg.image} paragraphs={openCg.paragraphs} onClose={() => setOpenCg(null)} />
      )}

      {/* 收藏操作面板 */}
      {sheetItem && id && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60" onClick={() => setSheetItem(null)}>
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl border-t border-white/10 bg-slate-900 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          >
            <div className="mb-3 flex items-center gap-3">
              <img src={assetUrl(sheetItem.asset)} alt="" className="h-12 w-12 rounded-lg object-cover object-top" />
              <div>
                <p className="text-sm font-bold text-white">{sheetItem.name}</p>
                <p className="text-[11px] text-slate-400">{character.name} · {sheetItem.kind === 'expr' ? '表情' : '立绘'}</p>
              </div>
            </div>
            <div className="space-y-2">
              {sheetItem.kind === 'expr' ? (
                <button
                  onClick={() => { playSound('btn-confirm'); setDisplayAvatar(id, sheetItem.asset); flash(`已设为 ${character.name} 的手机头像`); setSheetItem(null); }}
                  className="w-full rounded-xl bg-slate-800 py-3 text-sm font-bold text-amber-200 active:scale-[0.99]"
                >设为 {character.name} 的手机头像</button>
              ) : (
                <button
                  onClick={() => { playSound('btn-confirm'); setDisplayPortrait(id, sheetItem.asset); flash(`已设为 ${character.name} 的专属主视觉`); setSheetItem(null); }}
                  className="w-full rounded-xl bg-slate-800 py-3 text-sm font-bold text-amber-200 active:scale-[0.99]"
                >设为 {character.name} 的专属主视觉</button>
              )}
              <button
                onClick={() => { playSound('btn-confirm'); const it = sheetItem; setSheetItem(null); setConfirmMine(it); }}
                className="w-full rounded-xl border border-rose-400/40 bg-rose-500/10 py-3 text-sm font-bold text-rose-200 active:scale-[0.99]"
              >设为我自己的头像 ⚠</button>
              <button onClick={() => setSheetItem(null)} className="w-full py-2.5 text-sm text-slate-400">取消</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 设为我的头像 · 高博弈二次确认 */}
      {confirmMine && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-6" onClick={() => setConfirmMine(null)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-rose-400/30 bg-slate-900 p-5"
          >
            <p className="mb-2 text-base font-black text-rose-200">把头像换成{character.name}？</p>
            <p className="mb-4 text-xs leading-relaxed text-slate-300">
              这是一步要想清楚的棋——你俩够近，她会惊喜；还没到那份上，她可能会别扭、生分。
              而且<span className="text-rose-300">其他跟你走得近的人看到，未必高兴</span>。她们的反应，会在微信里等你。
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmMine(null)} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-300">再想想</button>
              <button
                onClick={() => { const it = confirmMine; setConfirmMine(null); playSound('challenge-appear'); if (it) applyMineAvatar(it); }}
                className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-2.5 text-sm font-black text-white"
              >就换她 💗</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 收藏操作轻提示 */}
      {collectToast && (
        <div className="pointer-events-none fixed inset-x-0 z-[300] flex justify-center px-4" style={{ bottom: 'calc(var(--bar-h, 0px) + var(--nav-h, 0px) + 24px)' }}>
          <div className="max-w-[92%] rounded-xl bg-slate-800/95 px-4 py-2.5 text-center text-xs font-medium text-amber-100 shadow-lg ring-1 ring-white/10">
            {collectToast}
          </div>
        </div>
      )}
    </div>
  );
}
