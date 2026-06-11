import content from '@/content/characters.json';
import type { Character } from './types';

export type { Character } from './types';

export const characters = (content as { characters: Character[] }).characters;

export function getCharacterById(id: string): Character | undefined {
  return characters.find((c) => c.id === id);
}

export function getCharactersByRarity(rarity: Character['rarity']): Character[] {
  return characters.filter((c) => c.rarity === rarity);
}
