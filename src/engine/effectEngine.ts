import { Effect } from './types';

interface PlayerStateForEffect {
  spiritStones: number;
  reputation: number;
  ownedCharacters: { characterId: string; level: number; exp: number }[];
  affinityMap: Record<string, number>;
  completedNodes: string[];
  flags: string[];
  phoneMessages: { id: string; characterId: string; type: 'wechat' | 'sms'; content: string; timestamp: number; read: boolean }[];
  unreadCounts: { wechat: number; sms: number; call: number };
}

export function executeEffect(effect: Effect, state: PlayerStateForEffect): PlayerStateForEffect {
  switch (effect.type) {
    case 'add_spirit_stones':
      return { ...state, spiritStones: state.spiritStones + effect.value };
    case 'add_reputation':
      return { ...state, reputation: state.reputation + effect.value };
    case 'add_affinity':
      return {
        ...state,
        affinityMap: {
          ...state.affinityMap,
          [effect.characterId]: (state.affinityMap[effect.characterId] ?? 0) + effect.value,
        },
      };
    case 'add_exp':
      return {
        ...state,
        ownedCharacters: state.ownedCharacters.map(c =>
          c.characterId === effect.characterId ? { ...c, exp: c.exp + effect.value } : c
        ),
      };
    case 'set_flag':
      return state.flags.includes(effect.flag) ? state : { ...state, flags: [...state.flags, effect.flag] };
    case 'unlock_chapter':
      return state; // chapters are unlocked by flags
    case 'trigger_phone_event':
      return state; // handled separately
    case 'trigger_face_slap':
      return state; // handled separately
  }
}

export function executeAll(effects: Effect[], state: PlayerStateForEffect): PlayerStateForEffect {
  return effects.reduce((s, e) => executeEffect(e, s), state);
}
