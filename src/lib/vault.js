// ============================================================
// 数据访问层 —— 插件版直读写 vault;浏览器预览版传 null 走 mock
// store 接口与组件解耦:组件只认 store,不认 Obsidian
// 待办解析已抽离到 todoParser.js(纯模块,node 可测),此处 re-export 保持 API
// ============================================================
import { detectMode, parseTodos, parseTasks, deriveViews } from './todoParser.js'

export { detectMode, parseTodos, parseTasks, deriveViews }

const TODO_PATH = 'wiki/00_待办.md'
const SESSIONS_PATH = 'wiki/健康/data/training_sessions.csv'
const SETS_PATH = 'wiki/健康/data/training_sets.csv'
const BODY_PATH = 'wiki/健康/data/body_metrics.csv'
const NEWS_DIR = 'wiki/新闻/data'
// 阅读体系三层契约:raw=源文件(不可变) / 读书=卡(我的全部) / sources=摄取产物
const BOOKS_DIR = 'wiki/读书'
const ARTICLE_CARDS_DIR = 'wiki/读书/articles'
const RAW_ARTICLES_DIR = 'wiki/raw/articles'

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- 00_待办.md 写穿函数族 ----------
// 通用定位:标题前20字 + @c 双重匹配(和 toggle 同一套,防标题漂移)
function findTaskLine(lines, task) {
  return lines.findIndex(
    (l) =>
      /^- \[[ xX\-]\]/.test(l) &&
      l.includes(task.title.slice(0, 20)) &&
      (task.created ? l.includes(`@c(${task.created})`) : true),
  )
}

// 区边界:## 标题行号 + 下一 ## 行号(### 子标题不影响,正则不匹配)
function sectionRange(lines, key) {
  const kw = { today: '今天', week: '本周', pool: '待办池', done: '已完成' }[key]
  const start = lines.findIndex((l) => /^##\s+/.test(l) && l.includes(kw))
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) if (/^##\s+/.test(lines[i])) { end = i; break }
  return { start, end }
}

// 区末尾插入一行(最后一个任务行之后;空区插标题行后空行处)
function insertIntoSection(lines, key, taskLine) {
  const r = sectionRange(lines, key)
  if (!r) throw new Error(`区未找到: ${key}`)
  let last = -1
  for (let i = r.start + 1; i < r.end; i++) if (/^- \[[ xX\-]\]/.test(lines[i])) last = i
  if (last >= 0) lines.splice(last + 1, 0, taskLine)
  else {
    let j = r.start + 1
    while (j < r.end && lines[j].trim() === '') j++
    lines.splice(j, 0, taskLine)
  }
}

// 勾选写穿:重读文件防漂移,按 标题+@c 定位行
export async function toggleTaskInFile(read, write, task, today) {
  const md = await read(TODO_PATH)
  const lines = md.split('\n')
  const idx = findTaskLine(lines, task)
  if (idx < 0) throw new Error(`任务行未找到: ${task.title}`)
  if (task.status !== 'done') {
    // 勾选:先清掉所有旧 @d(防累积),再补当天
    lines[idx] =
      lines[idx].replace('- [ ]', '- [x]').replace(/\s*@d\(\d{4}-\d{2}-\d{2}\)/g, '') + ` @d(${today})`
  } else {
    // 取消勾选:清掉全部 @d
    lines[idx] = lines[idx].replace(/- \[[xX]\]/, '- [ ]').replace(/\s*@d\(\d{4}-\d{2}-\d{2}\)/g, '')
  }
  await write(TODO_PATH, lines.join('\n'))
}

// 块范围:父行 idx 起,后续连续缩进(≥2空格/制表符)非空行;返回末行号(无块=idx)
function blockEnd(lines, idx) {
  let e = idx
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^(?: {2,}|\t)/.test(lines[i]) && lines[i].trim()) e = i
    else break
  }
  return e
}

