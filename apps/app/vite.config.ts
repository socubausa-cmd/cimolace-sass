import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Multi-page : index.html (LIRI/OS par défaut) + prorascience.html (host prorascience.org,
      // META SEO statiques pour crawlers/scrapers no-JS). Les deux chargent le MÊME SPA (main.tsx).
      input: {
        main: path.resolve(__dirname, 'index.html'),
        prorascience: path.resolve(__dirname, 'prorascience.html'),
        cimolace: path.resolve(__dirname, 'cimolace.html'),
      },
      output: {
        // Isole les vendors lourds de node_modules en chunks séparés (cache long-terme,
        // sous-pages /t/isna plus légères). On ne regroupe QUE du node_modules — jamais
        // de code app — sinon le lazy-loading des routes /t/isna serait cassé.
        manualChunks(id: string) {
          if (!id.includes('node_modules/')) return undefined;
          const inMod = (name: string) => id.includes('node_modules/' + name);

          if (inMod('three/')) return 'vendor-three';
          if (inMod('@react-three/') || inMod('@splinetool/')) return 'vendor-react-three';
          if (inMod('framer-motion/')) return 'vendor-framer-motion';
          if (inMod('gsap/') || inMod('@gsap/')) return 'vendor-gsap';
          // Mermaid dépend aussi de d3. Les séparer créait un cycle d'initialisation
          // vendor-charts ↔ vendor-mermaid qui faisait crasher tout le bootstrap.
          if (
            inMod('recharts/') || inMod('victory-vendor/') || inMod('d3-') ||
            inMod('reactflow/') || inMod('@reactflow/') || inMod('mermaid/') ||
            inMod('katex/') || inMod('cytoscape') || inMod('dagre')
          ) return 'vendor-diagrams';
          if (inMod('konva/') || inMod('react-konva/')) return 'vendor-konva';
          if (inMod('pdfjs-dist/')) return 'vendor-pdfjs';
          if (inMod('jspdf')) return 'vendor-jspdf';
          if (inMod('@react-pdf/') || inMod('react-pdf/')) return 'vendor-react-pdf';
          if (inMod('pdfmake/')) return 'vendor-pdfmake';
          if (inMod('pptxgenjs/')) return 'vendor-pptxgenjs';
          if (inMod('xlsx/')) return 'vendor-xlsx';
          if (inMod('livekit-client/') || inMod('@livekit/')) return 'vendor-livekit';
          if (inMod('react-dom/') || inMod('scheduler/') || inMod('react/')) return 'vendor-react';

          return undefined;
        },
      },
    },
  },
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
