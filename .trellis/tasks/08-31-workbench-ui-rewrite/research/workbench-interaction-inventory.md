# Research: 工作台 UI/交互全量盘点（重写前库存）

- **Query**: 为 UI 全量重写收集现有四个 tab + 外壳 + 数据层的所有用户可见能力与交互模式
- **Scope**: internal（src/ 全量 + manifest.json）
- **Date**: 2026-08-31
- **当前版本**: `manifest.json:4` → `0.5.0`（阿斌工作台，`isDesktopOnly: false`，需双端可用）
- **工作树状态**: `TodoTab.svelte` / `WikiText.svelte` / `todoParser.js` 有未提交改动，本文档以**工作树**为准

---

## 0. 外壳（App.svelte + app.css）

### 0.1 布局骨架 `src/App.svelte`

| 元素 | 行为 | 锚点 |
|---|---|---|
| 根容器 | `.workbench-root` 奶油底（`bg-cream-paper`）+ `DoodleBackground` 贴纸层（z-0，pointer-events-none） | `App.svelte:25-26` |
| 内容限宽 | `max-w-[960px] mx-auto px-4 md:px-6`，居中 | `App.svelte:27` |
| 顶栏 | 左：仙鹤 SVG（34px）+「阿斌工作台」衬线标题；右：mint 色日期 chip（`MM-DD 周X`） | `App.svelte:29-37` |
| Tab 栏 | 四个 pill 按钮：待办 / 新闻 / 读书 / 健康（lucide 图标 + 中文 label，移动端 `max-md:` 缩小） | `App.svelte:40-46` |
| 内容区 | 单 tab 渲染（`{#if tab === ...}`），状态**不保留**，切 tab 重挂载子组件 | `App.svelte:49-59` |
| 默认 tab | `let tab = $state('todo')` → 进插件默认待办 | `App.svelte:11` |

**注意**：tab 切换是 `{#if}` 分支（非组件缓存），意味着切走再切回会重新执行 `onMount` → 重新 `reload()`，输入态/弹窗/滚动位置全丢。

### 0.2 设计 tokens `src/app.css`

- **Tailwind v4 无 preflight**：只 import `theme.css` + `utilities.css`，宿主 Obsidian 的 button/heading 规则被显式压制（`app.css:1-3, 70-87`）
- **色彩**：奶油纸 `#f5f4f0` / 纯黑墨 `#000` / mint `#99ffcc` / sky `#7bbbff` / peach `#ffcc99` / bubblegum `#ff99cc` / plum `#160042` / 丹顶红 `#e0393e` / 涨红 `#d6455f` / 跌绿 `#2f9e6b`（`app.css:17-35`）
- **字体**：`DM Serif Display`（本地 woff2，零外部请求）+ 系统中文衬线栈做 display；body 用系统 sans（`app.css:6-12, 38-39`）
- **圆角**：card 16px / btn 12px / pill 9999px
- **Hatch 招牌元素**：
  - `.swash` mint 手绘高亮涂抹（伪元素 blob，`app.css:125-145`）
  - `.card` 白底 + 1px 黑边 + 16px 圆角，**禁阴影**（`app.css:148-156`）
  - `.tab-btn` pill 白底黑边，active 时 mint 底加粗；`--sm` 小号变体（`app.css:90-106`）
  - `.btn-mint` mint 主按钮（`app.css:109-118`）
  - `.task-check` 20px 方 checkbox，done 时 mint 填色；`--sm` 16px 子任务版（`app.css:159-199`）
  - `.dash-frame` 虚线内框（空态/缺口通用）（`app.css:202-205`）
  - `.wb-modal-overlay` + `.wb-modal` 通用弹窗骨架（fixed inset-0 黑 45% 遮罩，居中 640px 限高 85vh 内滚）（`app.css:220-238`）
  - `.wb-corner-danger` 删除角标的确认态红脉冲动画（`app.css:241-247`）
- **滚动条全局隐藏**：`.workbench-root` 全子元素 + Obsidian leaf 容器（`app.css:213-217`）
- **移动端避让**：`.wb-content` 底部 padding 加 `--obsidian-mobile-navbar-h` 变量（`app.css:60-62`）

### 0.3 装饰组件

| 组件 | 行数 | 作用 |
|---|---|---|
| `Crane.svelte` | 29 | 仙鹤 mascot SVG（顶栏 logo） |
| `DoodleBackground.svelte` | 170 | 12 个手绘贴纸（花/星/心/金币/齿轮/云/闪电/纸飞机/彩点/太阳/小绿团），`@keyframes doodle-float` 上下漂，移动端 `max-md:hidden` 隐一半，`prefers-reduced-motion` 时停动画 |
| `Heatmap.svelte` | 60 | 通用格子热力图（12px cell + 3px gap，SVG），周一开头，近 N 周，mint 色阶 5 档阈值，click + Enter 键盘触发 `oncell`，selectedDate 黑描边，`<title>` 提示日期+值 |
| `WikiText.svelte` | 56 | 双链 + #tag 渲染器：`[[link]]` / `[[link\|alias]]` → `<a>` 可点，`#tag` → chip；点击 `stopPropagation`（不冒泡到任务行/卡片的开弹窗）；`#工作` 染深紫底 |

---

## 1. 待办 Tab（TodoTab.svelte，726 行）

### 1.1 模式分叉（lossless 关键）

