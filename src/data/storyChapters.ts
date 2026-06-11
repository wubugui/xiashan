import content from '@/content/story.json';
import type { StoryChapter, StoryNode } from './types';

export type { StoryChapter, StoryNode } from './types';

export const chapters = (content as { chapters: StoryChapter[]; nodes: StoryNode[] }).chapters;
export const storyNodes = (content as { chapters: StoryChapter[]; nodes: StoryNode[] }).nodes;

export function getChapterById(id: number): StoryChapter | undefined {
  return chapters.find((c) => c.id === id);
}

export function getNodesByChapter(chapterId: number): StoryNode[] {
  return storyNodes.filter((n) => n.chapterId === chapterId);
}

export function getNodeById(id: string): StoryNode | undefined {
  return storyNodes.find((n) => n.id === id);
}
