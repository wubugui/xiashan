import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(here, 'story-editor-src'),
  base: '/story-dist/',
  plugins: [react()],
  build: {
    outDir: path.resolve(here, 'story-editor-dist'),
    emptyOutDir: true,
  },
});
