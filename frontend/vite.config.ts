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
    // 模块预加载策略：使用 polyfill 并限制预加载数量，避免首屏时过多请求
    modulePreload: {
      polyfill: true,
      resolveDependencies: (filename, deps) => {
        // 只预加载当前路由直接依赖的 chunk，而非全部
        return deps.slice(0, 3)
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'naive-ui': ['naive-ui'],
          'draggable': ['vue-draggable-plus'],
          'vue-core': ['vue', 'vue-router', 'pinia'],
          'vue-i18n': ['vue-i18n'],
          'utils': ['axios', 'dompurify'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
      treeshake: {
        preset: 'recommended',
      },
    },
  },
})