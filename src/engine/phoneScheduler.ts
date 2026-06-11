import { phoneEvents, PhoneEvent } from '../data/phoneEvents';
import { evaluateAll } from './conditionEngine';

interface PlayerStateForScheduler {
  spiritStones: number;
  reputation: number;
  ownedCharacters: { characterId: string; level: number }[];
  affinityMap: Record<string, number>;
  relationshipStages: Record<string, number>;
  completedNodes: string[];
  flags: string[];
  triggeredEventIds: string[];
}

export function checkPhoneEvents(state: PlayerStateForScheduler): PhoneEvent[] {
  return phoneEvents.filter(event =>
    !state.triggeredEventIds.includes(event.id) &&
    evaluateAll(event.triggerConditions, state)
  );
}
