# 3期:读书页重写(animal-island)

> 父任务:`08-31-workbench-ui-rewrite`。规格来源:父 prd R7、interaction-proposal.md 读书页章节、research/ 两份勘察。
> **依赖**:`09-02-shell-integration` 完成(1 期的 ui/ 基础件与库接入就位后方可开工)。

## Goal

交付父 prd R7 全部:读书页四子页 IA 不变,视觉与交互按 animal 体系重写。

## Requirements

- B1 `src/lib/reading/` 目录拆分;四子页(在读/队列/档案/感想)IA 不变
- B2 卡片:Card hoverable + Image(自带放大预览)封面 + pastel 色块兜底(animal 色板)+ Tag 类型/状态
- B3 DetailDrawer:进度 = Progress + ±10 Button + 数字 Input(组件库无 Slider);评分三 Tag;摄取三态;动作行;摘录/感想 EntryEditor 行为保留换皮;关联两栏(dashed Card);删除 ConfirmButton(文案保留)
- B4 队列加书(剥《》);档案搜索 Input(prefix + allowClear);过滤 Tag 组
- B5 感想时间流 + jumpTo 保留
- B6 全局交互统一:Notification / Skeleton / EmptyCard / ConfirmButton,反馈文案走 feedback.js
- B7 数据层零改动

## Acceptance Criteria

- [ ] 父任务 AC7 读书部分全通:加书 / 开始读 / 进度 / 评分 / 读完 / 弃读 / 放回队列 / 摄取 / 搜索 / 感想摘录编辑 / 删除
- [ ] 父任务 AC3/AC4 全绿
- [ ] inventory 文档读书功能清单逐项行为等价(含摄取幂等取消等隐式行为)
- [ ] 回滚点落盘:release v0.8.0

## Out of Scope

待办/新闻/健康页(2/4 期);自定义感想/摘录区名(父 prd Out of Scope)。
