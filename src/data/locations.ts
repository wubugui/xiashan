import raw from '@/content/locations.json';
import type { GameLocation } from '@/data/types';

export const locations: GameLocation[] = raw.locations as GameLocation[];

export function getLocationById(id: string): GameLocation | undefined {
  return locations.find((l) => l.id === id);
}
