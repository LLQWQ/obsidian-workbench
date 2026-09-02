# Design: 工作台 UI 重写(animal-island)

> 需求见 `prd.md`;交互方案见 `interaction-proposal.md`;事实依据见 `research/` 两份文档。本文档只记技术设计:接入机制、CSS 架构、组件架构、数据流、兼容性、回滚。

## 1. 组件库接入

### 1.1 依赖方式

`package.json` 加 `"animal-island-svelte": "link:../animal-island-svelte"`(pnpm link 协议,入 package.json 可复现)。
- 消费的是库的 `dist/`(svelte-package 产物,.svelte 源形态)——本仓库已有 `svelte@^5.38` + `@sveltejs/vite-plugin-svelte@^6`,满足下游编译要求
- **约束**:改库源码后必须在库仓库跑 `pnpm build` 刷新 dist,否则工作台看不到变更(类比 v0.4.4 发版资产陈货事故)。写入 README 或 AGENTS.md

### 1.2 样式引入(核心设计:scoped 拆引)

不引 `./style` 整体(含全局 `* box-sizing`,有污染宿主风险)。vite.config.js 加 alias 拆引:

```js
resolve: {
  alias: {
    'animal-tokens': path.resolve('../animal-island-svelte/dist/styles/tokens.css'),
    'animal-fonts': path.resolve('../animal-island-svelte/dist/styles/fonts.css'),
  },
}
```

`src/app.css` 顶部 `@import 'animal-tokens'; @import 'animal-fonts';`(fonts.css 内 `url('../assets/fonts/*.woff2')` 由 vite 解析,`assetsInlineLimit` 提至 `6_000_000` 保证中文子集内联)。

reset.css 不引,其作用域化自补:

```css
/* 工作台面内 + animal portal 内容(Modal/Drawer/Notification/Image-preview 挂 body) */
.workbench-root, .workbench-root *, .workbench-root *::before, .workbench-root *::after,
[class^='animal-'], [class^='animal-'] *, [class^='animal-'] *::before, [class^='animal-'] *::after {
  box-sizing: border-box;
}
/* reset.css 的 [class^='animal-'] 字体/颜色规则同样自补(font-family 用 var(--animal-font-family),注意其值带 !important 属声明级,直接引用即可) */
```

`[class^='animal-']` 全局选择器只命中组件库元素(宿主 Obsidian 无此前缀类),无污染。

### 1.3 Tailwind 重映射

`@theme` 色板改为引用 animal 变量:

```css
@theme {
  --color-primary: var(--animal-primary-color);
  --color-paper: var(--animal-bg-color);
  --color-ink: var(--animal-text-color);
  /* 语义色:完成=primary,等待=warning,冻结=#7bbbff→animal 蓝系,删除/逾期=error */
  /* 领域色保留:A股红涨 #d6455f / 绿跌 #2f9e6b(新闻/健康专用,不入 animal tokens) */
}
```

保留 `@import "tailwindcss/theme.css" layer(theme)` + `utilities.css`(无 preflight)的现状机制。

### 1.4 z-index 约定

库内:Modal 1000 / Drawer 1001 / Notification 2000。工作台自绘层(头部条/sticky 录入行)用 < 1000;不在 1000+ 区间自绘。Notification 永远最顶,保证写操作反馈不被 Drawer 遮挡。

## 2. 外壳架构(keep-alive)

```svelte
<!-- App.svelte 新结构 -->
<div class="workbench-root">
  <header>词标(Nunito 900 / Title ribbon) + 日期 Tag</header>
  <SegmentedNav bind:value={tab} items={...} />   <!-- 自绘分段控件,animal tokens -->
  {#each tabs as t}
    <div style:display={tab === t.key ? '' : 'none'}>
      {#if visited.has(t.key)}
        <svelte:component this={t.component} {store} />
      {/if}
    </div>
  {/each}
</div>
```

- `visited = $state(new Set(['todo']))`:懒挂载,首次切到才挂载,之后常驻
- `onChange` 订阅常驻四个 tab(路径前缀过滤,开销可忽略;2 期验收实测冷启动)
- Svelte 5 中动态组件用 `{@const}` + 直接渲染(`<t.component />`,Svelte 5 组件即值,无需 svelte:component)
- 移动端避让 `--obsidian-mobile-navbar-h` 的现有机制(main-obsidian.js 测量)不动

### SegmentedNav(自绘分段控件)

全项目统一的视图切换控件(顶导航、待办子视图、读书子页签、新闻日期翻页同款):pill 容器(2px 边、大圆角、paper 底)+ 选中项(primary 底 + 白字 + `--animal-shadow-sm` + 150ms ease)。键盘 roving tabindex(对齐库 Tabs 的 a11y 行为)。

## 3. 组件架构

### 3.1 目录

```
src/lib/
  ui/                  # 新增:本插件自绘组合件(非库)
    SegmentedNav.svelte
    ConfirmButton.svelte   # 二次确认(点一次变红「再点确认」,3s 复位;替代三种旧确认)
    StatDigit.svelte       # 大数字(健康今日面板/月完成)
    Heatmap.svelte         # 重绘(自原 lib/Heatmap.svelte 移入重绘)
    WikiText.svelte        # 重绘样式(自原 lib/ 移入)
    Feedback.js            # Notification 封装 + 文案表
    EmptyCard.svelte       # Card dashed 空态封装
  TodoTab.svelte ...       # 四 tab 重写(大文件拆分,见 3.2)
  vault.js / todoParser.js # 冻结,零改动
```

