import content from '@/content/characters.json';
import type { Character } from './types';

export type { Character } from './types';

export const ACTIVE_CHARACTER_IDS = [
  'suli',
  'aruo',
  'sangluo',
  'aman',
  'shenzhaoning',
  'murongxue',
  'yunzhiyi',
  'linxia',
] as const;

const activeCharacterIdSet = new Set<string>(ACTIVE_CHARACTER_IDS);

export const allCharacters = (content as { characters: Character[] }).characters;

export const characters = allCharacters.filter((c) => activeCharacterIdSet.has(c.id));

export function isActiveCharacterId(id: string): boolean {
  return activeCharacterIdSet.has(id);
}

export function getCharacterById(id: string): Character | undefined {
  return allCharacters.find((c) => c.id === id);
}

export function getCharactersByRarity(rarity: Character['rarity']): Character[] {
  return characters.filter((c) => c.rarity === rarity);
}
