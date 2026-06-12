import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { Plugin } from 'vite';

const ASSET_EXTS = new Set(['.svg', '.png', '.jpg', '.webp']);
// These subdirs contain source/unused files and are not preloaded
const EXCLUDE_DIRS = new Set(['source', 'setting', 'video']);

function assetManifestPlugin(): Plugin {
  function generate() {
    const hasher = createHash('sha256');
    const files: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!EXCLUDE_DIRS.has(entry.name)) walk(full);
        } else if (ASSET_EXTS.has(extname(entry.name).toLowerCase())) {
          files.push(full);
        }
      }
    }

    walk('public');
    files.sort();
    for (const f of files) hasher.update(readFileSync(f));

    const version = hasher.digest('hex').slice(0, 12);
    writeFileSync('public/asset-manifest.json', JSON.stringify({ version }));
    console.log(`[asset-manifest] version=${version} (${files.length} assets)`);
  }

  return {
    name: 'asset-manifest',
    buildStart: generate,
    configureServer() { generate(); },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/xiashan/' : '/',
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    assetManifestPlugin(),
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }), 
    tsconfigPaths()
  ],
})