文件 `wiki/00_待办.md` 双模式：`detectMode` 看有无 `## ` 分区头判定（`todoParser.js:10-12`）。
- **legacy**：三个固定分区（今天/本周/待办池），UI 走旧路径
- **fields**：字段驱动（@p/@w/@h/@x/@r），六视图派生

UI 用 `mode === 'fields'` 在录入行/弹窗/子 tab 处分叉渲染。**两套都活着**，重写时必须决定：保留双模 / 砍 legacy / 合并。

### 1.2 视图与子 tab

子 tab 是 `tab-btn tab-btn--sm` pill 组（`TodoTab.svelte:376-385`）：
- **legacy**: `[日 | 周 | 月]`
- **fields**: `[日 | 周 | 等待 | 月]`（多一个等待视图）

fields 模式还在子 tab 行尾挂「@p 模式」灰色标签提示用户当前是字段驱动（`:382`）。

### 1.3 热力图区（`TodoTab.svelte:350-373`）

- 标题「任务完成热力图 · 近 20 周 · 点击看明细」
- 数据源：`doneByDate`（@d 日期计数）
- 阈值 `[0, 1, 2, 4]` → 5 档色
- 点击格子 → `selectedDate` 切换（再点同格取消）
- 选中后下方浮出明细卡：日期 + 完成数 + 当日完成任务的标题列表（`Check` 图标 + title）；无完成任务时显示「该日无完成记录」

### 1.4 标签筛选行（`:387-396`）

- 只在 `allTags.length > 0` 时出现
- chip 组：`[全部] [#工作] [#xxx] ...`，「工作」固定排最前（`:246-249` 排序器）
- 选中再点取消（toggle）
- **只收窄工作视图**（日/周/池/等待/冻结 + 今日完成计数），不影响热力图/周月完成数/曝光榜/回收站（注释 `:243-244`）
- **自动回「全部」**：`$effect` 监听 `allTags`，筛选的标签消失时（任务删光/改标签）自动清 `tagFilter`（`:278-280`）

### 1.5 日视图（`:404-484`）

**「今天」卡：**
- 标题带 `Flame` 图标 + 右侧 mint 完成数徽章 `{doneCountToday}/{dayTotal}`
- 列表 = `dayTasks`（fields：@p=今天且无@d；legacy：section=today）
- 空态文案分模式：`fields` 提示「今天没有承诺任务」，legacy 提示「今天区空的」（`:414`）
- **录入行**（`:417-437`）：
  - fields：承诺日 chip `[今天|明天|本周|池]`，池=无@p
  - legacy：分区 chip `[今天|本周|待办池]`
  - 文本框 + mint「记下」按钮，回车也写穿
  - fields 提示「@c+@p」，legacy 只写 @c
  - 底部一行小字解释当前模式行为
- **「待办池」折叠卡**（`:441-458`）：
  - 默认收起，点头部行展开
  - 标题 `Inbox` 图标 + 右侧 `{n} 条` + 上下 chevron
  - 展开后列 `poolTasks` + 底部模式提示文案
- **「回收站」折叠卡（fields 专属，仅在有垃圾时渲染）**（`:460-483`）：
  - `Trash2` 图标 + `{n} 条` + chevron
  - 条目：删除线标题 + 删除日期（`t.deletedDate.slice(5)`）+ mint「恢复」按钮
  - 底部说明文案：「删除整块沉底带 @x 标记 · 恢复即清 @x 回活跃列表末尾」

### 1.6 周视图（`:485-506`）

两卡 grid：
- 「本周计划」：`weekPlan`（fields：@p∈本周或@due∈本周；legacy：section=week 且未完成）
- 「本周已完成」：计数器（大数字 mint-dim）+ 标题清单 + 完成日期（`MM-DD`）

### 1.7 等待视图（fields 专属，`:509-530`）

- 「等待中」卡：`Hourglass` 图标 + 计数
- 「冻结」卡：`Snowflake` 图标 + 计数
- 两张卡并列 grid，复用 `taskRow` snippet

### 1.8 月视图（`:533-556`）

- 「本月完成」卡：大数字 + 日均（`月累计 / parseInt(日)`）
- 「滚动任务曝光榜」卡：筛 `created >= 7 天前` 且 status 是 todo/hold，按天数倒序取前 10，每行 `D{days}` 大数字 + 标题 + `@c MM-DD`，点击开任务弹窗；空态显示「无滚动任务，干净利落 ✨」

### 1.9 任务行 snippet（`taskRow`，`:284-325`）

每行复用结构：
- 左侧 20px `.task-check`（`stopPropagation` 后调 `toggle`，**乐观更新** UI 立刻翻转，失败回滚——`:136-147`）
- 中间：标题（`WikiText` 渲染双链/tag，done 时删除线 + slate 色）+ 下方小字元数据行（`@c`、`@p`、`@w` 切片掉年份）
- 右侧徽章组（flex 排列，从上往下优先级）：
  - 标签 chip：`#tag`（`#工作` 是 plum-ink 深紫底白字，其他白底 slate 字）
  - 冻结：`sky-pop` 蓝底「冻结」
  - 已完成：`mint-splash` 绿底 `@d MM-DD`
  - 等待：`peach-pop` 橙底 + Hourglass 图标「等待」
  - 临期徽章 `dueBadge`：逾期/今天截止=红 `bg-rise`，D-3 内=橙 `bg-warn`（`:218-225`）
  - 滚动徽章：`roll >= 7 && !wait` → `peach-pop` 橙底「滚动 D{n}」
  - 再承诺徽章 `@r>=2` 橙 / `@r>=5` 红 + Repeat 图标 ×N（`:321-323`）

