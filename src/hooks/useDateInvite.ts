import { useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { commsTier, smsThreshold } from '@/engine/phoneAccess';
import { nextLockedScene, type DateScene } from '@/data/scenes';

/**
 * 「约她出去」统一逻辑（手机联系人页 + 角色主页共用，单一真源）。
 * 门槛：关系到「常联系」(tier≥2，即好感≥关系阶段2阈值) 才肯赴约；每游戏天每人一次。
 * 成功一次：按顺序解锁下一段约会场景 + 好感 +3 + 记一次联系，返回 dateReveal 供调用方播放揭示。
 */
export function useDateInvite(characterId: string | undefined) {
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const unlockedScenes = usePlayerStore((s) => s.unlockedScenes);
  const unlockScene = usePlayerStore((s) => s.unlockScene);
  const tryDailyAction = usePlayerStore((s) => s.tryDailyAction);
  const dailyActions = usePlayerStore((s) => s.dailyActions);
  const gameDay = usePlayerStore((s) => s.gameDay);
  const addAffinity = usePlayerStore((s) => s.addAffinity);
  const markContact = usePlayerStore((s) => s.markContact);

  const [dateReveal, setDateReveal] = useState<DateScene | null>(null);
  const [dateToast, setDateToast] = useState<string | null>(null);

  const owned = !!characterId && ownedCharacters.some((c) => c.characterId === characterId);
  const affinity = characterId ? affinityMap[characterId] ?? 0 : 0;
  const tier = characterId ? commsTier(characterId, owned, affinity) : 0;
  const nextScene = owned && characterId ? nextLockedScene(characterId, unlockedScenes) : null;
  const datedToday = !!characterId && dailyActions[`date:${characterId}`] === String(gameDay);
  /** 全部约会回忆已集齐 */
  const allUnlocked = owned && !nextScene;
  /** 关系还没到「常联系」 */
  const tierTooLow = tier < 2;
  /** 现在就能约：还有没解锁的场景 + 关系到位 + 今天还没约 */
  const canDate = !!nextScene && !tierTooLow && !datedToday;

  /** 约会门槛好感值 + 距门槛还差多少（用于「好感 45/70」式进度提示） */
  const threshold = characterId ? smsThreshold(characterId) : Infinity;
  const affinityRemain = Math.max(0, threshold - affinity);

  const flashDate = (msg: string) => {
    setDateToast(msg);
    window.setTimeout(() => setDateToast((c) => (c === msg ? null : c)), 2400);
  };

  const handleDate = () => {
    if (!characterId || !nextScene) return;
    const character = getCharacterById(characterId);
    if (tierTooLow) {
      flashDate('再熟一点……她还不太好意思单独和你出去。');
      return;
    }
    if (!tryDailyAction(`date:${characterId}`)) {
      flashDate(`今天已经和${character?.name ?? '她'}约过了，明天再约吧。`);
      return;
    }
    unlockScene(nextScene.id);
    addAffinity(characterId, 3);
    markContact(characterId);
    setDateReveal(nextScene);
  };

  return {
    owned, tier, affinity, threshold, affinityRemain,
    nextScene, datedToday, allUnlocked, tierTooLow, canDate,
    handleDate,
    dateReveal, clearReveal: () => setDateReveal(null),
    dateToast,
  };
}
