import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

// 默认产物落 dist/;本地「build 即装 vault」用环境变量覆盖:
//   PLUGIN_DIR=/path/to/vault/.obsidian/plugins/workbench pnpm build
const PLUGIN_DIR = process.env.PLUGIN_DIR || 'dist'

// PLUGIN_DIR 直装模式:emptyOutDir 会清空插件目录,build 完必须把 manifest.json 补回去,
// 否则 Obsidian 不认这个插件(命令消失/插件消失)
const copyManifest = {
  name: 'copy-manifest',
  closeBundle() {
    if (process.env.PLUGIN_DIR) {
      fs.copyFileSync('manifest.json', path.join(PLUGIN_DIR, 'manifest.json'))
    }
  },
}

export default defineConfig({
  base: './',
  plugins: [svelte(), tailwindcss(), copyManifest],
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