### 1.10 任务详情弹窗（`:559-723`）

通用 `.wb-modal-overlay` + `.wb-modal`：
- **打开方式**：点任务行 / 点曝光榜条目
- **关闭方式**：点遮罩 / 点右上 X / 按 Esc（`<svelte:window>` 全局监听，`TodoTab.svelte:726`）
- **标题区**：title（done 时删除线）+ 小字元数据行（区、@c、@d、@h、@due、@p、@w、@r）+ 标签 chip + 状态 chip + X 关闭钮
- **描述区**：`descOf(t)` 处理 `t.body`——去粗体标题、去 `@x(...)` 元数据、去前导破折号；渲染 `WikiText`
- **fields 块渲染**（`:594-599`）：父行下续行（text）+ 子任务（sub，递归 3 层，`depth * 18px` 缩进）；子任务复选框可勾写穿，独立操作不联动父
- **fields 状态操作区**（`:602-643`）：
  - 备注输入框（可选，写到任务块尾 `MM-DD 动作:备注`）
  - 按钮组：`冻结 ↔ 解冻`、`转等待 ↔ 解除等待`、`降级回池`（有 @p/@w/@h 时）、`取消`（二次确认后 [-] 留档）
- **fields 承诺日 @p 编辑**（`:645-657`）：date input + 存/清除按钮；改期自动 `@r` +1（`vault.js:289-307`）
- **legacy 操作区**（`:658-692`）：
  - 「移动到」：三个分区 chip 互移
  - `冻结 ↔ 解冻`、`取消`（二次确认）
- **@due 截止日**（双模式通用，`:694-706`）：date input + 存/清除
- **删除按钮**（`:709-719`）：二次确认，fields 模式提示「移入回收站,可恢复」

### 1.11 过夜自动归档（`:104-118`）

`ensureArchived` 在 `onMount` + `onChange` 后跑：扫 `todos` 找非已完成区的 `[x]` 且 `@d < today` 的任务，有则调 `store.archiveDone()` 整块移入 ✅区。`archiving` 守卫防重入。

### 1.12 状态守卫

- `busy` 锁：所有写操作期间禁用按钮
- `tip` 提示：2.5s 自动消失，mint 色 + Check 图标
- `error` 红色卡替代整个列表渲染

---

## 2. 读书 Tab（ReadingTab.svelte，614 行）

### 2.1 子页签

`[队列 | 在读 | 档案 | 感想]` 四个 pill，每个带计数小字（`:417-424`）。
- 队列 = 想读的书 + to-read 的文章混排
- 在读 = status='在读' 的书（**不含文章**，文章没有"在读"态）
- 档案 = 已读/弃读的书 + read/archived 的文章
- 感想 = 所有卡感想区的时间流

### 2.2 卡通用元素

**封面 snippet** `coverBlock`（`:194-202`）：
- 有 `c.cover` → `<img>` 用 `store.coverUrl`（Obsidian resourcePath）
- 无 → pastel 色块（4 色轮转：`#99ffcc #7bbbff #ffcc99 #ff99cc`），首字 26px 衬线
- 哈希：标题字符码累加取模

**删除角标 snippet** `cornerDelete`（`:205-215`）：
- 卡片右上 absolute 定位
- 常态：白底 + 红色 Trash2 图标
- 点一次 → 红实心 + `wb-corner-danger` 脉冲（3s 超时自动复位，`armDelete` 的 setTimeout）
- 再点 → 真删

**图标钮 snippet** `iconActs`（`:218-225`）：
- 「读全文」（有 `sourceFile` 时）→ `store.openPage` 开 raw 源文件
- 「打开卡」→ `store.openPage` 开卡 md

**摄取控制 snippet** `ingestCtl`（`:228-242`）——仅文章卡：
- 无 ingest → ✨ 图标钮，点了标 `pending`
- `pending` → bubblegum chip「排队中」+ LoaderCircle 旋转，**点击直接取消**（零确认，幂等）
- `ingested` → mint chip「已摄取」（只读）

**条目编辑 snippet** `entryEditor`（`:245-289`）：
- 通用「摘录」「感想」区
- 每条目：日期小字 + 内容 + Pencil 改 + X 删
- 改：`editing = ${path}|${heading}|${idx}` 三件套定位，行内 input 替换，回车或「存」提交，X 取消
- 删：直接删（无二次确认）
- 底部追加：input + mint「记下」按钮

### 2.3 卡详情弹窗 `detail` snippet（`:292-413`）

打开：点卡片任意位置（`toggleOpen`）；关闭：遮罩 / X / Esc。打开时同时 `store.getRelated(c)` 拉关联数据。

区块：
1. **头部**：title + 类型/作者/入列日期/读完日期 + 状态 chip（`chipColor`：想读=sky / 在读=mint / 已读=fog / 弃读=peach）
2. **书专属进度区**（`:307-333`）：
   - 进度条（2.5h mint 填充）
   - 在读时显示 `-10 / range slider / +10` 控件（range 5 步进，`accent-mint-splash`）
   - 评分三 chip：`[强推 | 可读 | 不推荐]`，可切换可取消（再点同 chip 清空）
