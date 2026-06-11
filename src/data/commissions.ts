import raw from '@/content/commissions.json';
import type { Commission } from '@/data/types';

export const commissions: Commission[] = raw.commissions as Commission[];

export function getCommissionById(id: string): Commission | undefined {
  return commissions.find((c) => c.id === id);
}
