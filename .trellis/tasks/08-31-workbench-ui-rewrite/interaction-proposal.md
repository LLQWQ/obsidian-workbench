# 工作台 UI 重设计方案（评审稿 v1）

> 依据：`research/workbench-interaction-inventory.md`（现状盘点）+ `research/animal-island-capability-map.md`（组件能力图）
> 本文档是**评审稿**：第 11 章列出全部待拍板决策点，每条附推荐与取舍。评审通过后决策落入 prd.md / design.md。

---

## 1. 重写边界（先定什么不动）

**数据层整体冻结**：`vault.js`(34 个 store 方法)、`todoParser.js`（双模式解析）、vault 内全部文件格式（00_待办.md / 读书卡 / CSV / 新闻契约）一字不动。重写范围 = 呈现与交互层：`App.svelte`、四个 `*Tab.svelte`、`WikiText/Heatmap` 等纯展示组件、`app.css`。

**为什么**：盘点发现的 7 条 parser/store 硬约束（detectMode 结构判定、标题前 20 字 + @c 定位、写穿自触 reload、@r/@x 自动维护等）全部在数据层。冻结数据层后，重写可用「同数据、新旧 UI 对比」直接验证，风险边界清晰。任何需要动数据层的想法（如编辑标题、任务 uid）一律出 scope。

**旧 UI 元素零保留（用户裁定 2026-08-31）**：视觉与交互语言 100% 重建于 animal-island 体系。仙鹤 logo、DM Serif 词标、DoodleBackground、Hatch 色板、`.tab-btn`/`.card`/`.btn-mint`/`.task-check`/`.dash-frame`/`.wb-modal`/`.swash`/`.wb-corner-danger` 等全部旧类随重写删除，`app.css` 重写为「animal tokens 映射 + 作用域基础 + 少量自绘件」。仅两类保留**功能**但视觉全部重绘：WikiText（双链/tag 渲染）与 Heatmap/折线/容量条（数据可视化）——组件库无对应物，属功能而非旧元素沿用。

---

## 2. 信息架构（外壳）

### 2.1 导航

- 四个顶级分区不变：**待办 / 读书 / 新闻 / 健康**（顺序按使用频率调整：待办、读书、新闻、健康）。
- 顶栏：左侧「阿斌工作台」词标（Nunito 900 大字或 Title ribbon 组件，**仙鹤 logo 退役**），右侧日期 Tag。
- 导航控件：自绘分段控件（animal tokens 配色），**不用库 Tabs**——原因见 2.2。

### 2.2 keep-alive 页签（修痛点 #7）

现状 `{#if}` 切页签整树重挂载，录入框、滚动位置、弹窗、筛选态全丢。
方案：**懒挂载 + 隐藏保活**——首次切到才挂载，之后 `display:none` 隐藏不卸载。四个 tab 的 `onChange` 订阅常驻（路径前缀过滤，开销可忽略）。
推论：库 Tabs 组件自己掌管面板渲染、切走即卸载，与保活冲突，故外壳导航自绘；这也是全项目统一的做法——**所有「视图切换」都用同一个自绘分段控件**（待办子视图、读书子页签同理），各面板状态由父组件持有。

### 2.3 布局

- 桌面（≥900px）：内容区 `max-w-[1100px]`，主列 + **右侧信息栏**（详见待办设计）。
- 移动端：单栏，信息栏降为底部卡片区；继续避让 `--obsidian-mobile-navbar-h`。
- 全局滚动条保持隐藏（现状约定），弹层内部允许滚动条。

---

## 3. 视觉方向

### 3.1 调色板：整体切换到 animal tokens

| 现状（Hatch 手绘） | 切换后（animal） | 用途 |
|---|---|---|
| cream-paper `#f5f4f0` | `--animal-bg-color #f8f8f0` | 页面底 |
| ink-black 文字 | `--animal-text-color #794f27` 动森棕 | 正文 |
| mint `#99ffcc` 主色 | `--animal-primary-color #19c8b9` 湖水绿 | 主按钮/完成态/链接 |
| 1px 黑边 + 禁阴影 | 2px 棕边 + 柔和阴影 + 16-24px 大圆角 | 卡片/按钮 |

