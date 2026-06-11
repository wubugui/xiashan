import data from '../content/sideJobs.json';
import type { SideJob } from './types';

export const sideJobs = data.sideJobs as SideJob[];

export function getSideJobById(id: string): SideJob | undefined {
  return sideJobs.find(j => j.id === id);
}