// 加任务:标题去 * 防爆粗体标记;@c 必带,@due 可选
// 双模式:legacy → 插目标区末尾;fields → 带 @p,插最后一个非已完成区任务的块尾(无则 ✅区前/文末)
export async function addTaskInFile(read, write, { title, section, due, promise }, today) {
  const md = await read(TODO_PATH)
  const lines = md.split('\n')
  const safe = title.replace(/\*/g, '').trim()
  if (!safe) throw new Error('任务标题不能为空')
  let taskLine = `- [ ] **${safe}** @c(${today})`
  if (due) taskLine += ` @due(${due})`
  if (detectMode(md) === 'fields') {
    if (promise) taskLine += ` @p(${promise})`
    const doneR = sectionRange(lines, 'done')
    let last = -1
    for (let i = 0; i < lines.length; i++) {
      if (doneR && i > doneR.start && i < doneR.end) break
      if (/^- \[[ xX\-]\]/.test(lines[i])) last = i
    }
    if (last >= 0) lines.splice(blockEnd(lines, last) + 1, 0, taskLine)
    else if (doneR) lines.splice(doneR.start, 0, taskLine, '')
    else lines.push(taskLine)
  } else {
    insertIntoSection(lines, section, taskLine)
  }
  await write(TODO_PATH, lines.join('\n'))
}

// 通用行改写:fn(旧行)→新行,null=删除该行
async function mutateTaskInFile(read, write, task, fn) {
  const md = await read(TODO_PATH)
  const lines = md.split('\n')
  const idx = findTaskLine(lines, task)
  if (idx < 0) throw new Error(`任务行未找到: ${task.title}`)
  const nl = fn(lines[idx])
  if (nl === null) lines.splice(idx, 1)
  else lines[idx] = nl
  await write(TODO_PATH, lines.join('\n'))
}

// 冻结/解冻:@h 有=冻结
export async function setTaskHoldInFile(read, write, task, hold, today) {
  await mutateTaskInFile(read, write, task, (l) =>
    hold
      ? l.replace(/\s*@h\(\d{4}-\d{2}-\d{2}\)/g, '') + ` @h(${today})`
      : l.replace(/\s*@h\(\d{4}-\d{2}-\d{2}\)/g, ''),
  )
}

// 取消:[ ] → [-](留档不删行)
export async function cancelTaskInFile(read, write, task) {
  await mutateTaskInFile(read, write, task, (l) => l.replace('- [ ]', '- [-]'))
}

// 删除:物理删行(二次确认由调用方负责)
export async function deleteTaskInFile(read, write, task) {
  await mutateTaskInFile(read, write, task, () => null)
}

// 改/清 @due(due=null 清除)
export async function setTaskDueInFile(read, write, task, due) {
  await mutateTaskInFile(read, write, task, (l) => {
    const base = l.replace(/\s*@due\(\d{4}-\d{2}-\d{2}\)/g, '')
    return due ? `${base} @due(${due})` : base
  })
}

// 移动任务到其他区:原行删除,插入目标区末尾(行内容原样保留)
export async function moveTaskInFile(read, write, task, targetSection) {
  const md = await read(TODO_PATH)
  const lines = md.split('\n')
  const idx = findTaskLine(lines, task)
  if (idx < 0) throw new Error(`任务行未找到: ${task.title}`)
  const [row] = lines.splice(idx, 1)
  insertIntoSection(lines, targetSection, row)
  await write(TODO_PATH, lines.join('\n'))
}

// 整块插入区末尾(最后一个任务块之后;空区插标题行后空行处)
function insertBlockIntoSection(lines, key, blockRows) {
  const r = sectionRange(lines, key)
  if (!r) throw new Error(`区未找到: ${key}`)
  let last = -1
  for (let i = r.start + 1; i < r.end; i++) if (/^- \[[ xX\-]\]/.test(lines[i])) last = i
  if (last >= 0) lines.splice(blockEnd(lines, last) + 1, 0, ...blockRows)
  else {
    let j = r.start + 1
    while (j < r.end && lines[j].trim() === '') j++
    lines.splice(j, 0, ...blockRows)
  }
}

// 过夜归档:非已完成区的 [x] 且 @d < today → 整块(父行+缩进块)移入 ✅已完成区末尾;返回移动条数
// legacy 文件无缩进块 → 行为与单行版一致;fields 块任务整块搬,子行不变孤儿
export async function archiveDoneInFile(read, write, today) {
  const md = await read(TODO_PATH)
  const lines = md.split('\n')
  const doneR = sectionRange(lines, 'done')
  if (!doneR) return 0
  const moved = []
  const remaining = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const inDone = i > doneR.start && i < doneR.end
    if (!inDone && /^- \[[xX]\]/.test(l)) {
      const d = l.match(/@d\((\d{4}-\d{2}-\d{2})\)/)
      // 只动有 @d 且早于今天的;无 @d 的旧格式 [x] 不碰(安全优先)
      if (d && d[1] < today) {
        const block = [l]
        let j = i + 1
        while (j < lines.length && /^(?: {2,}|\t)/.test(lines[j]) && lines[j].trim()) {
          block.push(lines[j])
          j++
        }
        moved.push(block)
        i = j - 1
        continue
      }
    }
    remaining.push(l)
  }
  if (!moved.length) return 0
  for (const block of moved) insertBlockIntoSection(remaining, 'done', block)
  await write(TODO_PATH, remaining.join('\n'))
  return moved.length
}

