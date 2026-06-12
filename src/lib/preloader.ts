import { allCharacters, ACTIVE_CHARACTER_IDS } from '@/data/characters';
import { assetUrl } from './assets';

const BG_FILES = [
  'apartment_night', 'office_interview', 'office_corner', 'office_lobby',
  'apartment_sunset', 'slum_room', 'mountain_night', 'city_day',
  'office_late_night', 'office_night', 'chapter1', 'phone_wechat',
  'city_night', 'office', 'teahouse',
];

const FACE_EXPRESSIONS = ['avatar', 'smile', 'shy', 'laugh', 'angry', 'cry', 'calm'];

function gatherUrls(): string[] {
  const urls = new Set<string>();

  for (const char of allCharacters) {
    const p = assetUrl(char.portraitUrl);
    const a = assetUrl(char.avatarUrl);
    if (p) urls.add(p);
    if (a) urls.add(a);
    if (char.gachaPortraitUrl) {
      const g = assetUrl(char.gachaPortraitUrl);
      if (g) urls.add(g);
    }
  }

  for (const id of ACTIVE_CHARACTER_IDS) {
    for (const expr of FACE_EXPRESSIONS) {
      const u = assetUrl(`/characters/face/${id}/${expr}.png`);
      if (u) urls.add(u);
    }
  }

  for (const bg of BG_FILES) {
    const u = assetUrl(`/bg/${bg}.svg`);
    if (u) urls.add(u);
  }

  const ll = assetUrl('/characters/ll.png');
  if (ll) urls.add(ll);

  return [...urls];
}

export async function preloadAllAssets(
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  const urls = gatherUrls();
  let loaded = 0;
  onProgress(0, urls.length);

  await Promise.all(
    urls.map(async (url) => {
      try {
        // cache:'reload' forces a network fetch (bypasses stale cache) and
        // writes the fresh response back to the HTTP cache for this session.
        await fetch(url, { cache: 'reload' });
      } catch {
        // silently skip — missing asset shouldn't block the game
      }
      onProgress(++loaded, urls.length);
    }),
  );
}
