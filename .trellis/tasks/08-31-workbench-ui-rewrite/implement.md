# Implement: 工作台 UI 重写(animal-island)

> 执行计划。需求 `prd.md`,技术设计 `design.md`,交互方案 `interaction-proposal.md`。
> 分期结构:本任务为父任务;1-4 期在终审通过后创建为子任务(`task.py create --parent`),依赖关系写入各子任务 prd/implement。

## 0 期(前置,父任务直接执行)

- [ ] 提交当前工作树标签筛选功能(TodoTab/WikiText/todoParser,+80 行),发版 v0.5.1(发版前裸 `pnpm build` 刷新 dist——v0.4.4 教训)
- [ ] 验证:`git status` 干净;manifest 0.5.1;release 资产为新 dist

## 1 期|外壳与组件库接入(子任务 shell-integration)

**交付**:可日常使用的素面外壳——四 tab 功能临时可用(允许先用旧逻辑+新皮肤过渡),接入件全部就位。

- [ ] `package.json` 加 `link:../animal-island-svelte`;`pnpm install`
- [ ] vite.config.js:alias 拆引 tokens/fonts;`assetsInlineLimit: 6_000_000`
- [ ] `app.css` 重写:引 animal tokens/fonts、scoped box-sizing(含 portal 覆盖)、Tailwind @theme 重映射、删全部旧自定义类
- [ ] `src/lib/ui/`:SegmentedNav / ConfirmButton / EmptyCard / Feedback.js / StatDigit
- [ ] App.svelte 重写:词标(Nunito 900/Title ribbon)+ 日期 Tag + keep-alive 导航(懒挂载+hidden)
- [ ] 四 tab 临时适配:最小改动跑通(旧结构去旧类,套 animal Card/Button;不做交互重设计)
- [ ] 删 DoodleBackground/Crane 引用与资产、DM Serif woff2
- [ ] 验证:`pnpm build` 通过;AC2 grep 为空;AC8 宿主走查(设置页/侧边栏目视);AC1 keep-alive 生效
- [ ] 回滚点:本期单独成 commit/release v0.6.0

**风险文件**:`app.css`(整体重写,宿主污染唯一入口)、`vite.config.js`(inline 阈值→styles.css 体积)

## 2 期|待办页重写(子任务 todo-rewrite,依赖 1 期的 ui/ 件与接入)

**交付**:prd R5/R6 全部。

- [ ] `src/lib/todo/` 目录拆分(容器/Header/Views/TaskRow/TaskDrawer/TrashDrawer/QuickEntry/todoActions)
- [ ] 模式适配层 todoActions.js(fields/legacy dispatch 表,见 design 4.2)
- [ ] 头部条:日期 + Progress 今日进度 + 标签筛选 Tag 组 + 回收站图标钮(计数徽标)
- [ ] 四子视图 + 右侧信息栏(热力图重绘 + 曝光榜 + 完成计数;移动端降底部)
- [ ] TaskRow:Checkbox 乐观勾选 + n/m 子任务标 + ≤2 状态 Tag + hover 快捷改期 DatePicker
- [ ] TaskDrawer:元数据 Tag 组/描述 WikiText/块子任务 Checkbox/状态操作组(ConfirmButton)/@p@due DatePicker/备注/删除
- [ ] TrashDrawer:条目 + 恢复;任意子视图可达
- [ ] QuickEntry sticky 沉底:承诺日 Tag 组 + Input + Button;录入提示语保留
- [ ] 过夜归档/标签筛选自动复位/写穿自刷新 等行为回归
- [ ] 验证:AC1/AC3/AC4/AC5/AC6;同 vault 新旧对比(回退 v0.6.0 数据无损);冷启动与切页耗时实测
- [ ] 回滚点:release v0.7.0

**风险文件**:TodoTab 拆分(726 行大改,行为回归清单逐项过);todoActions.js(双模式语义正确性)

## 3 期|读书页重写(子任务 reading-rewrite,依赖 1 期)

- [ ] `src/lib/reading/` 拆分;四子页 IA 不变
- [ ] 卡片:Card hoverable + Image(preview)封面 + pastel 色块兜底(animal 色板)+ Tag 类型/状态
- [ ] DetailDrawer:进度(Progress + ±10 + 数字 Input)、评分三 Tag、摄取三态、动作行、摘录/感想 EntryEditor、关联两栏(dashed Card)、删除(ConfirmButton,文章文案保留)
- [ ] 队列加书(剥《》)/档案搜索(Input prefix + allowClear)/过滤 Tag 组/感想时间流 + jumpTo
- [ ] 验证:AC7 读书部分全通;AC3/AC4
- [ ] 回滚点:release v0.8.0

## 4 期|新闻 + 健康 + 收尾(子任务 news-health-rewrite,依赖 1 期)

- [ ] 新闻:日期 Tag 组翻页;点卡展开阅读器;两图标钮(Tooltip);Skeleton 卡网格;契约待落 dashed Card
- [ ] 健康:热力图重绘(teal 五档)+ 点击明细;今日面板 StatDigit;补录 Form(禁逗号校验);容量条/折线重绘;删「本期计划」占位卡
- [ ] 收尾:BackTop(可选);移动端全量走查(录入/Drawer 底部化/navbar 避让);视觉走查(对照动森 demo 气质)
- [ ] 验证:AC7 新闻/健康部分;AC8 移动端;全量 AC 终验
- [ ] 回滚点:release v0.9.0

## 终审通过后动作

1. 创建 4 个子任务并写入依赖(2/3/4 依赖 1)
2. 各子任务补充自己的 prd.md(从本文档对应章节展开)
3. 父任务 `task.py start` → 0 期执行 → 子任务依次 start

## 每期完成定义(DoD)

- 对应 AC 全绿;`pnpm build` 零告警;真 vault 目视走查过;release tag 落盘
