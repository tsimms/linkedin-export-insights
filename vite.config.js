import { defineConfig } from 'vite';

export default defineConfig({
  base: '/linkedinsight/',
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    },
  },
});