// ---------- fields 模式写穿 ----------
// 子任务勾选:父行定位后块内找子行(标题前20字),[ ]↔[x] 独立翻转,不碰元数据(元数据只住父行)
export async function toggleSubtaskInFile(read, write, task, sub) {
  const md = await read(TODO_PATH)
  const lines = md.split('\n')
  const idx = findTaskLine(lines, task)
  if (idx < 0) throw new Error(`任务行未找到: ${task.title}`)
  const end = blockEnd(lines, idx)
  const key = sub.title.slice(0, 20)
  for (let i = idx + 1; i <= end; i++) {
    if (!/^\s+- \[[ xX\-]\]/.test(lines[i]) || !lines[i].includes(key)) continue
    if (lines[i].includes('- [ ]')) lines[i] = lines[i].replace('- [ ]', '- [x]')
    else if (/- \[[xX]\]/.test(lines[i])) lines[i] = lines[i].replace(/- \[[xX]\]/, '- [ ]')
    else return // [-] 已取消,不动
    await write(TODO_PATH, lines.join('\n'))
    return
  }
  throw new Error(`子任务未找到: ${sub.title}`)
}

// 状态操作 + 可选备注:改父行字段,块尾追加「  MM-DD 动作:备注」(不填备注也能操作)
// action: hold(写@h今天) / unhold(清@h) / wait(写@w今天) / unwait(清@w) / pool(清@p@w@h 降级回池) / cancel([ ]→[-] 留档)
const ACTION_LABEL = { hold: '冻结', unhold: '解冻', wait: '转等待', unwait: '解除等待', pool: '降级回池', cancel: '取消' }
export async function applyTaskActionInFile(read, write, task, action, note, today) {
  const md = await read(TODO_PATH)
  const lines = md.split('\n')
  const idx = findTaskLine(lines, task)
  if (idx < 0) throw new Error(`任务行未找到: ${task.title}`)
  let l = lines[idx]
  if (action === 'hold') l = l.replace(/\s*@h\(\d{4}-\d{2}-\d{2}\)/g, '') + ` @h(${today})`
  else if (action === 'unhold') l = l.replace(/\s*@h\(\d{4}-\d{2}-\d{2}\)/g, '')
  else if (action === 'wait') l = l.replace(/\s*@w\(\d{4}-\d{2}-\d{2}\)/g, '') + ` @w(${today})`
  else if (action === 'unwait') l = l.replace(/\s*@w\(\d{4}-\d{2}-\d{2}\)/g, '')
  else if (action === 'pool') l = l.replace(/\s*@(p|w|h)\(\d{4}-\d{2}-\d{2}\)/g, '')
  else if (action === 'cancel') l = l.replace('- [ ]', '- [-]')
  else throw new Error(`未知状态操作: ${action}`)
  lines[idx] = l
  const clean = (note || '').replace(/[\r\n]+/g, ' ').trim()
  const noteLine = `  ${today.slice(5)} ${ACTION_LABEL[action]}${clean ? `：${clean}` : ''}`
  lines.splice(blockEnd(lines, idx) + 1, 0, noteLine)
  await write(TODO_PATH, lines.join('\n'))
}

// 承诺日写穿:改/清 @p(date=null 清除);已有 @p 改期 → @r 再承诺计数 +1(无则立 1)
export async function setTaskPromiseInFile(read, write, task, date) {
  const md = await read(TODO_PATH)
  const lines = md.split('\n')
  const idx = findTaskLine(lines, task)
  if (idx < 0) throw new Error(`任务行未找到: ${task.title}`)
  let l = lines[idx]
  const cur = l.match(/@p\((\d{4}-\d{2}-\d{2})\)/)
  l = l.replace(/\s*@p\(\d{4}-\d{2}-\d{2}\)/g, '')
  if (date) {
    l += ` @p(${date})`
    if (cur && cur[1] !== date) {
      const r = l.match(/@r\((\d+)\)/)
      const n = r ? parseInt(r[1]) + 1 : 1
      l = r ? l.replace(/@r\(\d+\)/, `@r(${n})`) : `${l} @r(${n})`
    }
  }
  lines[idx] = l
  await write(TODO_PATH, lines.join('\n'))
}

