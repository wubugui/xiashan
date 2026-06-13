import { assetUrl } from '@/lib/assets';
import { pauseBackgroundMusic, resumeBackgroundMusic } from '@/lib/backgroundMusic';

const VOICE_REASON = 'gacha-voice';
const VOICE_VOLUME = 0.92;

let currentVoice: HTMLAudioElement | null = null;
let currentSrc = '';

function pickVoice(voiceUrls: string[]) {
  if (voiceUrls.length === 1) return voiceUrls[0];
  return voiceUrls[Math.floor(Math.random() * voiceUrls.length)];
}

export function stopGachaVoice() {
  if (!currentVoice) return;
  currentVoice.pause();
  currentVoice.currentTime = 0;
  currentVoice = null;
  currentSrc = '';
  resumeBackgroundMusic(VOICE_REASON);
}

export function playGachaVoice(voiceUrls?: string[]) {
  if (!voiceUrls || voiceUrls.length === 0 || typeof Audio === 'undefined') return;

  const src = assetUrl(pickVoice(voiceUrls));
  if (!src) return;

  stopGachaVoice();
  const voice = new Audio(src);
  currentVoice = voice;
  currentSrc = src;
  voice.volume = VOICE_VOLUME;
  voice.preload = 'auto';

  const release = () => {
    if (currentVoice === voice && currentSrc === src) {
      currentVoice = null;
      currentSrc = '';
      resumeBackgroundMusic(VOICE_REASON);
    }
  };

  voice.addEventListener('ended', release, { once: true });
  voice.addEventListener('error', release, { once: true });

  pauseBackgroundMusic(VOICE_REASON);
  voice.play().catch(release);
}