语义色映射：完成=primary teal，等待=warning 黄，冻结=app-blue，删除/逾期=error 红，#工作标签=brown/purple。A 股涨跌两色（红涨绿跌）为新闻/健康领域色，保留并挂到 animal 中性变量旁。

### 3.2 字体

- 全量 animal 字体：Nunito + Noto Sans SC 自托管子集（woff2 base64 内联）。
- **DM Serif Display 退役**（含本地 woff2 资产删除）；词标「阿斌工作台」改用 Nunito 900 / Title ribbon 呈现，全部衬线用法废除。

### 3.3 装饰

- **舍弃 DoodleBackground**（170 行漂浮贴纸）——用户裁定（零旧 UI 元素）。装饰由 animal 体系承担：Card pattern、Divider 波浪线、BackTop Nook 袋。
- 仙鹤 logo 一并退役（用户裁定）。

### 3.4 Tailwind 去留

**保留 Tailwind v4（无 preflight）**做布局胶水，`@theme` 色板重映射到 `var(--animal-*)`，utility 类直接吃组件库调色板。零迁移风险，布局代码不膨胀。注意：保留的是工具链而非旧样式——全部旧自定义类（`.card`/`.tab-btn`/`.btn-mint`/`.task-check`/`.dash-frame`/`.wb-modal`/`.swash`/`.wb-corner-danger` 等）随重写删除。

---

## 4. 全局交互模型（统一四个 tab 的"系统动作"）

现状四套各自为政的 tip / loading / 空态 / 删除确认，统一为：

| 场景 | 现状 | 重写后 |
|---|---|---|
| 操作成功提示 | 自研 tip 条 ×3 种文案 | `Notification.success`（命令式，2.5s，动森气泡） |
| 操作失败 | 整屏红卡替换列表 | `Notification.error` + 原界面保持，关键加载失败给 dashed Card + 重试 Button |
| 加载中 | 四种文案各不同 | `Skeleton`（按各 tab 内容形状：任务行/卡片网格/图表） |
| 空态 | dash-frame 手绘虚线框 | `Card type="dashed"` + 统一文案语气 |
| 详情弹层 | `.wb-modal` 自研 | `Drawer`（桌面右侧/移动端底部，`pushBackground={false}`，ESC/遮罩关闭） |
| 删除确认 | 三种（弹窗二次/角标 3s 脉冲） | 统一**二次确认 Button**（点一次变红「再点确认」，3s 复位）——保留角标脉冲的防误触精神，收敛实现 |
| 反馈文案 | 散落各组件 | 集中一个 `feedback.js`（成功/失败文案表） |

技术要点（来自能力图，非决策点）：Drawer/Modal portal 到 body，在 `.workbench-root` 之外，scoped 样式需用 `[class^='animal-']` 选择器覆盖 portal 内容；Modal 默认打字机效果与详情场景不符（详情用 Drawer，不受影响）；Collapse 只能非受控，需要受控的折叠（待办池）继续自绘 chevron 卡。

---

## 5. 待办页（核心，改动最大）

### 5.1 结构

```
┌ 头部条:日期 · 今日进度 Progress(x/y) · 标签筛选 · 回收站入口(计数徽标) ┐
├ 子视图分段控件:[日 | 周 | 等待 | 统计] ──────────────────────────────┤
│ 主列                              │ 右侧信息栏(桌面)               │
│ · 日视图:今天列表 + 池折叠卡       │ · 完成热力图卡(点击出明细)      │
│ · 周视图:本周计划 + 本周已完成     │ · 滚动曝光榜(≥7天,常显)        │
│ · 等待视图:等待中 + 冻结          │ · 本周/本月完成计数             │
│ · 统计视图:月完成大数字 + 日均等    │   (移动端降为底部卡片)          │
├ 录入行(sticky 底部):承诺日 chip + Input + 记下 Button ─────────────┤
```

关键变化：