### 3.2 TodoTab 拆分(726 行 → 目录)

```
src/lib/todo/
  TodoTab.svelte      # 容器:数据订阅、视图派生、状态持有
  TodoHeader.svelte   # 日期 + Progress + 标签筛选 + 回收站入口
  TodoViews.svelte    # 日/周/等待/统计 四面板 + 右侧信息栏布局
  TaskRow.svelte      # Checkbox + 标题(WikiText)+ n/m + ≤2 状态 Tag + 快捷改期
  TaskDrawer.svelte   # 详情 Drawer 全部区块
  TrashDrawer.svelte  # 回收站 Drawer
  QuickEntry.svelte   # sticky 录入行
  todoActions.js      # 模式适配层(见 4.2)
```

ReadingTab 同理拆 `reading/`(Card 网格 snippet、DetailDrawer、EntryEditor、IngestBadge)。News/Health 单文件可容(139/211 行级),重写后不拆目录。

### 3.3 响应式断点

沿用 `md:`(768px)。桌面 ≥900px 待办页出右侧信息栏(`min-[900px]:grid-cols-[1fr_300px]`),移动端信息栏降为底部卡片。Drawer `placement`:桌面 right,移动 bottom——用 matchMedia 派生。

## 4. 数据流与契约

### 4.1 不变部分(冻结)

store API(34 方法)、`onChange(cb)` 订阅、`keyOf = title|created`、写穿时序(写完立即 emit → 组件 reload)、`ensureArchived` 过夜归档。组件层继续用 keyOf 维系 openTask 等本地引用。

### 4.2 模式适配层(todoActions.js)

UI 操作词汇统一为 fields 语义,适配层按 `mode` dispatch:

| UI 动作 | fields | legacy |
|---|---|---|
| 勾选 | `toggleTask` | 同 |
| 冻结/解冻 | `taskAction(t,'hold'/'unhold')` | `setTaskHold` |
| 转等待/解除 | `taskAction(t,'wait'/'unwait')` | 不支持(按钮隐藏) |
| 降级回池 | `taskAction(t,'pool')` | `moveTask(t,'pool')` |
| 取消 | `taskAction(t,'cancel')` | `cancelTask` |
| 改承诺日 | `setTaskPromise` | 不支持(隐藏,legacy 无 @p) |
| 改截止日 | `setTaskDue` | 同 |
| 删除/恢复 | `deleteTask`/`restoreTask` | `deleteTask`(无回收站视图,弹确认文案不同) |

视图派生:fields 用 `deriveViews`;legacy 映射 `{today: section=today, week: section=week 未完, pool: section=pool 未完}`,等待/冻结/回收站面板在 legacy 下显示「旧格式不支持」空态或隐藏(实现时取最简单:隐藏 + 头部「旧格式」Tag)。

### 4.3 乐观更新

仅 toggle 保留现状乐观模式(先翻转失败回滚)。其余写操作 pessimistic + Button `loading` 态(busy 锁演化而来)。

## 5. 各页设计落点

以 `interaction-proposal.md` 第 5-8 章为准,补充技术要点:

- **待办右侧栏**:桌面 grid 侧栏 sticky top;热力图点击明细用侧栏内小卡(非 Tooltip,内容太长);曝光榜条目点击开 TaskDrawer
- **快捷改期**:TaskRow hover 出图标钮 → 行内展开 DatePicker(不 portal,相对定位,注意列表 overflow 裁剪 → 行内容器 `overflow:visible`)
- **子任务 n/m**:`t.block` 递归数 sub 总数与 mark='x'/'X' 数
- **Drawer 表单区**:`Form` 水平布局,DatePicker $bindable + 存/清 Button;备注 Input 回车提交
- **读书 Image 封面**:`preview={true}`(portal 放大),无封面走 pastel 色块(animal 12 色板取 4)+ 首字 Nunito 900
- **新闻阅读器**:保留 max-h 内滚;卡点击展开用自绘过渡(Collapse 非受控不可用)
- **健康 Form**:数值校验 rule(pattern 禁逗号、数字),`onFinish` 写穿

## 6. 兼容性与回滚

- **数据兼容**:零迁移。新旧 UI 可同 vault 互换(数据层未动)
- **宿主兼容**:AC8 走查清单(Obsidian 设置页/文件管理器/其他插件/移动端工具栏)
- **库版本耦合**:link 到本地库 dist;库升级破坏性变更时工作台锁定在旧 dist(link 协议下即不回动库仓库)
- **回滚单位**:每期一个 release tag(v0.6.x 外壳 / v0.7.x 待办 / v0.8.x 读书 / v0.9.x 新闻健康);单期回滚 = revert 该期提交,vault 数据无损
- **0 期前置**:当前工作树标签筛选功能先提交发版 v0.5.1(旧 UI 收官),重写从干净树开始

## 7. 验证命令

```bash
pnpm build                                    # 类型/编译
grep -rE "tab-btn|btn-mint|task-check|dash-frame|wb-modal|swash|cream-paper|mint-splash|DoodleBackground|Crane|DM Serif" src/   # 须为空(AC2)
git diff --stat src/lib/vault.js src/lib/todoParser.js        # 须为空(AC3)
PLUGIN_DIR=<vault>/.obsidian/plugins/workbench pnpm build     # 装真 vault 目视走查 AC1/AC4-AC8
```
