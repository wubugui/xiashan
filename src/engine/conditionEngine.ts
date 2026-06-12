import { Condition } from './types';

interface PlayerStateForCondition {
  spiritStones: number;
  reputation: number;
  ownedCharacters: { characterId: string; level: number }[];
  affinityMap: Record<string, number>;
  relationshipStages: Record<string, number>;
  completedNodes: string[];
  flags: string[];
  /** 累计信物卡数（可选：旧调用方不传时该条件按 0 计） */
  dupeCount?: Record<string, number>;
}

export function evaluateCondition(condition: Condition, state: PlayerStateForCondition): boolean {
  switch (condition.type) {
    case 'has_character':
      return state.ownedCharacters.some(c => c.characterId === condition.characterId);
    case 'character_level': {
      const ch = state.ownedCharacters.find(c => c.characterId === condition.characterId);
      return ch ? ch.level >= condition.minLevel : false;
    }
    case 'reputation':
      return state.reputation >= condition.minValue;
    case 'affinity':
      return (state.affinityMap[condition.characterId] ?? 0) >= condition.minValue;
    case 'relationship_stage':
      return (state.relationshipStages[condition.characterId] ?? 0) >= condition.minStage;
    case 'dupes_at_least':
      return (state.dupeCount?.[condition.characterId] ?? 0) >= condition.minCount;
    case 'chapter_complete':
      return state.completedNodes.some(n => n.startsWith(`ch${condition.chapterId}_`));
    case 'node_complete':
      return state.completedNodes.includes(condition.nodeId);
    case 'flag_set':
      return state.flags.includes(condition.flag);
    case 'spirit_stones':
      return state.spiritStones >= condition.minValue;
    case 'random':
      return Math.random() < condition.chance;
  }
}

export function evaluateAll(conditions: Condition[], state: PlayerStateForCondition): boolean {
  return conditions.every(c => evaluateCondition(c, state));
}
