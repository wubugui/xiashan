import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Hand, MessageCircle, Gift, TrendingUp, Heart } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { getRelationshipStages, getStageInfo, getNextStage } from '@/data/relationship';
import { dupesNeededForStage } from '@/engine/bondEngine';
import { expForLevel } from '@/engine/shopEngine';
import { getRomanceArc, type RomanceBeat, type RomanceChoiceOption } from '@/data/romanceArcs';
import { beatStatus } from '@/engine/romanceEngine';
import RomanceScene from '@/components/RomanceScene';
import { cn } from '@/lib/utils';
import { playSound } from '@/lib/sound';
import { assetUrl } from '@/lib/assets';
import PageBackdrop from '@/components/PageBackdrop';
import { backdropForCharacter } from '@/lib/pageBackdrops';

type TabType = 'info' | 'interact' | 'upgrade' | 'romance';

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
const INTERACT_AFFINITY = 2;
const GIFT_COST = 50;
const GIFT_AFFINITY = 5;

const expressionLabels = [
  ['smile', '微笑'],
  ['shy', '害羞'],
  ['laugh', '大笑'],
  ['angry', '生气'],
  ['cry', '哭泣'],
  ['calm', '平静'],
] as const;

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
  const advanceRomance = usePlayerStore((s) => s.advanceRomance);
  const addMomo = usePlayerStore((s) => s.addMomo);
  const setFlag = usePlayerStore((s) => s.setFlag);
  const addPhoneMessage = usePlayerStore((s) => s.addPhoneMessage);

  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [interactionResponse, setInteractionResponse] = useState<string | null>(null);
  const [playingBeat, setPlayingBeat] = useState<RomanceBeat | null>(null);

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

  // 当前等级可用的互动
  const availableInteractions = useMemo(() => {
    if (!character) return [];
    return character.interactions.filter((i) => i.level <= level);
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

  const handleInteract = (type: 'touch' | 'talk' | 'gift') => {
    playSound('btn-confirm');
    if (!character || !owned) return;
    const interaction = availableInteractions.find((i) => i.type === type);
    if (!interaction) return;
    if (type === 'gift' && spiritStones < GIFT_COST) {
      setInteractionResponse(`（灵石不足，送礼需要 ${GIFT_COST}。）`);
      setTimeout(() => setInteractionResponse(null), 3000);
      return;
    }
    // 可再生好感源按自然日限频（设计文档 6.3）
    if (!tryDailyAction(`interact:${type}:${character.id}`)) {
      setInteractionResponse('（今天已经这样相处过了，明天再来吧。）');
      setTimeout(() => setInteractionResponse(null), 3000);
      return;
    }
    if (type === 'gift') {
      addSpiritStones(-GIFT_COST);
      addAffinity(character.id, GIFT_AFFINITY);
    } else {
      addAffinity(character.id, INTERACT_AFFINITY);
    }
    setInteractionResponse(interaction.response);
    setTimeout(() => setInteractionResponse(null), 3000);
  };

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

  /** 节点演完落幕：结算默契 + 奖励 + 进度 +1 */
  const handleBeatComplete = (chosen: RomanceChoiceOption | null) => {
    const beat = playingBeat;
    setPlayingBeat(null);
    if (!beat || !id) return;
    if (chosen?.momo) addMomo(id, chosen.momo);
    const r = beat.reward;
    if (r?.affinity) addAffinity(id, r.affinity);
    if (r?.advanceStage) advanceRelationshipStage(id);
    if (r?.unlockFlag) setFlag(r.unlockFlag);
    if (r?.wechat) {
      addPhoneMessage({ id: `romance_${beat.id}_${Date.now()}`, characterId: id, type: 'wechat', content: r.wechat, timestamp: Date.now(), read: false });
    }
    if (beat.isGate) usePlayerStore.getState().setXinyiTarget(id);
    advanceRomance(id);
  };

  if (!character) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-500">角色未找到</p>
      </div>
    );
  }

  const heroArtUrl = character.gachaBackgroundUrl || character.portraitUrl;
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
          { id: 'interact' as TabType, label: '互动' },
          { id: 'upgrade' as TabType, label: '升级' },
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
              const status = id ? beatStatus(id, i, progress, condState) : 'locked';
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
                  {/* 指引：锁着/可进时显示怎么挣到；已完成显示标题即可 */}
                  {!done && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{beat.guide}</p>
                  )}
                  {available && (
                    <button
                      onClick={() => { playSound('challenge-appear'); setPlayingBeat(beat); }}
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

            {character.expressionUrls && (
              <div>
                <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-500">表情</h3>
                <div className="grid grid-cols-3 gap-2">
                  {expressionLabels.map(([key, label]) => {
                    const src = character.expressionUrls?.[key];
                    if (!src) return null;
                    return (
                      <div key={key} className="overflow-hidden rounded-md border border-slate-700/50 bg-slate-900/60">
                        <div className="aspect-[1.18] overflow-hidden bg-slate-800">
                          <img src={assetUrl(src)} alt={`${character.name}${label}`} className="h-full w-full object-cover object-top" loading="lazy" />
                        </div>
                        <p className="px-2 py-1 text-center text-[11px] text-slate-400">{label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

        {/* 互动标签 */}
        {activeTab === 'interact' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* 关系阶段 */}
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
                          ? `还差 ${dupesNeeded - dupes} 张她的信物卡（抽卡/引荐获得）`
                          : '加深关系'}
                  </button>
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-500">关系已满阶——她是二十五时的常客了。</p>
              )}
            </div>

            {!owned && (
              <p className="rounded-lg bg-slate-800/30 px-3 py-2 text-xs leading-relaxed text-slate-500">
                她还只是便利屋的委托人。继续帮她完成委托，好感不会丢失；好感攒到 40 后人物频道触发心动UP，抽到她即可解锁互动与关系。
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleInteract('touch')}
                disabled={!owned || !availableInteractions.some((i) => i.type === 'touch')}
                className={cn(
                  'flex flex-1 flex-col items-center gap-2 rounded-xl py-4',
                  'bg-slate-800/40 border border-slate-700/30',
                  'text-slate-300 transition-colors hover:bg-slate-700/40',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                <Hand size={20} />
                <span className="text-xs">触摸</span>
              </button>
              <button
                onClick={() => handleInteract('talk')}
                disabled={!owned || !availableInteractions.some((i) => i.type === 'talk')}
                className={cn(
                  'flex flex-1 flex-col items-center gap-2 rounded-xl py-4',
                  'bg-slate-800/40 border border-slate-700/30',
                  'text-slate-300 transition-colors hover:bg-slate-700/40',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                <MessageCircle size={20} />
                <span className="text-xs">对话</span>
              </button>
              <button
                onClick={() => handleInteract('gift')}
                disabled={!owned || !availableInteractions.some((i) => i.type === 'gift')}
                className={cn(
                  'flex flex-1 flex-col items-center gap-2 rounded-xl py-4',
                  'bg-slate-800/40 border border-slate-700/30',
                  'text-slate-300 transition-colors hover:bg-slate-700/40',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                <Gift size={20} />
                <span className="text-xs">送礼 💎{GIFT_COST}</span>
              </button>
            </div>

            {/* 互动回应 */}
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

            {owned && !availableInteractions.length && (
              <p className="text-center text-xs text-slate-600">提升等级解锁更多互动</p>
            )}
          </motion.div>
        )}

        {/* 升级标签 */}
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
              培养角色 (💎 {UPGRADE_COST})
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
        <RomanceScene characterId={id} beat={playingBeat} onComplete={handleBeatComplete} />
      )}
    </div>
  );
}