3. **动作行**（`:335-377`）：
   - 「读全文」（有 sourceFile）
   - 「原文」（有 sourceUrl，`window.open` 新窗）
   - 摄取控制（article 专属）
   - 「放回队列」（已读/弃读/read/archived 状态）：书→想读 + 清 finished+progress；文章→to-read + 清 finished
   - 「打开卡」
   - 「删除」二次确认（提示文案分 kind：文章「卡和全文一起删，不可恢复」）
4. **摘录区 / 感想区**（复用 `entryEditor`）
5. **关联两栏**（`:384-411`）：
   - 左 dash-frame「摄取」：有 sourceCard 直链；否则看 `relatedMap.sources`（metadataCache 反向链接，type='source' 的 md）
   - 右 dash-frame「相关待办」：`00_待办.md` 里 title 带 `[[卡名]]` 的任务，✓/· 前缀区分完成

### 2.4 队列子页（`:437-484`）

- 头部说明：「想读的书 + 待读的文章混排 · clipper 剪藏自动入列 · 点开卡片记感想/标摄取」
- 「加书」输入框（自动剥 `《》` 书名号）+ mint「加书」按钮
- 三列网格（`md:grid-cols-3`，移动端单列），卡片：
  - 删除角标 + 封面（h-24）+ 类型 chip（书=peach / 文章=sky）+ 入列日期 + 标题（line-clamp-2）
  - 底部按钮：书=「开始读」（→ 在读 + started=today）；文章=「标已读」（→ read + finished=today）
  - 摄取控制 + 图标钮
- 空态 dash-frame 文案

### 2.5 在读子页（`:487-519`）

- 两列网格（`md:grid-cols-2`），大卡：
  - 删除角标 + 封面（h-28）
  - 标题 + 进度百分比大数字
  - 进度条 + 「开始于 {started}」
  - 按钮：`+10` / `读完 ✓`（mint 主色）/ `弃读` / 摄取 / 图标钮
- 空态 dash-frame

### 2.6 档案子页（`:521-573`）

- 头部：计数 chip `{YYYY} 已读 N 本 · M 篇`
- 搜索框（Search 图标内嵌）+ 过滤 chip `[全部|书|文章|弃读/归档]`
- 搜索范围：标题 + 感想文本 + 摘录文本（`:166-172`）
- 两列网格卡片（左 64px 窄封面 + 右内容）：
  - 类型 chip + 状态 chip + 评分加粗字 + 标题 + 读完日期/感想数
  - 「放回队列」快捷钮 + 摄取 + 图标钮
- 空态

### 2.7 感想子页（`:575-601`）

- 头部计数 + 说明「点徽章跳到对应的卡」
- 时间流卡（每条一卡）：日期 + 文本 + 底部类型 chip 按钮（点 `jumpTo` 切到对应子页并展开卡）

### 2.8 状态守卫

- `saving` 锁（写操作期间）
- `tip` 2.5s 自动消失
- `confirmDelete` 全局共享（path 标识，角标删除和弹窗删除用同一 state）

---

## 3. 新闻 Tab（NewsTab.svelte，139 行）

最简的 tab，纯消费契约 JSON：

### 3.1 头部卡

- 标题「AI 新闻」+ 日期/条数 chip（无数据时 bubblegum「契约待落」）
- 历史日期翻页：最近 7 天文件名翻页 chip（`MM-DD` 格式），当前 mint 加粗（`:66-78`）

### 3.2 加载/空态

- loading：「读取新闻契约 …」
- 无 news：dash-frame 文案解释「流水线每天早上 08:00 落契约到 `wiki/新闻/data/`」

### 3.3 新闻卡片流

- 两列网格（`md:grid-cols-2`，移动单列）
- 每卡：
  - 封面：有图 `loading="lazy"` + `onerror` 隐藏；无图 pastel 色块（4 色按索引轮转）+ 首字
  - 标题（line-clamp-2）+ 来源小字
  - tldr（默认 line-clamp-2，展开时全显）
  - 「阅读 ↔ 收起」按钮（BookOpen ↔ ChevronUp 图标互换）切换 `openIdx`
  - 「原文」按钮 `window.open`
  - 展开后内嵌阅读器：cream-paper 底，summary 加粗 + content `whitespace-pre-wrap` + `max-h-[45vh]` 内滚
- **无编辑/无写操作**，纯展示

### 3.4 数据契约

`store.getNews()` 返回 `{ date, items, file, history }`；`history` 是最近 7 个文件名（`vault.js:671-679`）。切日用 `store.getNewsByFile(file)`。

---

## 4. 健康 Tab（HealthTab.svelte，211 行）

### 4.1 布局

两列 grid（`md:grid-cols-2`），热力图和趋势占满两列（`md:col-span-2`）。

### 4.2 训练热力图卡（`:93-125`）

- 数据源：`heatData` = `byDate[d].volume`（kg 容量）
- 阈值 `[0, 3000, 5000, 7000]`（比待办的 `[0,1,2,4]` 高）
- 点击格子：显示当日明细卡（容量 kg + 时长 min + 按动作聚合的 sets/maxWeight）
- 空态「该日无训练」

### 4.3 今日面板卡（`:128-167`）

- 2×2 大数字格：体重 / 体脂 / 目标热量（空 —）/ 营养素目标（空 —）
- 小字提示：「目标值待活活出『本期计划』后填充」
- **补录表单**（dash-frame 内）：体重 input + 体脂 input + mint「记一笔」按钮，写穿 `body_metrics.csv`，2.5s 提示

### 4.4 本期计划卡（`:169-181`）

