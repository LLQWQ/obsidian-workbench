# 工作台UI重写(animal-island)

## Goal

对工作台(Obsidian 插件,Svelte 5)做 UI 整体重写:交互逻辑与视觉效果 100% 重建于 `animal-island-svelte` 组件库体系(动森风),**不保留任何旧 UI 元素**(用户裁定 2026-08-31)。数据层(vault.js / todoParser.js / vault 文件格式)整体冻结,重写只动呈现与交互层。

用户价值:四个页签获得一致的动森视觉语言与统一的全局交互(反馈/加载/空态/删除确认/详情弹层),并修复现状 14 条痛点中的核心项(切页丢态、回收站藏深、曝光榜脱节、子任务不可见、改期三步、徽章拥挤、长单列桌面留白)。

## Background(已确认事实)

勘察落盘(重写的事实基础,含全部 file:line 锚点):
- `research/workbench-interaction-inventory.md` — 四 tab 全量功能清单、34 个 store 方法、9 个 @字段、7 条数据层硬约束、14 条 UX 痛点、交互模式速查
- `research/animal-island-capability-map.md` — 35 组件 API 详表、37 个 `--animal-*` token、全局 CSS 风险、portal 行为、dist 新鲜度(可直接用)

关键约束(数据层硬约束,UI 必须尊重):
1. `detectMode` 结构判定:fields 文件出现 `## ` 头即整文件跌回 legacy(08-27 事故教训)
2. 任务定位靠「标题前 20 字 + @c」→ 不能加「编辑标题」功能
3. 写穿 = 读全文→改行→写整文 + 立即 emit 广播 → 组件本地态用 `keyOf(title|created)` 维系
4. `@r`/`@x`/`[-]` 由 vault 自动维护,UI 不允许直改;回收站/已取消必须有查看入口
5. fields 块缩进(≥2 空格/制表符)承载子任务/续行/等待条件解析
6. 宿主约束:禁 Tailwind preflight、宿主 button/input 样式需压制、移动端避让 `--obsidian-mobile-navbar-h`
7. animal-island 消费约束:dist 为 .svelte 源形态(下游需 svelte 编译);exports 仅暴露 `.`/`./style`/`./items/*`;reset.css 含全局 `* box-sizing`;中文字体 woff2 超 100KB 内联阈值;Drawer/Modal portal 到 body

工作树状态:TodoTab/WikiText/todoParser 有未提交的标签筛选功能(+80 行),**0 期前置:先提交发版 v0.5.1 再开工**。

## Requirements

