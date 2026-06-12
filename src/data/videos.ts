import content from '@/content/videos.json';
import type { Condition } from '@/engine/types';

export interface VideoEntry {
  id: string;
  title: string;
  description: string;
  /** 视频文件（与 story 二选一） */
  src?: string;
  /** 图文记述：视频素材到位前的正式回放形态，立绘 + 分段文字 */
  story?: {
    image?: string;
    paragraphs: string[];
  };
  unlockConditions?: Condition[];
}

export const videos = (content as { videos: VideoEntry[] }).videos;

export function getVideoById(id: string) {
  return videos.find((v) => v.id === id);
}
