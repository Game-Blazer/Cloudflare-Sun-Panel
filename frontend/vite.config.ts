import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2022',
    cssCodeSplit: true,
    minify: 'esbuild',
    cssMinify: 'esbuild',
    chunkSizeWarningLimit: 500,
    sourcemap: false,
    reportCompressedSize: false,
    assetsInlineLimit: 4096,
    modulePreload: {
      polyfill: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'naive-ui': ['naive-ui'],
          'draggable': ['vue-draggable-plus'],
          'vue-vendor': ['vue', 'vue-router', 'pinia', 'vue-i18n'],
          'axios': ['axios'],
          'dompurify': ['dompurify'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
  },
})