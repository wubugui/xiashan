import raw from '@/content/serviceCards.json';
import type { ServiceCard } from '@/data/types';

type RawData = { skills: ServiceCard[]; tools: ServiceCard[]; infos: ServiceCard[] };
const data = raw as unknown as RawData;

export const allSkills: ServiceCard[] = data.skills;
export const allTools: ServiceCard[] = data.tools;
export const allInfos: ServiceCard[] = data.infos;
export const allServiceCards: ServiceCard[] = [...data.skills, ...data.tools, ...data.infos];
