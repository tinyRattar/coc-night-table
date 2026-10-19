import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
  root: 'standalone', base: './', publicDir: resolve('public'), plugins: [react()],
  envDir: resolve('.'), build: { outDir: resolve('dist/pages'), emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