1. **回收站提到头部**：垃圾桶图标 Button + 计数徽标，点开右侧 Drawer 列出回收站条目（删除线标题 + 删除日期 + 恢复 Button）。修痛点 #4（藏深）。回收站 Drawer 是**唯一从任何子视图都可达**的入口。
2. **曝光榜常显**：从月视图底部提到右侧信息栏（桌面），移动端在统计视图。上榜任务点击直接开任务 Drawer。修痛点 #5。
3. **热力图常显**：不再挤在主列顶部，入右侧栏。点击格子出当日完成明细（Tooltip/小卡）。
4. **子任务可见**：任务行标题旁加 `n/m` 子任务进度 Tag（block 里有子任务时）。修痛点 #6。
5. **徽章减负**：单行最多 2 个状态 Tag（优先级：临期 > 等待/冻结 > 滚动 Dn > @r×N），#标签用最小号 soft Tag。其余信息收进 Drawer。修痛点 #14。
6. **录入行沉底 sticky**：不再随列表滚动流失；承诺日 chip（今天/明天/本周/池）用可选中 Tag 组。
7. **快捷改期**：任务行 hover/聚焦出现改期图标钮，点出 `DatePicker` 下拉改 @p（自动 @r+1 是 store 行为，不变）。修痛点 #2（改 @p 三步）。

### 5.2 任务详情 Drawer（替代现弹窗）

- 桌面右侧 420px / 移动端底部 80vh，`pushBackground={false}`。
- 区块：标题与元数据（@c/@d/@p/@w/@h/@due/@r → Tag 组）→ 描述（WikiText）→ 块内容（续行 + 子任务 Checkbox 列表，三层缩进）→ 操作区（冻结/解冻、转等待/解除、降级回池、取消 → Button 组，危险操作二次确认）→ 承诺日/截止日（两个 `DatePicker`，$bindable）→ 备注 Input（追加 `MM-DD 动作:备注`）→ 删除（二次确认，提示移入回收站）。
- 双链/tag 点击行为不变（stopPropagation + openWikiLink 新页签）。

### 5.3 双模式（legacy/fields）统一 ← 决策点

**推荐：单套 UI + 模式适配层**。新 UI 只说 fields 词汇（日/周/等待/池/回收站/统计）；legacy 文件经适配层映射渲染（legacy 三区 → 日/周/池，操作 dispatch 到 `moveTask/setTaskHold/cancelTask`），界面上仅保留一个「旧格式」Tag 提示。用户感知不到两套系统，数据层不动。
备选：legacy 只读横幅（「旧格式，建议迁移」），功能砍半——更省事但老文件变残废。

### 5.4 保留的既有行为

乐观勾选（toggle 先翻转失败回滚）、过夜自动归档、标签筛选（含自动回「全部」、只收窄工作视图不收窄统计）、热力图 20 周、曝光榜 7 天阈值与排序、录入提示语。

---

## 6. 读书页

IA 不变（队列/在读/档案/感想 四子页 + 计数），交互收敛：

1. **卡片**：`Card hoverable` + 封面换 `Image` 组件（自带点击放大预览，无封面时保留 pastel 色块 + 首字——色板换 animal 12 色）。类型/状态 chip → `Tag`（想读 app-blue / 在读 app-teal / 已读 default / 弃读 app-orange；书 peach 系 / 文章 sky 系）。
2. **详情弹窗 → Drawer**：同待办规格。进度区：§3 说明组件库**没有 Slider**——改为 `Progress` 展示 + ±10 Button（现状行为）+ 直接数字 Input 三种手段，去掉原生 range slider。← 决策点
3. **评分**：三个可选中 Tag（强推/可读/不推荐），再点取消（现状行为保留）。
4. **摘录/感想编辑器**：条目行 + 行内 Input 编辑 + 删除（现状逻辑），样式换 Input/Button/Tag；追加用 Input + Button。
5. **搜索**：`Input` prefix 搜索图标 + `allowClear`；过滤 chip → Tag 组。
6. **摄取控制**：✨/排队中/已摄取三态保留，实现换 Button/Tag + Loading 小图标；排队中点击取消（幂等）行为保留。
7. **删除**：卡片角标与 Drawer 内删除统一为二次确认 Button（3s 复位），文案保留「文章卡和全文一起删，不可恢复」。
8. **关联两栏**（摄取/相关待办）：保留，虚线框换 `Card type="dashed"`。

## 7. 新闻页

