import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@isna/ui': path.resolve(__dirname, '../../packages/ui/src'),
      'react-helmet': 'react-helmet-async',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Résolution tenant (fetchTenantContext → NestJS /tenants/public/:slug)
      '/tenants': {
        target: 'http://localhost:4002',
        changeOrigin: true,
      },
    },
  },
});