// ---------- CSV 解析(无引号字段,简单切) ----------
function parseCsv(text) {
  const [head, ...rows] = text.trim().split('\n')
  const cols = head.split(',')
  return rows.map((r) => {
    const cells = r.split(',')
    const o = {}
    cols.forEach((c, i) => (o[c.trim()] = (cells[i] || '').trim()))
    return o
  })
}

export function aggregateSessions(csvText) {
  // date → { volume, dur, titles }
  const byDate = {}
  for (const s of parseCsv(csvText)) {
    const d = (s.date || '').slice(0, 10)
    if (!d) continue
    if (!byDate[d]) byDate[d] = { date: d, volume: 0, dur: 0, titles: new Set(), sets: 0 }
    byDate[d].volume += parseFloat(s.total_volume_kg) || 0
    byDate[d].dur += parseInt(s.duration_min) || 0
    byDate[d].titles.add(s.title || '训练')
  }
  return byDate
}

export function aggregateSets(csvText) {
  // date → [ {movement, part, weight, reps, set_index} ]
  const byDate = {}
  for (const r of parseCsv(csvText)) {
    const d = (r.date || '').slice(0, 10)
    if (!d) continue
    if (!byDate[d]) byDate[d] = []
    byDate[d].push({
      movement: r.movement,
      part: r.movement_type,
      weight: r.weight,
      reps: r.reps,
      idx: r.set_index,
    })
  }
  return byDate
}

// 按动作聚合同日明细:动作 → {sets, maxWeight, totalReps, part}
export function setsDetail(sets) {
  const map = {}
  for (const s of sets || []) {
    if (!map[s.movement]) map[s.movement] = { movement: s.movement, part: s.part, sets: 0, reps: 0, maxW: 0 }
    map[s.movement].sets += 1
    map[s.movement].reps += parseInt(s.reps) || 0
    map[s.movement].maxW = Math.max(map[s.movement].maxW, parseFloat(s.weight) || 0)
  }
  return Object.values(map)
}

// ---------- body_metrics.csv ----------
export function parseBodyMetrics(csvText) {
  if (!csvText) return []
  return parseCsv(csvText)
    .map((r) => ({ date: r.date, weight: parseFloat(r.weight) || null, bodyfat: parseFloat(r.bodyfat) || null, note: r.note || '' }))
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function upsertBodyMetric(read, write, exists, { date, weight, bodyfat }) {
  let rows = []
  if (exists) {
    const text = await read(BODY_PATH)
    rows = parseCsv(text).filter((r) => r.date)
  }
  const rest = rows.filter((r) => r.date !== date)
  rest.push({ date, weight: weight || '', bodyfat: bodyfat || '', note: '' })
  rest.sort((a, b) => a.date.localeCompare(b.date))
  const out = ['date,weight,bodyfat,note', ...rest.map((r) => `${r.date},${r.weight},${r.bodyfat},${r.note}`)].join('\n') + '\n'
  await write(BODY_PATH, out)
}

// ---------- 阅读体系:卡解析/写穿 ----------
// 卡 frontmatter 是受控简单 kv(插件自己生成),不引 yaml 库
export function parseFm(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return { fm: {}, body: text }
  const fm = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^"|"$/g, '')
  }
  return { fm, body: text.slice(m[0].length) }
}

function fmVal(v) {
  if (v === null || v === undefined || v === '') return '""'
  if (typeof v === 'number') return String(v)
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return `"${s.replace(/"/g, "'")}"`
}

// frontmatter 定点 patch:改 key 保行序,新 key 追加尾部,body 原样不动
export function patchCardFm(text, patch) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) return text
  const lines = m[1].split('\n')
  for (const [k, v] of Object.entries(patch)) {
    const nl = `${k}: ${fmVal(v)}`
    const i = lines.findIndex((l) => l.startsWith(`${k}:`))
    if (i >= 0) lines[i] = nl
    else lines.push(nl)
  }
  return `---\n${lines.join('\n')}\n---\n` + text.slice(m[0].length)
}