1. 头部：日期翻页 chip → 可选中 Tag 组（7 日 + 当日高亮），契约待落 → dashed Card。
2. 卡流：封面 → `Image lazy`（无图保留 pastel 首字色块），tldr line-clamp 保留。
3. **三入口合并**（修痛点 #8）：点卡片 = 展开/收起内嵌阅读器（去掉独立「阅读」钮）；卡上两个图标钮 =「原文」（外链，有 sourceUrl 时）+「在 Obsidian 打开」（有 sourceFile 时），Tooltip 说明。内嵌阅读器样式保留（cream 底 + pre-wrap + max-h 内滚）。
4. 加载 → Skeleton 卡片网格。

## 8. 健康页

1. 训练热力图 + 点击明细：保留自绘 SVG（组件库无热力图），色阶换 teal 五档，圆角加大。
2. 今日面板：大数字保留自绘（组件库无 Statistic；Wallet 语义不符不用），补录表单换 `Form` + `Input`×2 + `Button`（数值校验：禁逗号——CSV 约束）。
3. 8 周容量条 + 体重折线：保留自绘，配色入 animal 板。
4. **「本期计划」占位卡：舍弃**（纯占位无功能，等活活方案落地时再以真实功能回归）。← 决策点

## 9. 组件映射总表

| 用途 | 组件 | 备注 |
|---|---|---|
| 卡片容器 | Card（12 色 + dashed） | 全部 tab |
| 按钮 | Button（primary/danger/loading/size） | 全部写操作 |
| 录入 | Input（prefix/suffix/allowClear） | 录入行/搜索/备注 |
| 日期 | DatePicker（$bindable value） | @p/@due 编辑、快捷改期 |
| 详情弹层 | Drawer（pushBackground=false） | 任务详情/卡详情/回收站 |
| 反馈 | Notification（命令式） | 成功/失败提示 |
| 加载 | Skeleton | 各 tab 形状 |
| 进度 | Progress | 今日进度/读书进度 |
| 标签 | Tag（4 variant × 12 色，onclick 可选中） | 筛选/状态/评分/日期翻页 |
| 勾选 | Checkbox | 任务/子任务（乐观更新逻辑自留） |
| 表单 | Form/FormItem | 健康补录、Drawer 内编辑区 |
| 悬浮说明 | Tooltip | 图标钮释义 |
| 封面图 | Image（preview） | 读书/新闻封面 |
| 标题 | Title（ribbon 飘带） | 各卡标题点缀 |
| 分隔 | Divider（wave/dashed） | 卡内分区 |
| 回顶 | BackTop（Nook 袋） | 长列表（可选彩蛋） |
| 自绘重绘 | Heatmap(SVG)/体重折线/容量条/分段控件 | 组件库无对应物；功能保留、视觉按 animal 语言重绘 |

不用：Tabs（与 keep-alive 冲突）、Modal（Drawer 替代）、Collapse（需受控）、Loading 全屏（过重）、Switch/Radio/Select/Carousel/Countdown/Cursor/Time*/Typewriter/CodeBlock/Table/Phone/Footer/Wallet/Icon（本场景无需求）。

## 10. 重写节奏（分期）← 决策点

推荐四期，每期可独立验收、可日常使用：

- **0 期（前置）**：当前未提交的标签筛选功能提交发版（v0.5.1）——旧 UI 收官。
- **1 期｜外壳与接入**：`link:` 依赖接入、tokens/字体 scoped 引入、Tailwind 色板重映射、keep-alive 导航、Notification/Skeleton/空态/二次确认全局件、四 tab 用最简迁移先跑通（可先素面）。
- **2 期｜待办重写**：第 5 章全部内容（含右侧栏、回收站 Drawer、模式适配层）。
- **3 期｜读书重写**：第 6 章。
- **4 期｜新闻 + 健康 + 收尾**：第 7/8 章 + 视觉走查 + 移动端走查。

对应 Trellis 结构：本任务为父任务，1-4 期各建子任务（子任务 2/3/4 依赖 1 的接入件，写入各自 implement.md）。

## 11. 待拍板决策点汇总

