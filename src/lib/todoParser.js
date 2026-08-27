// ============================================================
// 00_待办.md 双模式解析器(纯模块,无依赖,node 可直跑测试)
//   legacy: 分区解析(🔥今天/📋本周/📦待办池/✅已完成),行为与 v0.3.x 一致
//   fields: 字段驱动,块感知 + 六视图派生
// ============================================================

// 双兼容开关(结构判定,08-27 事故修订):文件含 ## 分区头 → legacy;无 → fields
// 不依赖 @p 存在——fields 文件合法状态可以零 @p(全在池/等待/冻结),
// 字段判定会让最后一条 @p 被降级/删除后整文件跌回 legacy 渲染全空
export function detectMode(text) {
  return /^##\s+/m.test(text) ? 'legacy' : 'fields'
}

// ---------- legacy: 分区解析(从 vault.js 原样搬入,行为保持一致) ----------
export function parseTodos(md) {
  const lines = md.split('\n')
  let section = null
  const tasks = []
  lines.forEach((line, idx) => {
    const h = line.match(/^##\s+(.+)/)
    if (h) {
      const t = h[1]
      if (t.includes('今天')) section = 'today'
      else if (t.includes('本周')) section = 'week'
      else if (t.includes('待办池')) section = 'pool'
      else if (t.includes('已完成')) section = 'done'
      else section = null
      return
    }
    const m = line.match(/^- \[([ xX\-])\]\s*(.*)$/)
    if (!m || !section) return
    const body = m[2]
    const meta = {}
    for (const mm of body.matchAll(/@(c|s|d|h|due)\((\d{4}-\d{2}-\d{2})\)/g)) meta[mm[1]] = mm[2]
    // 旧格式尾部时间戳 (MM-DD HH:MM 备注)
    const oldDone = body.match(/\((\d{2})-(\d{2})\s+\d{2}:\d{2}/)
    const titleM = body.match(/^\*\*(.+?)\*\*/)
    const title = (titleM ? titleM[1] : body.split(' — ')[0].split('@c(')[0]).trim()
    const mark = m[1]
    tasks.push({
      line: idx,
      section,
      status: mark === 'x' || mark === 'X' ? 'done' : mark === '-' ? 'cancelled' : meta.h ? 'hold' : 'todo',
      title,
      body,
      created: meta.c || null,
      doneDate: meta.d || (mark === 'x' && oldDone ? `2026-${oldDone[1]}-${oldDone[2]}` : null),
      holdDate: meta.h || null,
      due: meta.due || null,
    })
  })
  return tasks
}

// ---------- 共用工具 ----------
const TASK_RE = /^- \[([ xX\-])\]\s*(.*)$/
const SUB_RE = /^(\s+)- \[([ xX\-])\]\s*(.*)$/
const INDENT_RE = /^(?: {2,}|\t)/
const META_DATE_RE = /@(c|s|d|h|due|p|w|x)\((\d{4}-\d{2}-\d{2})\)/g

function sectionOf(heading) {
  if (heading.includes('今天')) return 'today'
  if (heading.includes('本周')) return 'week'
  if (heading.includes('待办池')) return 'pool'
  if (heading.includes('已完成')) return 'done'
  return null
}

function titleOf(body) {
  const titleM = body.match(/^\*\*(.+?)\*\*/)
  return (titleM ? titleM[1] : body.split(' — ')[0].split('@c(')[0]).trim()
}

// fields 模式父行:元数据全字段(c/s/d/h/due/p/w + @r 计数器)
function parseParentLine(line, idx, section) {
  const m = line.match(TASK_RE)
  if (!m) return null
  const body = m[2]
  const meta = {}
  for (const mm of body.matchAll(META_DATE_RE)) meta[mm[1]] = mm[2]
  const r = body.match(/@r\((\d+)\)/)
  const oldDone = body.match(/\((\d{2})-(\d{2})\s+\d{2}:\d{2}/)
  const mark = m[1]
  return {
    line: idx,
    endLine: idx,
    section,
    status: mark === 'x' || mark === 'X' ? 'done' : mark === '-' ? 'cancelled' : meta.h ? 'hold' : 'todo',
    title: titleOf(body),
    body,
    created: meta.c || null,
    doneDate: meta.d || (mark === 'x' && oldDone ? `2026-${oldDone[1]}-${oldDone[2]}` : null),
    holdDate: meta.h || null,
    due: meta.due || null,
    promise: meta.p || null, // @p 承诺日
    wait: meta.w || null, //    @w 等待日
    deletedDate: meta.x || null, // @x 删除日(回收站)
    rePromise: r ? parseInt(r[1]) : 0, // @r 再承诺次数
    block: [], //           [{type:'text',text,line} | {type:'sub',mark,title,body,line,indent,children:[...]}]
    waiting: null, //       块内「等待:」行的条件文本
  }
}

// 块解析:父行之后连续缩进(≥2空格/制表符)行
//   无 - 前缀 = 描述续行(换行原样保留,按 indent 归层)
//   有 - 前缀 = 子任务(递归不限深,复选框独立)
function parseBlock(lines, parent) {
  const stack = [{ indent: -1, children: parent.block }]
  const normIndent = (s) => s.replace(/\t/g, '  ').length
  let i = parent.line + 1
  for (; i < lines.length; i++) {
    const l = lines[i]
    if (!INDENT_RE.test(l) || !l.trim()) break
    parent.endLine = i
    const sm = l.match(SUB_RE)
    if (sm) {
      const indent = normIndent(sm[1])
      const node = {
        type: 'sub',
        mark: sm[2],
        title: titleOf(sm[3]),
        body: sm[3],
        line: i,
        indent,
        children: [],
      }
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
      stack[stack.length - 1].children.push(node)
      stack.push({ indent, children: node.children })
    } else {
      const indent = normIndent(l.match(/^\s+/)[0])
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
      stack[stack.length - 1].children.push({ type: 'text', text: l.trim(), line: i })
    }
  }
  // 等待条件:块内任意「等待:」文本行
  const walk = (items) => {
    for (const it of items) {
      if (it.type === 'text') {
        const m = it.text.match(/等待[:：]\s*(.+)$/)
        if (m) return m[1].trim()
      } else {
        const r = walk(it.children)
        if (r) return r
      }
    }
    return null
  }
  parent.waiting = walk(parent.block)
}

// 统一入口:返回 { mode, tasks }
// legacy 任务补齐 fields 形态字段(block 空、新字段空),UI 单一路径渲染
export function parseTasks(text) {
  const mode = detectMode(text)
  if (mode === 'legacy') {
    const tasks = parseTodos(text).map((t) => ({
      ...t,
      endLine: t.line,
      promise: null,
      wait: null,
      rePromise: 0,
      block: [],
      waiting: null,
    }))
    return { mode, tasks }
  }
  const lines = text.split('\n')
  const tasks = []
  let section = null
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(.+)/)
    if (h) {
      section = sectionOf(h[1])
      continue
    }
    if (!TASK_RE.test(lines[i])) continue
    const t = parseParentLine(lines[i], i, section)
    if (!t) continue
    parseBlock(lines, t)
    i = t.endLine
    tasks.push(t)
  }
  return { mode, tasks }
}

// ---------- 六视图派生(fields 模式) ----------
// 今天=@p今天且无@d / 本周=@p∈本周或@due∈本周 / 待办池=无@p@w@h@d
// 等待中=有@w无@d / 冻结=有@h无@d / 已完成=有@d;取消([-])与删除(@x)不进任何活动视图
// 回收站=有@x(软删除沉底,可恢复)
export function deriveViews(tasks, todayS) {
  const d = new Date(`${todayS}T00:00:00`)
  const fmt = (x) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const ws = new Date(d)
  ws.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // 周一
  const we = new Date(ws)
  we.setDate(ws.getDate() + 6) // 周日
  const weekStartS = fmt(ws)
  const weekEndS = fmt(we)
  const inWeek = (s) => s && s >= weekStartS && s <= weekEndS
  const active = (t) => t.status !== 'cancelled' && !t.deletedDate
  return {
    today: tasks.filter((t) => active(t) && t.promise === todayS && !t.doneDate),
    week: tasks.filter((t) => active(t) && !t.doneDate && (inWeek(t.promise) || inWeek(t.due))),
    pool: tasks.filter((t) => active(t) && !t.promise && !t.wait && !t.holdDate && !t.doneDate),
    waiting: tasks.filter((t) => active(t) && t.wait && !t.doneDate),
    hold: tasks.filter((t) => active(t) && t.holdDate && !t.doneDate),
    done: tasks.filter((t) => t.doneDate && !t.deletedDate).sort((a, b) => b.doneDate.localeCompare(a.doneDate)),
    trash: tasks.filter((t) => t.deletedDate).sort((a, b) => b.deletedDate.localeCompare(a.deletedDate)),
    weekStartS,
    weekEndS,
  }
}
