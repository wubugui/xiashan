import content from '@/content/videos.json';
import type { Condition } from '@/engine/types';

export interface VideoEntry {
  id: string;
  title: string;
  description: string;
  src: string;
  unlockConditions?: Condition[];
}

export const videos = (content as { videos: VideoEntry[] }).videos;

export function getVideoById(id: string) {
  return videos.find((v) => v.id === id);
}
