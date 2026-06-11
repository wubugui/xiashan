import { create } from 'zustand';
import { StoryNode } from '../data/storyChapters';

interface StoryState {
  isPlaying: boolean;
  currentNode: StoryNode | null;
  isTransitioning: boolean;
  showGacha: boolean;
  showFaceSlap: boolean;
  currentFaceSlap: StoryNode['faceSlap'] | null;
  phoneNotification: StoryNode['phoneNotify'] | null;

  startStory: () => void;
  stopStory: () => void;
  setCurrentNode: (node: StoryNode) => void;
  setTransitioning: (val: boolean) => void;
  setShowGacha: (val: boolean) => void;
  setShowFaceSlap: (val: boolean, data?: StoryNode['faceSlap']) => void;
  setPhoneNotification: (val: StoryNode['phoneNotify'] | null) => void;
}

export const useStoryStore = create<StoryState>()((set) => ({
  isPlaying: false,
  currentNode: null,
  isTransitioning: false,
  showGacha: false,
  showFaceSlap: false,
  currentFaceSlap: null,
  phoneNotification: null,

  startStory: () => set({ isPlaying: true }),
  stopStory: () => set({ isPlaying: false }),
  setCurrentNode: (node) => set({ currentNode: node }),
  setTransitioning: (val) => set({ isTransitioning: val }),
  setShowGacha: (val) => set({ showGacha: val }),
  setShowFaceSlap: (val, data) => set({ showFaceSlap: val, currentFaceSlap: data || null }),
  setPhoneNotification: (val) => set({ phoneNotification: val }),
}));
