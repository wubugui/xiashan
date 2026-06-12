import { allCharacters, ACTIVE_CHARACTER_IDS } from '@/data/characters';
import { assetUrl } from './assets';

const BG_FILES = [
  'apartment_night', 'office_interview', 'office_corner', 'office_lobby',
  'apartment_sunset', 'slum_room', 'mountain_night', 'city_day',
  'office_late_night', 'office_night', 'chapter1', 'phone_wechat',
  'city_night', 'office', 'teahouse',
];

const FACE_EXPRESSIONS = ['avatar', 'smile', 'shy', 'laugh', 'angry', 'cry', 'calm'];

const STORAGE_KEY = 'xsAssetVersion';

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
  // Dev mode: skip preloading, instant pass-through
  if (import.meta.env.DEV) {
    onProgress(1, 1);
    return;
  }

  // Step 1: fetch server manifest (always validate, never use cache)
  let serverVersion = '';
  try {
    const manifestUrl = assetUrl('/asset-manifest.json');
    const res = await fetch(manifestUrl!, { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json() as { version: string };
      serverVersion = data.version;
    }
  } catch {
    // manifest missing or network error: fall through to full download
  }

  // Step 2: compare to locally stored version
  let storedVersion = '';
  try { storedVersion = localStorage.getItem(STORAGE_KEY) ?? ''; } catch {
    storedVersion = '';
  }

  if (serverVersion && storedVersion === serverVersion) {
    // Assets unchanged — browser HTTP cache is still valid, skip downloads
    onProgress(1, 1);
    return;
  }

  // Step 3: version mismatch (or no manifest) — force-download all assets
  const urls = gatherUrls();
  let loaded = 0;
  onProgress(0, urls.length);

  await Promise.all(
    urls.map(async (url) => {
      try {
        // cache:'reload' bypasses stale cache and writes fresh copy back
        await fetch(url, { cache: 'reload' });
      } catch {
        // silently skip — missing asset shouldn't block the game
      }
      onProgress(++loaded, urls.length);
    }),
  );

  // Step 4: persist new version so next launch skips downloads
  if (serverVersion) {
    try { localStorage.setItem(STORAGE_KEY, serverVersion); } catch {
      // Storage can be unavailable in private modes; downloads already finished.
    }
  }
}
