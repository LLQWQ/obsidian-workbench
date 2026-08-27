// todoParser 双模式 + 块感知 测试(node 直跑: node scripts/test-parser.mjs)
import { detectMode, parseTodos, parseTasks, deriveViews } from '../src/lib/todoParser.js'

let pass = 0
let fail = 0
const eq = (got, want, name) => {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) {
    pass++
    console.log(`  PASS ${name}`)
  } else {
    fail++
    console.log(`  FAIL ${name}\n    want: ${w}\n    got:  ${g}`)
  }
}
const ok = (cond, name) => eq(!!cond, true, name)

const TODAY = '2026-08-27' // 周四;本周 08-24(一) ~ 08-30(日)

// ============ (a) legacy fixture:分区解析,无 @p ============
console.log('\n[a] legacy 模式')
const LEGACY = `# 待办

## 🔥 今天

- [ ] **legacy今天** @c(2026-08-27)
- [x] **legacy完成** @c(2026-08-26) @d(2026-08-27)

## 📋 本周

- [ ] **legacy本周** @c(2026-08-25) @due(2026-08-29)

## 📦 待办池

- [ ] **legacy池** @c(2026-08-24)

## ✅ 已完成

- [x] **legacy归档** @c(2026-08-20) @d(2026-08-21)
`
eq(detectMode(LEGACY), 'legacy', 'detectMode=legacy')
const la = parseTasks(LEGACY)
eq(la.mode, 'legacy', 'parseTasks.mode=legacy')
eq(la.tasks.map((t) => t.title), ['legacy今天', 'legacy完成', 'legacy本周', 'legacy池', 'legacy归档'], 'legacy 五任务标题序')
eq(la.tasks.map((t) => t.section), ['today', 'today', 'week', 'pool', 'done'], 'legacy 分区归属')
eq(la.tasks[1].status, 'done', 'legacy [x] status=done')
eq(la.tasks[2].due, '2026-08-29', 'legacy @due 解析')
ok(la.tasks.every((t) => t.block.length === 0 && t.promise === null && t.rePromise === 0), 'legacy 补齐 fields 形态字段')
// parseTodos 原样保留(vault.js getRelated 依赖)
eq(parseTodos(LEGACY).length, 5, 'parseTodos 原行为保留')

// ============ (b) fields fixture:平铺+块+全字段 ============
console.log('\n[b] fields 模式六视图')
const FIELDS = `# 待办

- [ ] **写周报** @c(2026-08-25) @p(2026-08-27) @due(2026-08-28)
  周五前发给阿斌
  包含数据部分
  - [ ] 收集数据
  - [x] 拉取报表
    - [ ] 核对口径
- [ ] **等阿斌反馈** @c(2026-08-20) @p(2026-08-27) @w(2026-08-26)
  等待:阿斌回复邮件
- [ ] **冻结的活儿** @c(2026-08-21) @h(2026-08-22)
- [ ] **池里的想法** @c(2026-08-23)
- [x] **昨天做完的** @c(2026-08-25) @p(2026-08-26) @d(2026-08-26)
- [ ] **多次跳票** @c(2026-08-01) @p(2026-08-28) @r(5)
- [ ] **本周截止** @c(2026-08-24) @due(2026-08-30)
- [-] **不做了** @c(2026-08-22) @p(2026-08-27)
`
eq(detectMode(FIELDS), 'fields', 'detectMode=fields')
const fb = parseTasks(FIELDS)
eq(fb.mode, 'fields', 'parseTasks.mode=fields')
eq(fb.tasks.length, 8, 'fields 八任务')
const byTitle = Object.fromEntries(fb.tasks.map((t) => [t.title, t]))
eq(byTitle['写周报'].promise, '2026-08-27', '@p 解析')
eq(byTitle['等阿斌反馈'].wait, '2026-08-26', '@w 解析')
eq(byTitle['多次跳票'].rePromise, 5, '@r 计数器解析')
eq(byTitle['冻结的活儿'].status, 'hold', '@h → status=hold')
eq(byTitle['不做了'].status, 'cancelled', '[-] → cancelled')
eq(byTitle['等阿斌反馈'].waiting, '阿斌回复邮件', '等待条件读块内「等待:」行')

