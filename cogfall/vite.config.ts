import { defineConfig } from 'vite';

// `base: './'` ensures the built `assets/main-[hash].js` and CSS resolve under
// any deploy path. Cogfall ships at /games/cogfall/dist/ behind a Traefik
// stripPrefix, so relative asset paths are the safe default.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