// 正文分区读取:## 感想 / ## 摘录 → [{ date, text }](条目格式 "- MM-DD 内容",日期可缺)
export function sectionItems(body, heading) {
  const lines = body.split('\n')
  const h = lines.findIndex((l) => l.trim() === `## ${heading}`)
  if (h < 0) return []
  const out = []
  for (let i = h + 1; i < lines.length; i++) {
    const l = lines[i]
    if (/^## /.test(l)) break
    const t = l.trim()
    if (!t) continue
    const m = t.match(/^-\s+(?:(\d{2}-\d{2}|\d{4}-\d{2}-\d{2})\s+)?([\s\S]*)$/)
    if (m) out.push({ date: m[1] || '', text: m[2] })
    else out.push({ date: '', text: t })
  }
  return out
}

// 追加一行到指定 ## 区末尾;区不存在则文末新建
export function appendToSection(text, heading, line) {
  const lines = text.split('\n')
  const h = lines.findIndex((l) => l.trim() === `## ${heading}`)
  if (h < 0) return text.trimEnd() + `\n\n## ${heading}\n\n${line}\n`
  let end = lines.length
  for (let i = h + 1; i < lines.length; i++) if (/^## /.test(lines[i])) { end = i; break }
  let j = end - 1
  while (j > h && lines[j].trim() === '') j--
  lines.splice(j + 1, 0, line)
  return lines.join('\n')
}

// 定点改/删 ## 区里第 idx 个条目(非空行计数);fn 返回新行,null = 删除
export function replaceSectionItem(text, heading, idx, fn) {
  const lines = text.split('\n')
  const h = lines.findIndex((l) => l.trim() === `## ${heading}`)
  if (h < 0) return text
  let count = -1
  for (let i = h + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break
    if (!lines[i].trim()) continue
    count++
    if (count === idx) {
      const nl = fn(lines[i])
      if (nl === null) lines.splice(i, 1)
      else lines[i] = nl
      return lines.join('\n')
    }
  }
  return text
}

export function parseCard(path, text) {
  const { fm, body } = parseFm(text)
  const name = path.split('/').pop().replace(/\.md$/, '')
  // 阅读态 ⊥ 摄取态解耦(v0.3.0):status=纯阅读态,ingest=摄取态
  // 兼容旧格式:status 里的 pending-ingest/ingested 映射进 ingest,status 落回 read
  let status = fm.status || ''
  let ingest = fm.ingest || ''
  if (status === 'pending-ingest') { ingest = 'pending'; status = 'read' }
  else if (status === 'ingested') { ingest = 'ingested'; status = 'read' }
  return {
    path,
    name,
    kind: fm.type === 'book' ? 'book' : 'article',
    status,
    ingest, // '' | pending | ingested
    title: fm.title || name,
    author: fm.author || '',
    progress: parseInt(fm.progress) || 0,
    rating: fm.rating || '',
    cover: fm.cover || '',
    sourceUrl: fm.source_url || '',
    sourceFile: (fm.source_file || '').replace(/^\[\[|\]\]$/g, ''),
    sourceCard: (fm.source_card || '').replace(/^\[\[|\]\]$/g, ''),
    added: fm.added || '',
    started: fm.started || '',
    finished: fm.finished || '',
    captured: fm.captured || '',
    thoughts: sectionItems(body, '感想'),
    excerpts: sectionItems(body, '摘录'),
  }
}

const bookTemplate = (title, today) => `---
type: book
status: 想读
ingest: ""
title: "${title.replace(/"/g, "'")}"
author: ""
progress: 0
rating: ""
cover: ""
source_file: ""
added: ${today}
started: ""
finished: ""
---

# ${title}

## 摘录

## 感想
`

const articleCardTemplate = (title, url, rawPath, captured, today) => `---
type: article
status: to-read
ingest: ""
title: "${title.replace(/"/g, "'")}"
source_url: "${url}"
source_file: "[[${rawPath.replace(/\.md$/, '')}]]"
captured: "${captured}"
added: ${today}
---

# ${title}

## 摘录

## 感想
`

// ---------- store 工厂:插件版 ----------
// 事件机制:① 自己写完立刻 emit 广播 ② view 把 vault watcher 的外部修改通过 _emit 转发进来
// 组件订阅 onChange,文件一变就重读 —— 解决 leaf 复用时 state 陈旧的 bug
export function createVaultStore(adapter, app = null) {
  const listeners = new Set()
  const emit = (p) => {
    for (const cb of listeners) {
      try { cb(p) } catch { /* 单个订阅者炸了不影响别人 */ }
    }
  }
  const read = (p) => adapter.read(p)
  const write = async (p, c) => {
    await adapter.write(p, c)
    emit(p)
  }
  const exists = (p) => adapter.exists(p)

  // 阅读域:扫描 读书/ 全部卡;raw/articles 有全文无卡的自动补薄卡
  async function scanCards() {
    // 旧格式懒迁移:status 里的摄取值写回 ingest 字段(自愈手改 md 的旧写法)
    const readCardMigrated = async (f) => {
      const text = await read(f)
      const { fm } = parseFm(text)
      const legacy =
        fm.status === 'pending-ingest' ? { status: 'read', ingest: 'pending' }
        : fm.status === 'ingested' ? { status: 'read', ingest: 'ingested' }
        : null
      if (!legacy) return parseCard(f, text)
      const finalText = patchCardFm(text, legacy)
      await write(f, finalText)
      return parseCard(f, finalText)
    }
    const out = { books: [], articles: [] }
    if (!(await exists(BOOKS_DIR))) return out
    if (await exists(RAW_ARTICLES_DIR)) {
      const rawListing = await adapter.list(RAW_ARTICLES_DIR)
      const cardListing = (await exists(ARTICLE_CARDS_DIR))
        ? await adapter.list(ARTICLE_CARDS_DIR)
        : { files: [] }
      const cardNames = new Set((cardListing.files || []).map((f) => f.split('/').pop()))
      for (const rawFile of rawListing.files || []) {
        if (!rawFile.endsWith('.md')) continue
        const fname = rawFile.split('/').pop()
        if (cardNames.has(fname)) continue
        const { fm } = parseFm(await read(rawFile))
        const title = fm.title || fname.replace(/\.md$/, '')
        await write(
          `${ARTICLE_CARDS_DIR}/${fname}`,
          articleCardTemplate(title, fm.source_url || '', rawFile, (fm.captured || '').slice(0, 10), todayStr()),
        )
      }
    }
    const listing = await adapter.list(BOOKS_DIR)
    for (const f of listing.files || []) {
      if (f.endsWith('.md')) out.books.push(await readCardMigrated(f))
    }
    if (await exists(ARTICLE_CARDS_DIR)) {
      const cl = await adapter.list(ARTICLE_CARDS_DIR)
      for (const f of cl.files || []) {
        if (f.endsWith('.md')) out.articles.push(await readCardMigrated(f))
      }
    }
    out.books.sort((a, b) => (b.added || '').localeCompare(a.added || ''))
    out.articles.sort((a, b) => (b.captured || b.added || '').localeCompare(a.captured || a.added || ''))
    return out
  }

  return {
    async getTodos() {
      // { mode: 'legacy'|'fields', tasks } —— 双兼容入口,组件按 mode 分渲染路径
      return parseTasks(await read(TODO_PATH))
    },
    async toggleTask(task) {
      await toggleTaskInFile(read, write, task, todayStr())
    },
    async addTask({ title, section, due, promise }) {
      await addTaskInFile(read, write, { title, section, due, promise }, todayStr())
    },
    async moveTask(task, targetSection) {
      await moveTaskInFile(read, write, task, targetSection)
    },
    async setTaskHold(task, hold) {
      await setTaskHoldInFile(read, write, task, hold, todayStr())
    },
    async cancelTask(task) {
      await cancelTaskInFile(read, write, task)
    },
    async deleteTask(task) {
      await deleteTaskInFile(read, write, task)
    },
    async setTaskDue(task, due) {
      await setTaskDueInFile(read, write, task, due)
    },
    // fields 模式:子任务勾选 / 状态操作+块备注 / 承诺日(@r 联动)
    async toggleSubtask(task, sub) {
      await toggleSubtaskInFile(read, write, task, sub)
    },
    async taskAction(task, action, note) {
      await applyTaskActionInFile(read, write, task, action, note, todayStr())
    },
    async setTaskPromise(task, date) {
      await setTaskPromiseInFile(read, write, task, date)
    },
    // 过夜归档:@d<today 的 [x] 移入已完成区,返回移动条数
    async archiveDone() {
      return archiveDoneInFile(read, write, todayStr())
    },
    async getTraining() {
      const [sessions, sets] = await Promise.all([read(SESSIONS_PATH), read(SETS_PATH)])
      return { byDate: aggregateSessions(sessions), setsByDate: aggregateSets(sets) }
    },
    async getBodyMetrics() {
      if (!(await exists(BODY_PATH))) return []
      return parseBodyMetrics(await read(BODY_PATH))
    },
    async addBodyMetric(entry) {
      await upsertBodyMetric(read, write, await exists(BODY_PATH), entry)
    },
    async getNews() {
      // 读最近一天的新闻契约;附近 7 天历史文件名供翻页
      if (!(await exists(NEWS_DIR))) return null
      const listing = await adapter.list(NEWS_DIR)
      const jsonFiles = (listing.files || []).filter((f) => f.endsWith('.json')).sort().reverse()
      if (!jsonFiles.length) return null
      const data = JSON.parse(await read(jsonFiles[0]))
      return { date: data.date, items: data.items || [], file: jsonFiles[0], history: jsonFiles.slice(0, 7) }
    },
    async getNewsByFile(file) {
      const data = JSON.parse(await read(file))
      return { date: data.date, items: data.items || [] }
    },
    // ---------- 阅读域 ----------
    async getReading() {
      return scanCards()
    },
    async updateCard(path, patch) {
      await write(path, patchCardFm(await read(path), patch))
    },
    async setCardProgress(path, pct) {
      const p = Math.max(0, Math.min(100, Math.round(pct)))
      await write(path, patchCardFm(await read(path), { progress: p }))
    },
    async addCardThought(path, text) {
      await write(path, appendToSection(await read(path), '感想', `- ${todayStr().slice(5)} ${text}`))
    },
    async addCardExcerpt(path, text) {
      await write(path, appendToSection(await read(path), '摘录', `- ${text}`))
    },
    // 改/删卡的感想/摘录条目;改时保留原行的日期前缀(- MM-DD)
    async updateCardEntry(path, heading, idx, newText) {
      await write(path, replaceSectionItem(await read(path), heading, idx, (old) => {
        const m = old.match(/^\s*-\s+(?:\d{2}-\d{2}|\d{4}-\d{2}-\d{2})\s+/)
        return `${m?.[0] || '- '}${newText}`
      }))
    },
    async deleteCardEntry(path, heading, idx) {
      await write(path, replaceSectionItem(await read(path), heading, idx, () => null))
    },
    // 删除卡:文章卡连同 raw 全文一起删(否则补卡机制会重建);书卡只删卡,不动电子书源文件
    async deleteCard(card) {
      await adapter.remove(card.path)
      emit(card.path)
      if (card.kind === 'article' && card.sourceFile) {
        const rp = `${card.sourceFile}.md`
        if (await exists(rp)) {
          await adapter.remove(rp)
          emit(rp)
        }
      }
    },
    async addBook(title) {
      const safe = title.replace(/[\\/:*?"<>|]/g, '').trim()
      if (!safe) throw new Error('书名不能为空')
      const p = `${BOOKS_DIR}/${safe}.md`
      if (await exists(p)) throw new Error('这本书已在书架')
      await write(p, bookTemplate(safe, todayStr()))
      return p
    },
    // 关联视图数据:① sources 摄取卡(metadataCache 反向链接) ② 00_待办里带 [[卡名]] 的任务
    async getRelated(card) {
      const res = { sources: [], tasks: [] }
      const links = app?.metadataCache?.resolvedLinks || {}
      for (const src of Object.keys(links)) {
        if (src === card.path || !src.endsWith('.md')) continue
        if (!links[src][card.path]) continue
        const fm = app.metadataCache.getCache(src)?.frontmatter
        if (fm?.type === 'source') {
          res.sources.push({ path: src, title: fm.title || src.split('/').pop().replace(/\.md$/, '') })
        }
      }
      try {
        const todos = parseTodos(await read(TODO_PATH))
        res.tasks = todos.filter((t) => t.body.includes(`[[${card.name}]]`))
      } catch { /* 待办文件缺失就空 */ }
      return res
    },
    coverUrl(path) {
      if (!path || !app?.vault?.adapter?.getResourcePath) return ''
      try { return app.vault.adapter.getResourcePath(path) } catch { return '' }
    },
    openPage(path) {
      app?.workspace?.openLinkText(path.replace(/\.md$/, ''), '')
    },
    diaryPath: (date) => `wiki/日记/${date.slice(0, 4)}/${date}.md`,
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    _emit: emit,
  }
}

export const PATHS = { TODO_PATH, BODY_PATH }
