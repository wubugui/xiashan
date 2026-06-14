import content from '@/content/characters.json';
import type { Character } from './types';
import { waifeConfigCharacters, configuredIds } from '@/data/waifes';

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

// 「一角色一配置」的角色用配置铺出的 Character 覆盖旧 characters.json 同 id 项（单一数据源）
const legacyCharacters = (content as { characters: Character[] }).characters.filter((c) => !configuredIds.has(c.id));
export const allCharacters: Character[] = [...waifeConfigCharacters, ...legacyCharacters];

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