| # | 决策 | 推荐 | 不选推荐的代价 |
|---|---|---|---|
| D1 | 数据层整体冻结 | ✅ 冻结 | 解冻则每个改动需单独论证 + 回归测试面暴增 |
| D2 | legacy 模式：单套 UI + 模式适配层 | ✅ 适配层 | 只读横幅 = 老文件半残；保持双套 = 重写双倍工作量 |
| D3 | keep-alive 页签（懒挂载 + 隐藏保活） | ✅ 保活 | 不保活则录入丢态痛点延续 |
| D4 | 详情弹窗 → Drawer | ✅ Drawer | Modal 默认打字机动画不适合详情；自绘弹窗则浪费组件库 |
| D5 | 回收站提为头部 Drawer 入口 | ✅ 提级 | 保持底部折叠则痛点 #4 延续 |
| D6 | 桌面右侧信息栏（热力图 + 曝光榜常显） | ✅ 右栏 | 单长列 + 桌面留白痛点延续 |
| D7 | DoodleBackground 舍弃 | **已裁定：舍弃**（用户「零旧 UI 元素」指令 2026-08-31） | — |
| D8 | 词标衬线与仙鹤 | **已裁定：全舍弃**（同上）；词标改 Nunito 900 / Title ribbon | — |
| D9 | Tailwind 保留（色板重映射 animal） | ✅ 保留 | 手写 CSS 则布局代码量翻倍，无收益 |
| D10 | 健康「本期计划」占位卡舍弃 | ✅ 舍弃 | 保留则继续占一张死卡 |
| D11 | 读书进度去 slider（Progress + ±10 + 数字 Input） | ✅ 去 slider | 组件库无 Slider，自绘滑杆与整体风格违和 |
| D12 | 新闻三入口合并为「点卡展开 + 两图标钮」 | ✅ 合并 | 三入口语义重复痛点延续 |
| D13 | 四期分期重写（父任务 + 4 子任务） | ✅ 分期 | 一次性重写 = 单次验收面过大，中间不可回退 |

## 12. 风险与对策

| 风险 | 对策 |
|---|---|
| animal reset.css 全局 `* box-sizing` 污染宿主 | 不整体引 `./style`；vite alias 拆引 tokens.css + fonts.css，box-sizing 在 `.workbench-root` 与 `[class^='animal-']`（覆盖 portal）范围内自补 |
| 中文字体 woff2 超 100KB 内联阈值 | `assetsInlineLimit` 提至 ~6MB；styles.css 增大约 1-2MB，首装后 Obsidian 缓存可接受；备选只引拉丁字体、中文回落系统字 |
| Drawer portal 到 body 的样式/滚动锁/层级 | 全局 z-index 约定（Drawer 1001 < Notification 2000），移动端验证 mobile-navbar 避让；`pushBackground={false}` 固定写死 |
| lib dist 需随源码重建 | `link:../animal-island-svelte` + 文档化「改库后 `pnpm build`」；库 dist 当前新鲜（08-31 构建） |
| 库已知缺陷（Cursor/cursor.css dist 缺失等） | 本方案不用 Cursor；Table.fixed、FormItem.dependencies 未实现的功能不依赖 |
| keep-alive 常驻订阅开销 | 四 tab onChange 为路径前缀过滤，实测验证冷启动与切换耗时 |

---

## 附：功能保留/变更/舍弃清单（lossless 对照）

**保留**（行为不变，仅换皮/换位）：四 tab 全部数据能力、乐观勾选、过夜归档、标签筛选、热力图点击明细、曝光榜规则、录入行模式提示、任务全生命周期操作、读书摄取三态、评分/进度/摘录/感想、搜索过滤、关联两栏、新闻历史翻页与内嵌阅读器、健康补录与图表、双链/tag 渲染与新页签打开、移动端 navbar 避让、滚动条隐藏约定。

**变更**（行为等价，交互形态变）：弹窗→Drawer、tip→Notification、loading 文案→Skeleton、dash-frame→dashed Card、删除三态→统一二次确认、徽章数量收敛、录入行沉底、回收站入口提级、曝光榜/热力图入右栏、新闻入口合并、读书 slider→三件套。

**舍弃**：DoodleBackground、仙鹤 logo、DM Serif 词标与全部衬线用法、Hatch 色板与全部旧自定义类（.tab-btn/.card/.btn-mint/.task-check/.dash-frame/.wb-modal/.swash/.wb-corner-danger）、健康「本期计划」占位卡、原生 range slider、「@p 模式」灰色小字（由「旧格式」Tag 取代，仅 legacy 显示）。

**新增**（纯交互层，不动数据层）：子任务 n/m 进度标、任务行快捷改期 DatePicker、回收站计数徽标、keep-alive 页签、BackTop 彩蛋（可选）。
