# 1期:外壳与组件库接入(animal-island)

> 父任务:`08-31-workbench-ui-rewrite`(prd/design/implement/interaction-proposal 与 research/ 均为本任务的规格来源)。
> **依赖**:无(0 期 v0.5.1 发版完成后开工,由父任务编排)。

## Goal

交付可日常使用的素面外壳:animal-island-svelte 组件库全量接入,App 外壳重写为 keep-alive 四分区导航,四 tab 功能临时可用(允许旧逻辑+新皮肤过渡,本期不做交互重设计)。

## Requirements

- S1 `package.json` 加 `link:../animal-island-svelte`;`pnpm install`;vite.config.js 配 alias 拆引 tokens/fonts,`assetsInlineLimit: 6_000_000`
- S2 `app.css` 整体重写:引 animal tokens/fonts、scoped box-sizing(`.workbench-root` + `[class^='animal-']` 覆盖 portal)、Tailwind `@theme` 色板重映射到 `var(--animal-*)`、删除全部旧自定义类
- S3 新建 `src/lib/ui/`:SegmentedNav / ConfirmButton / EmptyCard / feedback.js / StatDigit
- S4 App.svelte 重写:词标「阿斌工作台」(Nunito 900 / Title ribbon)+ 右侧日期 Tag + keep-alive 导航(懒挂载 + hidden 保活);桌面 `max-w-[1100px]`,移动端单栏避让 `--obsidian-mobile-navbar-h`
- S5 四 tab 临时适配:最小改动跑通(旧结构去旧类,套 animal Card/Button),不做交互重设计
- S6 删除 DoodleBackground/Crane 引用与资产、DM Serif woff2
- S7 数据层零改动(vault.js/todoParser.js 冻结)

## Acceptance Criteria

- [ ] `pnpm build` 通过
- [ ] 父任务 AC2:`grep -r "tab-btn\|btn-mint\|task-check\|dash-frame\|wb-modal\|swash\|cream-paper\|mint-splash\|DoodleBackground\|Crane\|DM Serif" src/` 为空
- [ ] 父任务 AC8:宿主设置页/侧边栏/其他插件目视无样式回归
- [ ] 父任务 AC1 的 keep-alive 部分:四 tab 切换录入态/滚动保留
- [ ] 父任务 AC3:`git diff` 中 vault.js/todoParser.js 零改动
- [ ] 回滚点落盘:单独 commit + release v0.6.0

## 风险文件

`app.css`(宿主污染唯一入口)、`vite.config.js`(inline 阈值→styles.css 体积)。

## Out of Scope

各 tab 的交互重设计(2/3/4 期)、模式适配层、Drawer 化。