- 纯占位：bubblegum chip「待活活出方案」+ dash-frame 文案说明（名称/起止/周频次/饮食规则/体脂目标）
- **完全无功能**，等未来接入

### 4.5 趋势卡（`:183-210`）

- 左：近 8 周训练容量 bar chart（flex 等高条 + sky 蓝填充 + 黑描边圆角顶部，title 提示）
- 右：体重趋势 SVG polyline（≥2 条数据才画，否则 dash-frame「数据积累中(≥2 条出曲线)」）

---

## 5. 数据模型（todoParser.js）

### 5.1 任务对象 shape（fields 模式完整字段）

```js
{
  line: Number,          // 父行在文件中的行号
  endLine: Number,       // 块末行号（fields 专有，legacy = line）
  section: 'today'|'week'|'pool'|'done'|null,
  status: 'todo'|'done'|'cancelled'|'hold',
  title: String,         // 粗体 **XX** 或破折号前文本
  body: String,          // 完整父行原文
  tags: [String],        // #tag 数组（# 前须行首/空白，纯数字跳过）
  created: 'YYYY-MM-DD'|null,    // @c
  doneDate: 'YYYY-MM-DD'|null,   // @d
  holdDate: 'YYYY-MM-DD'|null,   // @h（有 = 冻结）
  due: 'YYYY-MM-DD'|null,        // @due
  promise: 'YYYY-MM-DD'|null,    // @p 承诺日（fields）
  wait: 'YYYY-MM-DD'|null,       // @w 等待日（fields）
  deletedDate: 'YYYY-MM-DD'|null,// @x 删除日（回收站）
  rePromise: Number,     // @r 再承诺计数
  block: [               // 块（fields 专有）
    { type:'text', text, line } |
    { type:'sub', mark:' '|'x'|'X'|'-', title, body, line, indent, children:[...] }
  ],
  waiting: String|null,  // 块内「等待：XX」文本抓取
}
```

legacy 任务会被补齐成同 shape（`block:[]`、`promise/wait/rePromise/waiting` 全空），UI 单一路径渲染（`todoParser.js:167-181`）。

### 5.2 全部 @字段语义

| 字段 | 含义 | 写入路径 |
|---|---|---|
| `@c(YYYY-MM-DD)` | 创建日 | `addTask` 必带（`vault.js:93`） |
| `@s(YYYY-MM-DD)` | started（parser 识别但 UI 不写） | `todoParser.js:34, 60` |
| `@d(YYYY-MM-DD)` | 完成日 | `toggleTask` 勾选时写入（`vault.js:60-74`） |
| `@h(YYYY-MM-DD)` | 冻结日（有 = hold） | `setTaskHold` / `taskAction('hold')` |
| `@due(YYYY-MM-DD)` | 硬截止 | `setTaskDue` |
| `@p(YYYY-MM-DD)` | 承诺日（fields） | `addTask`（fields 录入）/ `setTaskPromise` |
| `@w(YYYY-MM-DD)` | 等待日（fields） | `taskAction('wait')` |
| `@x(YYYY-MM-DD)` | 删除日（回收站） | `deleteTask` |
| `@r(N)` | 再承诺计数 | `setTaskPromise` 改期时自动 +1（`vault.js:299-303`） |

### 5.3 六视图派生规则（`deriveViews`，`todoParser.js:205-228`）

```
active(t) = status !== 'cancelled' && !deletedDate
today   = active && promise === todayS && !doneDate
week    = active && !doneDate && (inWeek(promise) || inWeek(due))
pool    = active && !promise && !wait && !holdDate && !doneDate
waiting = active && wait && !doneDate
hold    = active && holdDate && !doneDate
done    = doneDate && !deletedDate  → 按 doneDate 倒序
trash   = deletedDate               → 按 deletedDate 倒序
```

**关键约束**：取消（[-]）和删除（@x）的任务不进任何活跃视图；周视图同时吞 @p 和 @due。

### 5.4 模式判定（`detectMode`，`todoParser.js:10-12`）

```js
/^##\s+/m.test(text) ? 'legacy' : 'fields'
```

**注意**：文件有任何 `## ` 头就判定 legacy。fields 文件**没有** `## ` 分区头（即使 ✅区也不写头，完成任务靠 @d 自然沉底）。08-27 事故的教训是判定**不能**依赖 @p 存在（全在池/等待/冻结时是合法零 @p 状态）。

---

## 6. Store API 表面（vault.js）

### 6.1 文件契约

| 路径 | 用途 | 读 | 写 |
|---|---|---|---|
| `wiki/00_待办.md` | 待办单一事实源 | `getTodos` / `getRelated` | 全部任务写穿函数 |
| `wiki/健康/data/training_sessions.csv` | 训练会话 | `getTraining` | — |
| `wiki/健康/data/training_sets.csv` | 训练组 | `getTraining` | — |
| `wiki/健康/data/body_metrics.csv` | 体重体脂 | `getBodyMetrics` | `addBodyMetric` |
| `wiki/新闻/data/*.json` | 新闻契约（按日） | `getNews` / `getNewsByFile` | — |
| `wiki/读书/*.md` | 书卡 | `getReading` | `addBook` / `updateCard` / `deleteCard` / `setCardProgress` / `addCardThought` / `addCardExcerpt` / `updateCardEntry` / `deleteCardEntry` |
| `wiki/读书/articles/*.md` | 文章卡 | `getReading` | 同上 |
| `wiki/raw/articles/*.md` | 文章 raw 全文（不可变） | `getReading`（自动补薄卡）/ `getRelated` | `deleteCard`（文章卡连 raw 一起删） |
| `wiki/日记/YYYY/YYYY-MM-DD.md` | 日记（`diaryPath` 工具） | — | — |