- R1 **外壳与导航**:四分区(待办/读书/新闻/健康)keep-alive 导航(懒挂载 + 隐藏保活),切页不丢录入态/筛选/滚动;顶栏词标「阿斌工作台」用 Nunito 900 / Title ribbon,右侧日期 Tag;内容区桌面 `max-w-[1100px]`,移动端单栏并避让 mobile-navbar
- R2 **视觉体系**:animal tokens 全量接管(湖水绿 #19c8b9 主色、暖棕 #794f27 正文、奶油 #f8f8f0 底、2px 边、16-24px 圆角、柔和阴影);animal 自托管字体(Nunito + Noto Sans SC);Tailwind 保留为布局工具链,`@theme` 色板重映射到 `var(--animal-*)`;A 股红涨绿跌两语义色保留(新闻/健康领域色)
- R3 **零旧元素**:仙鹤、DM Serif、DoodleBackground、Hatch 色板、全部旧自定义类(.tab-btn/.card/.btn-mint/.task-check/.dash-frame/.wb-modal/.swash/.wb-corner-danger)删除;WikiText/Heatmap/折线/容量条保留功能但视觉按 animal 语言重绘
- R4 **全局交互统一**:成功/失败提示 → `Notification`;加载 → `Skeleton`(按 tab 形状);空态 → `Card type="dashed"`;删除确认统一为二次确认 Button(点一次变红,3s 复位);详情弹层 → `Drawer`(桌面右侧/移动底部,`pushBackground={false}`);反馈文案集中 `feedback.js`
- R5 **待办页重写**:头部条(日期 + 今日进度 Progress + 标签筛选 + 回收站入口带计数徽标);子视图分段控件[日|周|等待|统计];桌面右侧信息栏(热力图 + 滚动曝光榜常显,移动端降为底部卡片);任务行加子任务 n/m 进度 Tag、hover 快捷改期 DatePicker、徽章收敛至 ≤2 个状态 Tag;录入行 sticky 沉底(承诺日 Tag 组 + Input + Button);任务详情 Drawer(元数据 Tag 组/描述 WikiText/块内容子任务 Checkbox/状态操作组/@p@due DatePicker/备注/删除)
- R6 **模式适配层**:单套 UI 说 fields 词汇;legacy 文件经适配层映射渲染(三区→日/周/池,操作 dispatch 到 moveTask/setTaskHold/cancelTask),仅显示「旧格式」Tag;双模式行为等价
- R7 **读书页重写**:四子页 IA 不变;卡片 Card hoverable + Image 封面(自带放大预览);状态/类型/评分 → Tag;详情 → Drawer;进度 = Progress + ±10 Button + 数字 Input(组件库无 Slider);搜索 Input(prefix + allowClear);摄取三态/关联两栏/摘录感想编辑器行为保留换皮
- R8 **新闻页重写**:日期翻页 → 可选中 Tag 组;点卡片 = 展开/收起内嵌阅读器;卡上仅两图标钮(原文外链 / 在 Obsidian 打开,Tooltip 释义);加载 Skeleton 卡网格
- R9 **健康页重写**:训练热力图 + 点击明细保留重绘(teal 色阶);今日面板大数字自绘重绘;补录换 Form + Input×2 + Button(禁逗号);8 周容量条/体重折线保留重绘;「本期计划」占位卡舍弃
- R10 **功能无损**:附录「保留」清单(inventory 文档第 1-4 章全部用户可见能力 + 乐观勾选/过夜归档/标签筛选自动复位/摄取幂等取消等隐式行为)全部行为等价,仅交互形态变化

## Acceptance Criteria

- [ ] AC1(对应 R1):桌面 + 移动端打开工作台,四 tab 来回切换,录入框文本、标签筛选、滚动位置均保留;冷启动默认待办
- [ ] AC2(对应 R2/R3):`grep -r "tab-btn\|btn-mint\|task-check\|dash-frame\|wb-modal\|swash\|cream-paper\|mint-splash\|DoodleBackground\|Crane\|DM Serif" src/` 结果为空;界面目视无旧元素残留
- [ ] AC3(对应 数据层冻结):`git diff` 中 `src/lib/vault.js`、`src/lib/todoParser.js` 零改动;vault 内文件字节级兼容(同一 vault 新旧 UI 均可正常工作)
- [ ] AC4(对应 R4):任一写操作成功出 Notification 成功气泡,失败出错误气泡且界面不崩;四个 tab 加载态均为 Skeleton;任一删除均为二次确认
- [ ] AC5(对应 R5):待办页任意子视图下一击可达回收站并恢复任务;含子任务的行显示 n/m;hover 任务行可两步内改 @p(且 @r 自动 +1);录入行滚动时保持可见
- [ ] AC6(对应 R6):构造 legacy 格式 00_待办.md,UI 正常渲染三区内容且操作可用,显示「旧格式」Tag;fields 文件无「旧格式」Tag
- [ ] AC7(对应 R7-R9):读书四子页功能全通(加书/开始读/进度/评分/读完/弃读/放回队列/摄取/搜索/感想摘录编辑/删除);新闻点卡展开阅读、两图标钮工作;健康补录写穿成功且逗号输入被拒
- [ ] AC8(对应 宿主约束):Obsidian 宿主 UI(设置页、其他插件、侧边栏)目视无样式回归;移动端底部内容不被 mobile-navbar 遮挡

## Out of Scope

- 数据层任何改动(vault.js/todoParser.js/文件格式/存储路径)
- 新数据能力:编辑任务标题、任务 uid、自定义感想/摘录区名、健康「本期计划」真实功能
- Obsidian 设置页、命令体系、发布/发版流程改动
- animal-island-svelte 库本身的缺陷修复(如 Cursor/cursor.css dist 缺失;本方案不用 Cursor)
- 新闻/健康数据流水线(契约落盘、训练日志)

## Key Decisions

| # | 决策 | 结论 |
|---|---|---|
| D1 | 数据层整体冻结 | ✅ 推荐,待终审确认 |
| D2 | legacy:单套 UI + 模式适配层 | ✅ 推荐,待终审确认 |
| D3 | keep-alive 页签(懒挂载+隐藏保活) | ✅ 推荐,待终审确认 |
| D4 | 详情弹窗 → Drawer | ✅ 推荐,待终审确认 |
| D5 | 回收站提为头部 Drawer 入口 | ✅ 推荐,待终审确认 |
| D6 | 桌面右侧信息栏(热力图+曝光榜常显) | ✅ 推荐,待终审确认 |
| D7 | DoodleBackground 舍弃 | **用户已裁定:舍弃** |
| D8 | 词标衬线与仙鹤全舍弃 | **用户已裁定:舍弃**(「不要保留任何旧 UI 的元素」2026-08-31) |
| D9 | Tailwind 保留(色板重映射) | ✅ 推荐,待终审确认 |
| D10 | 健康「本期计划」占位卡舍弃 | ✅ 推荐,待终审确认 |
| D11 | 读书去 slider(Progress + ±10 + 数字 Input) | ✅ 推荐,待终审确认 |
| D12 | 新闻三入口合并 | ✅ 推荐,待终审确认 |
| D13 | 四期分期(父任务 + 4 子任务) | ✅ 推荐,待终审确认;子任务于终审通过后创建 |

## Risks / Deferred

- 全局 CSS:不整体引 `./style`,vite alias 拆引 tokens/fonts,box-sizing 限于 `.workbench-root` 与 `[class^='animal-']`(覆盖 portal)——AC8 验证
- 中文字体体积:assetsInlineLimit 提至 ~6MB,styles.css 增大 1-2MB;备选只引拉丁字体( Deferred,首版全量引)
- Drawer portal 层级/滚动锁:z-index 约定 Drawer 1001 < Notification 2000;移动端走查验证
- lib dist 重建:改库后需 `pnpm build`;link: 接入方式写入 design.md
- keep-alive 常驻订阅开销:冷启动与切换耗时实测(2 期验收点)

## 变更对照速查

详见 `interaction-proposal.md` 附录(保留/变更/舍弃/新增四清单,lossless)。