const v = deriveViews(fb.tasks, TODAY)
eq(v.weekStartS, '2026-08-24', '周一界')
eq(v.weekEndS, '2026-08-30', '周日界')
eq(v.today.map((t) => t.title), ['写周报', '等阿斌反馈'], '今天视图=@p今天且无@d')
eq(v.week.map((t) => t.title), ['写周报', '等阿斌反馈', '多次跳票', '本周截止'], '本周视图=@p/@due∈本周(排除已完成/取消)')
// 严格按规格:池=无@p/@w/@h/@d(不排@due);"本周截止"仅@due→在池,同时本周视图经@due捕获
eq(v.pool.map((t) => t.title), ['池里的想法', '本周截止'], '待办池=无@p@w@h@d')
eq(v.waiting.map((t) => t.title), ['等阿斌反馈'], '等待中=有@w无@d')
eq(v.hold.map((t) => t.title), ['冻结的活儿'], '冻结=有@h无@d')
eq(v.done.map((t) => t.title), ['昨天做完的'], '已完成=有@d')

// ============ (c) 边界 ============
console.log('\n[c] 边界 case')
// c1: 3 层嵌套(父→子→孙)+ 续行混子任务
const t1 = byTitle['写周报']
eq(t1.block.filter((b) => b.type === 'text').map((b) => b.text), ['周五前发给阿斌', '包含数据部分'], 'c1 续行换行原样保留(序)')
const subs = t1.block.filter((b) => b.type === 'sub')
eq(subs.map((s) => s.title), ['收集数据', '拉取报表'], 'c1 一级子任务')
eq(subs[1].mark, 'x', 'c1 子任务复选框独立(x)')
eq(subs[0].mark, ' ', 'c1 子任务复选框独立( )')
eq(subs[1].children.map((s) => s.title), ['核对口径'], 'c1 3层嵌套:孙任务挂到子任务下')
eq(subs[1].children[0].type, 'sub', 'c1 孙节点类型 sub')
// c2: 空块(父行无缩进行)
const t2 = byTitle['冻结的活儿']
eq(t2.block.length, 0, 'c2 空块 block=[]')
eq(t2.endLine, t2.line, 'c2 空块 endLine=line')
// c3: 块不越界——下一父行不被吞
eq(byTitle['等阿斌反馈'].block.length, 1, 'c3 块边界:只吃自己的缩进行')
// c4: 续行挂在父层而非最后子任务下(备注落块尾场景)
const MIX = `- [ ] **混排** @c(2026-08-27) @p(2026-08-27)
  - [ ] 子项
  08-27 转等待:备注文本
`
const mixT = parseTasks(MIX).tasks[0]
eq(mixT.block.map((b) => b.type), ['sub', 'text'], 'c4 备注续行归父层(不被子任务吞)')
eq(mixT.block[1].text, '08-27 转等待:备注文本', 'c4 备注文本内容')
// c5: legacy/fields 判定边界——结构判定(08-27 事故修订):## 分区头→legacy,无→fields;@p 有无不参判
eq(detectMode('## 今天\n- [ ] 有承诺 @c(2026-08-27) @p(2026-08-28)\n'), 'legacy', 'c5 有分区头(含@p)→legacy')
eq(detectMode('- [ ] 无承诺 @c(2026-08-27) @due(2026-08-28)\n'), 'fields', 'c5 无分区头(零@p)→fields')
eq(detectMode('# 待办\n协议头\n---\n- [ ] 零承诺任务 @c(2026-08-27)\n'), 'fields', 'c5 新文件全池零@p→fields')

console.log(`\n========== 汇总: ${pass} PASS / ${fail} FAIL ==========`)
process.exit(fail ? 1 : 0)