### 6.2 store 方法清单

**待办域**：
- `getTodos()` → `{ mode, tasks }`（双兼容入口）
- `toggleTask(task)` / `toggleSubtask(task, sub)`
- `addTask({ title, section, due, promise })`
- `moveTask(task, targetSection)`（legacy 专用）
- `setTaskHold(task, hold)`（legacy 专用）
- `cancelTask(task)`（legacy 专用）
- `taskAction(task, action, note)`（fields 专用：hold/unhold/wait/unwait/pool/cancel）
- `setTaskPromise(task, date | null)`（fields 专用，改期自动 @r+1）
- `setTaskDue(task, due | null)`
- `deleteTask(task)` / `restoreTask(task)`
- `archiveDone()` → 移动条数（过夜归档）

**健康域**：
- `getTraining()` → `{ byDate, setsByDate }`
- `getBodyMetrics()` → `[{ date, weight, bodyfat, note }]`
- `addBodyMetric({ date, weight, bodyfat })`

**新闻域**：
- `getNews()` → `{ date, items, file, history }` | `null`
- `getNewsByFile(file)` → `{ date, items }`

**阅读域**：
- `getReading()` → `{ books, articles }`（scanCards 顺带做两件事：① 旧格式懒迁移 ingest 字段；② raw/articles 里有但 articles/ 里没卡的，自动补薄卡）
- `updateCard(path, patch)` / `setCardProgress(path, pct)`
- `addCardThought(path, text)` / `addCardExcerpt(path, text)`
- `updateCardEntry(path, heading, idx, newText)` / `deleteCardEntry(path, heading, idx)`
- `deleteCard(card)`（文章卡连 raw 一起删）
- `addBook(title)` → path
- `getRelated(card)` → `{ sources, tasks }`

**Obsidian 集成**：
- `openWikiLink(target)` → `app.workspace.openLinkText(target, '', true)`（新页签）
- `openPage(path)` → `app.workspace.openLinkText(path.replace(/\.md$/, ''), '')`（当前页）
- `coverUrl(path)` → `app.vault.adapter.getResourcePath(path)`
- `diaryPath(date)` → 工具函数

**事件**：
- `onChange(cb)` → 退订函数。组件订阅，文件变更时重读
- `_emit(path)` 内部使用，view 层把 vault watcher 的外部修改转发进来
- **写穿后立刻 emit 广播**（`vault.js:556-559`），组件 `onChange` 自听自写也会触发 reload

### 6.3 事件订阅路径（组件用）

| Tab | 监听路径前缀 | 行为 |
|---|---|---|
| TodoTab | `wiki/00_待办.md` | reload + ensureArchived |
| ReadingTab | `wiki/读书/`、`wiki/raw/articles/`、`wiki/00_待办.md` | reload（保留 openPath 的关联） |
| NewsTab | `wiki/新闻/data/` | reload |
| HealthTab | `wiki/健康/data/` | reload |

---

## 7. 交互模式盘点

### 7.1 重复出现的模式（跨 tab 一致）

| 模式 | 出现位置 | 锚点 |
|---|---|---|
| **Pill 按钮 `.tab-btn`** | 顶 tab、TodoTab 子 tab、录入 chip、标签 chip、新闻翻日、档案过滤 chip、详情弹窗所有按钮 | `app.css:90-106` |
| **卡片 `.card`** | 几乎所有内容容器 | `app.css:148-156` |
| **模态弹窗 `.wb-modal-overlay/.wb-modal`** | TodoTab 任务详情、ReadingTab 卡详情 | `app.css:220-238`；遮罩点击关 + Esc 关 + 内部 stopPropagation |
| **二次确认删除** | TodoTab 弹窗删除、ReadingTab 弹窗删除、ReadingTab 卡片角标删除（带 3s 超时脉冲） | `TodoTab.svelte:709-719` / `ReadingTab.svelte:103-117, 205-215` |
| **dash-frame 空态** | 健康本期计划、读书队列空、档案空、感想空、新闻契约待落 | `app.css:202-205` |
| **heatmap + 点击明细** | TodoTab、HealthTab 共用 Heatmap 组件，同样点击展开明细卡 | `Heatmap.svelte` |
| **状态 chip 色彩语义** | mint=完成/已摄取/已读，sky=冻结/想读/书封，peach=等待/弃读/文章，bubblegum=排队中/待落，rise=删除/逾期，plum=#工作标签 | 贯穿所有 tab |
| **录入行（input + btn-mint）** | TodoTab 加任务、ReadingTab 加书/感想/摘录、HealthTab 补录 | — |
| **tip 提示（2.5s 自消）** | TodoTab.act / ReadingTab.act / HealthTab.savedTip | — |
| **busy/saving 锁** | 所有写操作禁用按钮防重入 | — |
| **stopPropagation** | 勾选框/角标/卡内按钮 防止触发上层 onClick | — |
| **乐观更新** | 仅 TodoTab.toggle：UI 先翻转再写盘失败回滚；其他全部 pessimistic | `TodoTab.svelte:136-147` |

### 7.2 不一致 / 重复发明轮子

