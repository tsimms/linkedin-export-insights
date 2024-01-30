import { defineConfig } from 'vite';

export default defineConfig({
  base: '/linkedinsight/',
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'service-worker': ['gql-intercept.js'],
        },
      },
    },
  },
});
