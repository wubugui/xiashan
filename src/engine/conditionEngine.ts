import { Condition } from './types';

interface PlayerStateForCondition {
  spiritStones: number;
  reputation: number;
  ownedCharacters: { characterId: string; level: number; affinity: number }[];
  completedNodes: string[];
  flags: string[];
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
    case 'affinity': {
      const ch = state.ownedCharacters.find(c => c.characterId === condition.characterId);
      return ch ? ch.affinity >= condition.minValue : false;
    }
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
