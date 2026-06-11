import raw from '@/content/commissions.json';
import { isActiveCharacterId } from '@/data/characters';
import type { Commission } from '@/data/types';

export const allCommissions: Commission[] = raw.commissions as Commission[];

export const commissions: Commission[] = allCommissions.filter((c) => isActiveCharacterId(c.target));

export function getCommissionById(id: string): Commission | undefined {
  return allCommissions.find((c) => c.id === id);
}