- **「取消」语义两种**：TodoTab `取消任务`（[-] 留档）vs ReadingTab `放回队列`（状态回退）；都是「反悔」但 UI 词汇不同
- **删除确认三态**：TodoTab 弹窗（提示「移入回收站,可恢复」）vs ReadingTab 弹窗（提示「不可恢复」）vs ReadingTab 卡片角标（3s 脉冲）。前两个文案 + 按钮二次点击，角标是 morph 图标
- **详情展示两种**：TodoTab 弹窗（modal overlay）vs ReadingTab 既有卡内展开（ toggleOpen 但代码里实际只用弹窗——`openPath` 但渲染走 `.wb-modal`）vs NewsTab 卡内展开（`openIdx` 切换）
- **进度调整**：ReadingTab 在读卡有 range slider + ±10 按钮；档案卡又只有「放回队列」。同一卡不同子页能力差异
- **fields vs legacy 双路径**：TodoTab 录入行、弹窗操作区、子 tab 都分叉；Vault API 也分两套（`moveTask/setTaskHold/cancelTask` vs `taskAction/setTaskPromise`）

### 7.3 模式速查（哪些 tab 用了哪些模式）

| 模式 | Todo | Reading | News | Health |
|---|---|---|---|---|
| 子页签 pill | ✓ | ✓ | — | — |
| 热力图 + 明细 | ✓ | — | — | ✓ |
| 弹窗编辑 | ✓ | ✓ | — | — |
| 卡内展开 | — | — | ✓ | — |
| 折叠卡（chevron） | ✓ (池/回收站) | — | — | — |
| 录入行 | ✓ | ✓ | — | ✓ |
| 二次确认删除 | ✓ | ✓ | — | — |
| 角标删除（脉冲） | — | ✓ | — | — |
| 标签筛选行 | ✓ | — | — | — |
| 搜索框 | — | ✓ | — | — |
| 翻页 chip（历史日期） | — | — | ✓ | — |
| 大数字统计 | ✓ (月视图) | ✓ (档案头部) | ✓ (日期条数) | ✓ (今日面板) |
| 条形图 / 折线图 | — | — | — | ✓ |
| 进度条 + slider | — | ✓ | — | — |
| 状态机 chip（pending/ingested） | — | ✓ | — | — |
| 滚动曝光榜 | ✓ | — | — | — |

---

## 8. UX 痛点观察（仅观察，不提方案）

1. **长单列滚动**：TodoTab 是「热力图 + 子 tab + 标签行 + 列表 + 池 + 回收站」一长条；月视图往下滚还要经过池和回收站。`max-w-[960px]` 单栏，桌面端右侧大片空白。
2. **编辑全走弹窗**：TodoTab 和 ReadingTab 所有改操作都开模态；连「改个 @p」都要三步（点行 → 弹窗 → date input → 存）。
3. **fields/legacy 双模态语义漂移**：同一文件可能是两种模式，UI 文案/操作组完全不同；「@p 模式」灰色小字是唯一标识，新用户不知道自己在哪种模式。
4. **回收站入口藏深**：TodoTab 底部 + 只在 `trashTasks.length > 0` 时才渲染；没有从弹窗直接进回收站的反向链路。
5. **曝光榜与主任务列表脱节**：曝光榜在月视图里，但上榜条件是「任意活跃视图里滚 ≥7 天」——任务可能在「等待」「冻结」「池」里滚，用户看不到曝光榜就感知不到。
6. **子任务只在弹窗可见**：fields 模式的 block（续行 + 子任务）只在任务弹窗里渲染；列表行看不到子任务进度（如 2/5）。
7. **tab 切换状态丢失**：App.svelte `{#if}` 分支导致切走再切回整个 tab 重挂载，输入到一半的录入框、滚动位置、展开状态全丢。
8. **新闻「读全文」入口重复**：卡上有「阅读」（卡内展开）+「原文」（外链）；如果卡有 `sourceFile` 还会再加一个「读全文」（Obsidian 打开），三个相似语义并存。
9. **健康「本期计划」纯占位**：占了一张卡的位置但完全无功能，「待活活出方案」文案需要外部知识才懂。
10. **body_metrics 补录表单位置**：藏在「今日面板」卡片底部 dash-frame 里，和两个「—」占位数字（目标热量/营养素）混在一起。
11. **移动端适配零散**：`max-md:` 只用在 tab 按钮缩小、DoodleBackground 部分贴纸隐藏、健康/读书网格从两/三列退单列；没有移动端底栏、没有手势、录入框在小屏拥挤。
12. **error 状态粗暴**：TodoTab/ReadingTab 出错就整张红卡替换列表，无重试按钮；NewsTab 出错静默吞掉显示空态。
13. **loading 状态文本不一致**：「读取 00_待办.md …」「扫读书卡 …」「读取新闻契约 …」「读取训练数据 …」四种文案，无骨架屏。
14. **badge 色彩负载**：单行任务最多同时挂 5 个 chip（tags + 状态 + 等待 + 临期 + 滚动 + @r），小屏会挤出折行。

---

## 9. 重写约束（来自 parser/store，UI 必须尊重）

### 9.1 解析器硬约束

