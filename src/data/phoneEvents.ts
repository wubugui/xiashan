import content from '@/content/phone-events.json';
import type { PhoneEvent } from './types';

export type { PhoneEvent } from './types';

export const phoneEvents = (content as { phoneEvents: PhoneEvent[] }).phoneEvents;

export function getPhoneEventById(id: string): PhoneEvent | undefined {
  return phoneEvents.find((e) => e.id === id);
}

export function getPhoneEventsByCharacter(characterId: string): PhoneEvent[] {
  return phoneEvents.filter((e) => e.characterId === characterId);
}
