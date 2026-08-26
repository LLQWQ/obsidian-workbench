# 阿斌工作台 (obsidian-workbench)

个人 Obsidian 工作台插件:单视图四 tab —— **待办 / 新闻 / 读书 / 健康**,写穿式直连 vault 事实源文件。

- 技术栈:Svelte 5 + Tailwind v4 + Vite,全本地零 CDN(字体内联)
- Hatch 风:cream paper 底 + 白卡 1px 黑边 + pastel 四色 + Lucide 图标
- 数据契约:各 tab 读写 vault 内约定路径(`wiki/00_待办.md`、`wiki/新闻/data/`、`wiki/读书/`、`wiki/健康/data/`),本仓库插件按此 vault 结构工作

## 用 BRAT 安装(手机/桌面通用)

1. Obsidian 里装社区插件 **BRAT**(Beta Reviewers Auto-update Tester)并启用
2. BRAT 设置 → `Add Beta plugin` → 填 `LLQWQ/obsidian-workbench` → 选 latest version
3. 装完在「社区插件」里启用「阿斌工作台」,点左侧 ribbon 小鸟图标打开

## 本地开发

```bash
pnpm install
pnpm build                                  # 产物落 dist/
PLUGIN_DIR=/path/to/vault/.obsidian/plugins/workbench pnpm build   # build 即装 vault
```

## 发版(BRAT 靠 GitHub Release 安装)

tag 必须等于 manifest.json 的 version(不带 v 前缀),release 挂 `main.js`/`manifest.json`/`styles.css` 三个资产:

```bash
pnpm build
gh release create 0.1.1 dist/main.js dist/styles.css manifest.json --title 0.1.1
```
