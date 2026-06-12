import { allCharacters, ACTIVE_CHARACTER_IDS } from '@/data/characters';
import { locations } from '@/data/locations';
import { chapters, storyNodes } from '@/data/storyChapters';
import { assetUrl } from './assets';
import { SCENE_BACKDROPS } from './pageBackdrops';

type ManifestAsset = string | {
  path?: string;
  hash?: string;
  bytes?: number;
};

type AssetManifest = {
  version?: string;
  assets?: ManifestAsset[];
};

type PreloadAsset = {
  path: string;
  url: string;
  hash?: string;
};

const LEGACY_BG_FILES = [
  'apartment_night', 'office_interview', 'office_corner', 'office_lobby',
  'apartment_sunset', 'slum_room', 'mountain_night', 'city_day',
  'office_late_night', 'office_night', 'chapter1', 'phone_wechat',
  'city_night', 'office', 'teahouse',
];

const FACE_EXPRESSIONS = ['avatar', 'smile', 'shy', 'laugh', 'angry', 'cry', 'calm'];

const STORAGE_KEY = 'xsAssetVersion';
const HASH_STORAGE_KEY = 'xsAssetHashes';
const CSS_URL_RE = /url\((['"]?)(\/[^'")]+)\1\)/g;

function normalizeLocalPath(path?: string | null): string | undefined {
  if (!path || /^(https?:|data:|blob:)/.test(path)) return undefined;
  return path.startsWith('/') ? path : `/${path}`;
}

function toPreloadAsset(path?: string | null, hash?: string): PreloadAsset | undefined {
  const normalizedPath = normalizeLocalPath(path);
  if (!normalizedPath) return undefined;

  const url = assetUrl(normalizedPath);
  return url ? { path: normalizedPath, url, hash } : undefined;
}

function addAsset(assets: Map<string, PreloadAsset>, path?: string | null): void {
  const asset = toPreloadAsset(path);
  if (asset) assets.set(asset.url, asset);
}

function addCssBackgroundAssets(assets: Map<string, PreloadAsset>, value?: string | null): void {
  if (!value) return;

  CSS_URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CSS_URL_RE.exec(value)) !== null) {
    addAsset(assets, match[2]);
  }
}

function gatherFallbackAssets(): PreloadAsset[] {
  const assets = new Map<string, PreloadAsset>();

  for (const char of allCharacters) {
    addAsset(assets, char.portraitUrl);
    addAsset(assets, char.avatarUrl);
    addAsset(assets, char.gachaPortraitUrl);
    addAsset(assets, char.gachaBackgroundUrl);
    Object.values(char.expressionUrls ?? {}).forEach((url) => addAsset(assets, url));
  }

  for (const id of ACTIVE_CHARACTER_IDS) {
    for (const expr of FACE_EXPRESSIONS) {
      addAsset(assets, `/characters/face/${id}/${expr}.png`);
    }
  }

  for (const bg of LEGACY_BG_FILES) {
    addAsset(assets, `/bg/${bg}.svg`);
  }

  Object.values(SCENE_BACKDROPS).forEach((backdrop) => {
    addAsset(assets, backdrop.image);
    addAsset(assets, backdrop.mobileImage);
  });

  locations.forEach((location) => addCssBackgroundAssets(assets, location.bg));
  chapters.forEach((chapter) => addAsset(assets, chapter.backgroundUrl));
  storyNodes.forEach((node) => addAsset(assets, node.backgroundUrl));

  addAsset(assets, '/characters/ll.png');

  return [...assets.values()];
}

function assetsFromManifest(manifest: AssetManifest): PreloadAsset[] {
  const assets = new Map<string, PreloadAsset>();

  for (const entry of manifest.assets ?? []) {
    const path = typeof entry === 'string' ? entry : entry.path;
    const hash = typeof entry === 'string' ? undefined : entry.hash;
    const asset = toPreloadAsset(path, hash);
    if (asset) assets.set(asset.url, asset);
  }

  return [...assets.values()];
}

function readStoredVersion(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function readStoredHashes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(HASH_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, string>
      : {};
  } catch {
    return {};
  }
}

function writeStoredVersion(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // Storage can be unavailable in private modes; downloads already finished.
  }
}

function writeStoredHashes(hashes: Record<string, string>): void {
  try {
    localStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(hashes));
  } catch {
    // Storage can be unavailable in private modes; downloads already finished.
  }
}

function allManifestHashesReady(assets: PreloadAsset[], hashes: Record<string, string>): boolean {
  return assets.every((asset) => !asset.hash || hashes[asset.path] === asset.hash);
}

function manifestHashMap(assets: PreloadAsset[]): Record<string, string> {
  return Object.fromEntries(
    assets
      .filter((asset): asset is PreloadAsset & { hash: string } => Boolean(asset.hash))
      .map((asset) => [asset.path, asset.hash]),
  );
}

export async function preloadAllAssets(
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  if (import.meta.env.DEV) {
    onProgress(1, 1);
    return;
  }

  let serverVersion = '';
  let manifestAssets: PreloadAsset[] = [];

  try {
    const manifestUrl = assetUrl('/asset-manifest.json');
    if (manifestUrl) {
      const res = await fetch(manifestUrl, { cache: 'no-cache' });
      if (res.ok) {
        const manifest = await res.json() as AssetManifest;
        serverVersion = typeof manifest.version === 'string' ? manifest.version : '';
        manifestAssets = assetsFromManifest(manifest);
      }
    }
  } catch {
    serverVersion = '';
    manifestAssets = [];
  }

  const storedVersion = readStoredVersion();
  const storedHashes = readStoredHashes();
  const hasManifestHashes = manifestAssets.some((asset) => Boolean(asset.hash));

  if (
    serverVersion
    && storedVersion === serverVersion
    && (!hasManifestHashes || allManifestHashesReady(manifestAssets, storedHashes))
  ) {
    onProgress(1, 1);
    return;
  }

  const preloadAssets = manifestAssets.length > 0 ? manifestAssets : gatherFallbackAssets();
  const assetsToDownload = hasManifestHashes
    ? preloadAssets.filter((asset) => !asset.hash || storedHashes[asset.path] !== asset.hash)
    : preloadAssets;

  if (assetsToDownload.length === 0) {
    if (serverVersion) writeStoredVersion(serverVersion);
    if (hasManifestHashes) writeStoredHashes(manifestHashMap(preloadAssets));
    onProgress(1, 1);
    return;
  }

  let loaded = 0;
  let failed = false;
  const downloadedHashes = new Map<string, string>();
  onProgress(0, assetsToDownload.length);

  await Promise.all(
    assetsToDownload.map(async (asset) => {
      try {
        const res = await fetch(asset.url, { cache: 'reload' });
        if (!res.ok) {
          failed = true;
        } else if (asset.hash) {
          downloadedHashes.set(asset.path, asset.hash);
        }
      } catch {
        failed = true;
      }
      onProgress(++loaded, assetsToDownload.length);
    }),
  );

  if (hasManifestHashes) {
    const nextHashes = { ...storedHashes };
    downloadedHashes.forEach((hash, path) => {
      nextHashes[path] = hash;
    });

    if (allManifestHashesReady(preloadAssets, nextHashes)) {
      writeStoredHashes(manifestHashMap(preloadAssets));
      if (serverVersion) writeStoredVersion(serverVersion);
    } else {
      writeStoredHashes(nextHashes);
    }
  } else if (serverVersion && !failed) {
    writeStoredVersion(serverVersion);
  }
}
