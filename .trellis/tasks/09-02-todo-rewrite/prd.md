# 2期:待办页重写(animal-island)

> 父任务:`08-31-workbench-ui-rewrite`。规格来源:父 prd R5/R6、design.md 第 4 章、interaction-proposal.md 待办页章节、research/workbench-interaction-inventory.md(功能无损对照源)。
> **依赖**:`09-02-shell-integration` 完成(1 期的 ui/ 基础件与库接入就位后方可开工)。

## Goal

交付父 prd R5/R6 全部:待办页按 animal 体系整体重写,legacy 文件经模式适配层在单套 UI 中等价渲染。

## Requirements

- T1 `src/lib/todo/` 目录拆分:容器 / Header / Views / TaskRow / TaskDrawer / TrashDrawer / QuickEntry / todoActions
- T2 模式适配层 todoActions.js:fields/legacy dispatch 表(design.md 4.2);legacy 三区→日/周/池映射,操作 dispatch 到 moveTask/setTaskHold/cancelTask;仅显示「旧格式」Tag
- T3 头部条:日期 + Progress 今日进度 + 标签筛选 Tag 组 + 回收站图标钮(计数徽标)
- T4 四子视图分段控件[日|周|等待|统计];桌面右侧信息栏(热力图重绘 + 滚动曝光榜常显 + 完成计数),移动端降为底部卡片
- T5 TaskRow:Checkbox 乐观勾选 + 子任务 n/m 进度 Tag + hover 快捷改期 DatePicker(@p 两步内可改,@r 自动 +1)+ 徽章收敛至 ≤2 个状态 Tag
- T6 TaskDrawer(详情):元数据 Tag 组 / 描述 WikiText / 块内容子任务 Checkbox / 状态操作组(ConfirmButton 二次确认)/ @p@due DatePicker / 备注 / 删除
- T7 TrashDrawer:条目 + 恢复;任意子视图下一击可达
- T8 QuickEntry sticky 沉底:承诺日 Tag 组 + Input + Button;录入提示语保留
- T9 隐式行为回归:过夜归档 / 标签筛选自动复位 / 写穿自刷新 / 乐观勾选回滚
- T10 数据层零改动

## Acceptance Criteria

- [ ] 父任务 AC1/AC3/AC4 全绿
- [ ] 父任务 AC5:任意子视图一击达回收站并恢复;含子任务行显示 n/m;hover 两步内改 @p 且 @r 自动 +1;录入行滚动保持可见
- [ ] 父任务 AC6:legacy 00_待办.md 正常渲染三区且操作可用,显示「旧格式」Tag;fields 文件无该 Tag
- [ ] 同 vault 新旧对比(回退 v0.6.0 数据无损);冷启动与切页耗时实测记录
- [ ] inventory 文档第 1-4 章待办功能清单逐项行为等价
- [ ] 回滚点落盘:release v0.7.0

## 风险文件

TodoTab 拆分(726 行大改,行为回归清单逐项过);todoActions.js(双模式语义正确性)。

## Out of Scope

读书/新闻/健康页重写(3/4 期);编辑任务标题(数据层约束,父 prd Out of Scope)。
