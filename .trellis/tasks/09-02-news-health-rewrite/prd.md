# 4期:新闻+健康+收尾(animal-island)

> 父任务:`08-31-workbench-ui-rewrite`。规格来源:父 prd R8/R9、interaction-proposal.md 新闻/健康章节、research/ 两份勘察。
> **依赖**:`09-02-shell-integration` 完成(1 期的 ui/ 基础件与库接入就位后方可开工)。

## Goal

交付父 prd R8/R9 全部 + 全局收尾:新闻与健康页按 animal 体系重写,移动端与视觉全量走查,父任务全量 AC 终验。

## Requirements

- N1 新闻:日期翻页 → 可选中 Tag 组;点卡片 = 展开/收起内嵌阅读器;卡上仅两图标钮(原文外链 / 在 Obsidian 打开,Tooltip 释义);加载 Skeleton 卡网格;契约待落 dashed Card
- H1 健康:训练热力图重绘(teal 五档色阶)+ 点击明细保留;今日面板大数字 StatDigit 自绘重绘
- H2 补录换 Form + Input×2 + Button,禁逗号校验
- H3 8 周容量条 / 体重折线保留重绘;A 股红涨绿跌语义色保留(新闻/健康领域色)
- H4 删除「本期计划」占位卡
- Z1 收尾:BackTop(可选);移动端全量走查(录入 / Drawer 底部化 / navbar 避让);视觉走查对照动森 demo 气质
- Z2 数据层零改动

## Acceptance Criteria

- [ ] 父任务 AC7 新闻/健康部分:新闻点卡展开阅读、两图标钮工作;健康补录写穿成功且逗号输入被拒
- [ ] 父任务 AC8 移动端:底部内容不被 mobile-navbar 遮挡;宿主 UI 无样式回归
- [ ] 父任务全量 AC1-AC8 终验通过
- [ ] inventory 文档新闻/健康功能清单逐项行为等价
- [ ] 回滚点落盘:release v0.9.0

## Out of Scope

新闻/健康数据流水线(契约落盘、训练日志);健康「本期计划」真实功能(父 prd Out of Scope)。
