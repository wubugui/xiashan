import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useStoryStore } from '@/store/useStoryStore';
import { getNodeById } from '@/data/storyChapters';
import { getCharacterById } from '@/data/characters';
import { executeAll } from '@/engine/effectEngine';
import { evaluateAll } from '@/engine/conditionEngine';
import { checkPhoneEvents } from '@/engine/phoneScheduler';
import { pullSingle } from '@/engine/gachaEngine';
import { REWARDS } from '@/data/rewards';
import DialogueBox from '@/components/DialogueBox';
import ChoicePanel from '@/components/ChoicePanel';
import FaceSlapEffect from '@/components/FaceSlapEffect';
import GachaAnimation from '@/components/GachaAnimation';
import type { Effect } from '@/engine/types';
import { assetUrl } from '@/lib/assets';

export default function Story() {
  const navigate = useNavigate();
  const {
    currentNodeId,
    completedNodes,
    flags,
    ownedCharacters,
    affinityMap,
    relationshipStages,
    spiritStones,
    reputation,
    phoneMessages,
    unreadCounts,
    triggeredEventIds,
    setCurrentNode,
    completeNode,
    setFlag,
    addSpiritStones,
    addReputation,
    addAffinity,
    addCharacter,
    addPhoneMessage,
    addTriggeredEvent,
  } = usePlayerStore();

  const {
    currentNode,
    showGacha,
    showFaceSlap,
    currentFaceSlap,
    phoneNotification,
    setCurrentNode: setStoryNode,
    setShowGacha,
    setShowFaceSlap,
    setPhoneNotification,
  } = useStoryStore();

  const [gachaResults, setGachaResults] = useState<
    { characterId: string; name: string; rarity: 'N' | 'R' | 'SR' | 'SSR'; title: string; isNew: boolean }[]
  >([]);
  const [isGachaTenPull, setIsGachaTenPull] = useState(false);
  const [phoneNotifyVisible, setPhoneNotifyVisible] = useState(false);

  // 加载当前节点
  useEffect(() => {
    const node = getNodeById(currentNodeId);
    if (node) {
      setStoryNode(node);
    }
  }, [currentNodeId, setStoryNode]);

  // 构建玩家状态用于条件判断和效果执行
  const playerState = useMemo(
    () => ({
      spiritStones,
      reputation,
      ownedCharacters,
      affinityMap,
      completedNodes,
      flags,
      phoneMessages,
      unreadCounts,
    }),
    [spiritStones, reputation, ownedCharacters, affinityMap, completedNodes, flags, phoneMessages, unreadCounts],
  );

  // 执行效果列表
  const applyEffects = useCallback(
    (effects: Effect[]) => {
      executeAll(effects, playerState);
      // 将效果应用到 store
      effects.forEach((effect) => {
        switch (effect.type) {
          case 'add_spirit_stones':
            addSpiritStones(effect.value);
            break;
          case 'add_reputation':
            addReputation(effect.value);
            break;
          case 'add_affinity':
            addAffinity(effect.characterId, effect.value);
            break;
          case 'set_flag':
            setFlag(effect.flag);
            break;
        }
      });
    },
    [playerState, addSpiritStones, addReputation, addAffinity, setFlag],
  );

  // 检查手机事件
  const checkAndTriggerPhoneEvents = useCallback(() => {
    const schedulerState = {
      spiritStones,
      reputation,
      ownedCharacters: ownedCharacters.map((c) => ({
        characterId: c.characterId,
        level: c.level,
      })),
      affinityMap,
      relationshipStages,
      completedNodes,
      flags,
      triggeredEventIds,
    };
    const newEvents = checkPhoneEvents(schedulerState);
    newEvents.forEach((event) => {
      addTriggeredEvent(event.id);
      // 添加角色消息
      if (event.characterId && event.messages.length > 0) {
        const firstMsg = event.messages[0];
        addPhoneMessage({
          id: `event_${event.id}_${Date.now()}`,
          characterId: event.characterId,
          type: (event.type === 'browser_push' ? 'sms' : event.type === 'call' ? 'sms' : event.type) as 'wechat' | 'sms',
          content: firstMsg.content,
          timestamp: Date.now(),
          read: false,
        });
      }
    });
  }, [spiritStones, reputation, ownedCharacters, affinityMap, relationshipStages, completedNodes, flags, triggeredEventIds, addTriggeredEvent, addPhoneMessage]);

  // 推进到下一个节点
  const advanceToNode = useCallback(
    (nextNodeId: string) => {
      completeNode(currentNodeId);
      addSpiritStones(REWARDS.story_node_complete);
      setCurrentNode(nextNodeId);
      checkAndTriggerPhoneEvents();
    },
    [currentNodeId, completeNode, addSpiritStones, setCurrentNode, checkAndTriggerPhoneEvents],
  );

  const finishCurrentNode = useCallback(() => {
    const isAlreadyCompleted = completedNodes.includes(currentNodeId);
    if (!isAlreadyCompleted) {
      completeNode(currentNodeId);
      addSpiritStones(REWARDS.chapter_complete);
      checkAndTriggerPhoneEvents();
    }
    navigate('/');
  }, [completedNodes, currentNodeId, completeNode, addSpiritStones, checkAndTriggerPhoneEvents, navigate]);

  // 处理对话推进
  const handleNext = useCallback(() => {
    if (!currentNode) return;

    // 执行当前节点效果
    if (currentNode.effects && !completedNodes.includes(currentNode.id)) {
      applyEffects(currentNode.effects);
    }

    // 根据节点类型处理
    switch (currentNode.type) {
      case 'gacha_trigger': {
        // 执行抽卡
        const trigger = currentNode.gachaTrigger;
        if (trigger) {
          const ownedIds = ownedCharacters.map((c) => c.characterId);
          const ps = usePlayerStore.getState();
          const pullResult = pullSingle(ownedIds, ps.affinityMap, ps.pityCounter, ps.totalGachaCount, { rateUpUntil: ps.rateUpUntil, coldUntil: ps.coldUntil });
          const gachaResult = pullResult.result;
          addCharacter(gachaResult.character.id);
          usePlayerStore.getState().addGachaResult(gachaResult.character.id, gachaResult.character.rarity);
          usePlayerStore.getState().setPityCounter(pullResult.newPity);
          usePlayerStore.getState().setTotalGachaCount(pullResult.newTotal);
          if (gachaResult.isNew) {
            addSpiritStones(REWARDS.first_time_character);
          }
          setGachaResults([
            {
              characterId: gachaResult.character.id,
              name: gachaResult.character.name,
              rarity: gachaResult.character.rarity,
              title: gachaResult.character.title,
              isNew: gachaResult.isNew,
            },
          ]);
          setIsGachaTenPull(false);
          setShowGacha(true);
        }
        break;
      }
      case 'face_slap': {
        if (currentNode.faceSlap) {
          setShowFaceSlap(true, currentNode.faceSlap);
          applyEffects(currentNode.faceSlap.effects);
        }
        break;
      }
      case 'phone_notify': {
        if (currentNode.phoneNotify) {
          setPhoneNotification(currentNode.phoneNotify);
          setPhoneNotifyVisible(true);
          // 添加手机消息
          const notify = currentNode.phoneNotify;
          const character = getCharacterById(notify.characterId);
          if (character) {
            addPhoneMessage({
              id: `notify_${notify.eventId}_${Date.now()}`,
              characterId: notify.characterId,
              type: notify.type === 'call' ? 'sms' : notify.type,
              content: `${character.name}发来了一条新消息`,
              timestamp: Date.now(),
              read: false,
            });
          }
          // 自动隐藏通知
          setTimeout(() => {
            setPhoneNotifyVisible(false);
            setPhoneNotification(null);
          }, 3000);
        }
        // phone_notify 类型继续推进
        if (currentNode.nextNodeId) {
          advanceToNode(currentNode.nextNodeId);
        } else {
          finishCurrentNode();
        }
        break;
      }
      case 'choice':
        // 选项由 ChoicePanel 处理
        break;
      default:
        // dialogue / narration
        if (currentNode.nextNodeId) {
          advanceToNode(currentNode.nextNodeId);
        } else {
          finishCurrentNode();
        }
        break;
    }
  }, [currentNode, completedNodes, ownedCharacters, addCharacter, addSpiritStones, setShowGacha, setShowFaceSlap, setPhoneNotification, addPhoneMessage, advanceToNode, finishCurrentNode, applyEffects]);

  // 处理选项选择
  const handleChoiceSelect = useCallback(
    (index: number) => {
      if (!currentNode?.choices) return;
      const choice = currentNode.choices[index];

      // 检查条件
      if (choice.conditions) {
        const conditionState = {
          spiritStones,
          reputation,
          ownedCharacters: ownedCharacters.map((c) => ({
            characterId: c.characterId,
            level: c.level,
          })),
          affinityMap,
          relationshipStages,
          completedNodes,
          flags,
        };
        if (!evaluateAll(choice.conditions, conditionState)) return;
      }

      // 执行选项效果
      if (choice.effects) {
        applyEffects(choice.effects);
      }

      // 推进到下一个节点
      if (choice.nextNodeId) {
        advanceToNode(choice.nextNodeId);
      }
    },
    [currentNode, spiritStones, reputation, ownedCharacters, affinityMap, relationshipStages, completedNodes, flags, applyEffects, advanceToNode],
  );

  // 抽卡完成回调
  const handleGachaComplete = useCallback(() => {
    setShowGacha(false);
    setGachaResults([]);
    if (currentNode?.nextNodeId) {
      advanceToNode(currentNode.nextNodeId);
    }
  }, [setShowGacha, currentNode, advanceToNode]);

  // 打脸完成回调
  const handleFaceSlapComplete = useCallback(() => {
    setShowFaceSlap(false);
    if (currentNode?.nextNodeId) {
      advanceToNode(currentNode.nextNodeId);
    }
  }, [setShowFaceSlap, currentNode, advanceToNode]);

  // 跳过打字效果（由DialogueBox内部管理）
  const handleSkipTyping = useCallback(() => {
    // DialogueBox自行处理打字跳过逻辑
  }, []);

  // 背景样式
  const bgStyle = useMemo(() => {
    const backgroundUrl = currentNode?.backgroundUrl ?? '/bg/scene/street-storefront.jpg';
    return { backgroundImage: `url(${assetUrl(backgroundUrl)})` };
  }, [currentNode?.backgroundUrl]);

  // 过滤可选选项（满足条件的）
  const availableChoices = useMemo(() => {
    if (!currentNode?.choices) return [];
    const conditionState = {
      spiritStones,
      reputation,
      ownedCharacters: ownedCharacters.map((c) => ({
        characterId: c.characterId,
        level: c.level,
      })),
      affinityMap,
      relationshipStages,
      completedNodes,
      flags,
    };
    return currentNode.choices.filter((choice) => {
      if (!choice.conditions) return true;
      return evaluateAll(choice.conditions, conditionState);
    });
  }, [currentNode, spiritStones, reputation, ownedCharacters, affinityMap, relationshipStages, completedNodes, flags]);

  const totalUnread = unreadCounts.wechat + unreadCounts.sms + unreadCounts.call;
  const speakerLabel = currentNode?.speaker ? (getCharacterById(currentNode.speaker)?.name || currentNode.speaker) : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex min-h-screen flex-col overflow-hidden"
    >
      {/* 背景 */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundColor: '#0a0a1a',
          ...bgStyle,
        }}
      >
        {/* 背景遮罩 */}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* 手机通知指示器 */}
      {totalUnread > 0 && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute right-4 top-4 z-50"
        >
          <div className="relative">
            <Smartphone className="h-6 w-6 text-white/60" />
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white"
            >
              {totalUnread > 9 ? '9+' : totalUnread}
            </motion.span>
          </div>
        </motion.div>
      )}

      {/* 手机通知弹出 */}
      <AnimatePresence>
        {phoneNotifyVisible && phoneNotification && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className="absolute left-4 right-4 top-4 z-[60] rounded-xl bg-slate-800/90 p-3 backdrop-blur-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
                <Smartphone size={14} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white">
                  {phoneNotification.type === 'wechat'
                    ? '微信消息'
                    : phoneNotification.type === 'call'
                      ? '来电'
                      : '短信'}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {getCharacterById(phoneNotification.characterId)?.name || '未知'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 选项面板 */}
      <AnimatePresence>
        {currentNode?.type === 'choice' && availableChoices.length > 0 && !showGacha && !showFaceSlap && (
          <ChoicePanel
            choices={availableChoices.map((c) => ({ text: c.text, nextNodeId: c.nextNodeId }))}
            onSelect={handleChoiceSelect}
          />
        )}
      </AnimatePresence>

      {/* 对话框 */}
      {currentNode && currentNode.type !== 'choice' && !showGacha && !showFaceSlap && (
        <DialogueBox
          speaker={speakerLabel}
          speakerColor={currentNode.speakerColor}
          text={currentNode.text}
          onNext={handleNext}
          onSkipTyping={handleSkipTyping}
        />
      )}

      {/* 抽卡动画覆盖层 */}
      <AnimatePresence>
        {showGacha && gachaResults.length > 0 && (
          <GachaAnimation
            results={gachaResults}
            isTenPull={isGachaTenPull}
            onComplete={handleGachaComplete}
          />
        )}
      </AnimatePresence>

      {/* 打脸特效覆盖层 */}
      <AnimatePresence>
        {showFaceSlap && currentFaceSlap && (
          <FaceSlapEffect
            characterName={getCharacterById(currentFaceSlap.characterId)?.name || '你'}
            enemyName={currentFaceSlap.enemyName}
            enemyLine={currentFaceSlap.enemyLine}
            characterLine={currentFaceSlap.characterLine}
            resultText={currentFaceSlap.resultText}
            onComplete={handleFaceSlapComplete}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
