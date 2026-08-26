import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// 默认产物落 dist/;本地「build 即装 vault」用环境变量覆盖:
//   PLUGIN_DIR=/path/to/vault/.obsidian/plugins/workbench pnpm build
const PLUGIN_DIR = process.env.PLUGIN_DIR || 'dist'

export default defineConfig({
  base: './',
  plugins: [svelte(), tailwindcss()],
  build: {
    outDir: PLUGIN_DIR,
    emptyOutDir: true,
    assetsInlineLimit: 100_000, // 字体 base64 内联进 styles.css,零路径问题
    cssCodeSplit: false,
    minify: false,
    sourcemap: true,
    lib: {
      entry: 'src/main-obsidian.js',
      formats: ['cjs'],
      fileName: () => 'main.js',
      cssFileName: 'styles', // Obsidian 插件样式固定文件名 styles.css
    },
    rollupOptions: {
      external: ['obsidian'], // 运行时由 Obsidian 提供
    },
  },
})