- **detectMode 用结构判定**（有 `## ` 头 = legacy）：UI 不能在 fields 文件里插入 `## ` 标题，否则下次 reload 整文件跌回 legacy 渲染（08-27 事故教训，`todoParser.js:7-12`）
- **任务定位用「标题前 20 字 + @c」**：UI 改任务标题/created 会破坏后续写穿（`vault.js:26-33`）。**重写不能加「编辑标题」功能而不改 vault 层**
- **fields 块缩进是 ≥2 空格或制表符**：子任务/续行/等待条件都靠这个解析；UI 如果支持富文本编辑块，落盘必须保缩进
- **「等待：」是文本行抓取**（`todoParser.js:151-163`）：UI 不能把等待条件放到子任务里，必须是 text 类型块行
- **`@r` 计数器自动维护**：`setTaskPromise` 改期时自动 +1；UI 不能让用户直接编辑 @r
- **取消（[-]）和删除（@x）都不进活跃视图**：UI 必须提供「回收站」「已取消留档」的查看入口，否则任务永沉

### 9.2 写穿时序约束

- **写穿是「读全文 → 改行 → 写整文」**：每次都全量重写 `00_待办.md`；UI 高频操作（连点 checkbox）会触发多次整文件写入。乐观更新只在 `toggle` 一处做了，其他都 pessimistic
- **写完立刻 emit**：`write()` 内部 `emit(p)`，组件 `onChange` 会立刻 reload；UI 不需要手动调 `reload`，但也意味着 **UI 的本地状态（如 openKey、tagFilter）会在 reload 后被 $derived 重算**，要确认引用的还是同一对象（TodoTab 用 `keyOf(t) = title|created` 来维持 openTask）
- **archiveDone 是隐式副作用**：TodoTab `onMount + onChange` 都会跑，会把过夜的 [x] 整块搬到 ✅区；UI 渲染「今天」时不要假设 [x] 还在原区
- **任务 key 是 `title|created`**：同一天创建两个同名任务会撞 key，`#each` 用 key 时会错。重写在录入时要去重或加 uid

### 9.3 双模式兼容包袱

- **`getTodos()` 返回 `{ mode, tasks }`**：UI 必须消费 mode 字段并分叉渲染
- **legacy 任务被补齐成 fields shape**：UI 可以用同一份渲染代码，但**操作 API 仍要分模式调**（`moveTask` vs `taskAction('pool')`）
- **「📦 待办池」「✅ 已完成」等区名是硬编码中文字符串匹配**：`sectionOf` 和 `sectionRange` 都靠 `includes('今天')` 等关键词；UI 不能改 md 里的分区标题
- **旧格式 `(MM-DD HH:MM 备注)` 尾部时间戳**：parser 还兼容（`todoParser.js:36-37, 95`），UI 不需要展示但不能当成异常

### 9.4 阅读域约束

- **frontmatter 是受控简单 kv**（不引 yaml 库）：UI 改卡字段时不能写入复杂结构（数组/嵌套对象）
- **`## 感想` / `## 摘录` 是中文硬编码**：卡模板生成时写死；UI 不能让用户自定义区名
- **`status` vs `ingest` 解耦**（v0.3.0 起）：UI 显示摄取态必须看 `ingest` 字段，不能从 status 推
- **scanCards 有副作用**：调 `getReading()` 会顺带做「旧格式懒迁移」+「raw 补薄卡」，是纯读接口但会写文件
- **deleteCard 文章卡会连 raw 一起删**：UI 必须在确认文案里明示（ReadingTab 已做）

### 9.5 新闻/健康约束

- **新闻契约是只读**：UI 不能写入 `wiki/新闻/data/`；空态文案要保留解释流水线
- **健康 CSV 三个文件**：sessions/sets/body_metrics；UI 只能写 body_metrics，前两个是外部（训练日志流水线）落盘
- **body_metrics.csv 简单 CSV 解析器**（无引号字段）：UI 不能让用户在补录时输入逗号

### 9.6 Obsidian 宿主约束

- **不能引入 Tailwind preflight**（`app.css:1-3`）：会污染宿主 UI；重写若要加 reset 必须 scope 到 `.workbench-root`
- **宿主 button/input 样式权重高**：必须显式压制（`app.css:70-87`）
- **移动端要避让 `--obsidian-mobile-navbar-h`**：底部 padding 计算（`app.css:60-62`）
- **滚动条全局隐藏**：`.workbench-root` 全子元素 scrollbar-width:none，重写要想清楚是否真的不要滚动条（尤其弹窗/长列表）
- **`openWikiLink` 第三参 `true` = 新页签**：保证工作台视图不被顶替；`openPage` 第二参 `''` = 当前页

---

## 10. 速查统计

| Tab | 行数 | 子视图数 | 弹窗 | 录入点 | 删除确认 |
|---|---|---|---|---|---|
| App.svelte | 61 | 4 顶 tab | — | — | — |
| TodoTab | 726 | 4 子 tab（fields）/ 3（legacy）+ 热力图 + 池/回收站折叠 | 任务详情 | 1（录入行） | 弹窗内二次确认 |
| ReadingTab | 614 | 4 子页签 | 卡详情 | 3（加书/感想/摘录） | 弹窗二次 + 角标 3s 脉冲 |
| NewsTab | 139 | 1（翻历史） | — | — | — |
| HealthTab | 211 | 4 卡（热力图/今日/计划/趋势） | — | 1（补录体重体脂） | — |
| **合计** | **1751** | — | — | — | — |

**Store 公开方法数**：34（含 `onChange`/`_emit`/`diaryPath`）
**@字段数**：9（c/s/d/h/due/p/w/x/r）
**视图派生规则**：7 个（today/week/pool/waiting/hold/done/trash）
**色彩 token**：14 个（含语义色）
