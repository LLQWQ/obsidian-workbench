<!-- 待办 tab:热力图(点击明细) + 双模式视图 + 任务弹窗全生命周期操作,真读写 00_待办.md -->
<!-- 双兼容:legacy=既有分区 UI 不动;fields=deriveViews 六视图 + 等待页签 + 块渲染 + @p 录入 -->
<script>
  import { onMount } from 'svelte'
  import Heatmap from './Heatmap.svelte'
  import WikiText from './WikiText.svelte'
  import { deriveViews } from './vault.js'
  import {
    Flame, CalendarDays, Inbox, Check, Sparkles, AlarmClock, Plus, X, Trash2,
    ChevronDown, ChevronUp, Snowflake, Sun, CalendarClock, Ban, LoaderCircle,
    Repeat, Hourglass,
  } from '@lucide/svelte'

  let { store } = $props()

  let mode = $state('legacy') // legacy | fields(getTodos 双兼容入口)
  let todos = $state([])
  let loading = $state(true)
  let error = $state(null)
  let sub = $state('day') // day | week | wait(fields) | month
  let busy = $state(false)
  let tip = $state('')

  // 录入行:legacy 区选 / fields @p 选
  let newTask = $state('')
  let newSection = $state('today')
  let newPromise = $state('today') // today | tomorrow | week | pool

  // 待办池折叠
  let poolOpen = $state(false)

  // 回收站折叠(fields)
  let trashOpen = $state(false)

  // 标签筛选:null=全部;#tag 住父行自由文本,解析器提成 t.tags
  let tagFilter = $state(null)

  // 热力图点击明细
  let selectedDate = $state(null)

  // 任务弹窗
  let openKey = $state(null) // `${title}|${created}`
  let confirmDelete = $state(false)
  let confirmCancel = $state(false)
  let dueInput = $state('')
  let actionNote = $state('') // fields 状态操作可选备注
  let promiseInput = $state('') // fields 承诺日 @p 编辑

  // 过夜归档守卫
  let archiving = $state(false)

  const today = new Date()
  const todayS = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowS = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const weekStartS = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
  const monthStartS = todayS.slice(0, 8) + '01'

  const SECTIONS = [
    { key: 'today', label: '今天' },
    { key: 'week', label: '本周' },
    { key: 'pool', label: '待办池' },
  ]
  // fields 录入行 @p chip:今天/明天/本周(=本周一)/池(无@p)
  const PROMISE_CHIPS = [
    { key: 'today', label: '今天' },
    { key: 'tomorrow', label: '明天' },
    { key: 'week', label: '本周' },
    { key: 'pool', label: '池' },
  ]
  const ACTION_TIP = { hold: '已冻结', unhold: '已解冻', wait: '已转等待', unwait: '已解除等待', pool: '已降级回池', cancel: '已取消(留档 [-])' }
  const keyOf = (t) => `${t.title}|${t.created || ''}`

  onMount(() => {
    reload().then(ensureArchived)
    const off = store.onChange?.((p) => {
      if (p === 'wiki/00_待办.md') reload().then(ensureArchived)
    })
    return () => off?.()
  })

  async function reload() {
    try {
      const res = await store.getTodos()
      if (Array.isArray(res)) {
        // 防御:浏览器预览 mock 仍可能返回旧数组形态
        mode = 'legacy'
        todos = res
      } else {
        mode = res.mode
        todos = res.tasks
      }
      error = null
    } catch (e) {
      error = String(e)
    } finally {
      loading = false
    }
  }

  // 过夜自动归档:非已完成区的 [x] 且 @d<今天 → 静默整块移入已完成区
  // emit→onChange→reload 链式收敛;archiving 守卫防重入,stale 消失即停
  async function ensureArchived() {
    if (archiving) return
    const stale = todos.some((t) => t.status === 'done' && t.doneDate && t.doneDate < todayS && t.section !== 'done')
    if (!stale) return
    archiving = true
    try {
      await store.archiveDone()
    } catch (e) {
      error = String(e)
    } finally {
      archiving = false
    }
  }

  async function act(fn, tipText) {
    if (busy) return
    busy = true
    try {
      await fn()
      if (tipText) {
        tip = tipText
        setTimeout(() => (tip = ''), 2500)
      }
    } catch (e) {
      error = String(e)
    } finally {
      busy = false
    }
  }

  async function toggle(t) {
    // 乐观更新:UI 立刻翻转,不等落盘;失败回滚到文件真实状态
    const target = t.status === 'done' ? 'todo' : 'done'
    todos = todos.map((x) => (x === t ? { ...x, status: target, doneDate: target === 'done' ? todayS : null } : x))
    try {
      await store.toggleTask(t)
      await reload()
    } catch (e) {
      error = String(e)
      await reload()
    }
  }

  // fields 子任务勾选:独立写穿,父无联动
  async function toggleSub(t, subItem) {
    if (busy) return
    busy = true
    try {
      await store.toggleSubtask(t, subItem)
      await reload()
    } catch (e) {
      error = String(e)
      await reload()
    } finally {
      busy = false
    }
  }

  // fields 状态操作(带可选备注):冻结/解冻/转等待/解除等待/降级回池
  async function doAction(t, action) {
    const note = actionNote.trim()
    await act(async () => {
      await store.taskAction(t, action, note)
      actionNote = ''
    }, ACTION_TIP[action])
  }

  async function addNew() {
    const title = newTask.trim()
    if (!title) return
    if (mode === 'fields') {
      const promise =
        newPromise === 'today' ? todayS : newPromise === 'tomorrow' ? tomorrowS : newPromise === 'week' ? weekStartS : null
      await act(async () => {
        await store.addTask({ title, promise })
        newTask = ''
      }, promise ? `已记下 @p ${promise.slice(5)}` : '已入待办池')
    } else {
      await act(async () => {
        await store.addTask({ title, section: newSection })
        newTask = ''
      }, `已入${SECTIONS.find((s) => s.key === newSection).label}`)
    }
  }

  function openModal(t) {
    openKey = keyOf(t)
    confirmDelete = false
    confirmCancel = false
    dueInput = t.due || ''
    promiseInput = t.promise || ''
    actionNote = ''
  }

  // 双链点击:经 store 走 Obsidian 原生 openLinkText,新页签打开
  const openWiki = (target) => store.openWikiLink?.(target)

  function daysSince(d) {
    return Math.floor((Date.parse(todayS) - Date.parse(d)) / 86400000)
  }

  // 弹窗描述:body 去粗体标题 + 去元数据标记(含 fields 的 @p/@w/@r) + 去前导破折号
  function descOf(t) {
    let s = t.body
      .replace(/^\*\*(.+?)\*\*/, '')
      .replace(/\s*@(c|s|d|h|due|p|w)\(\d{4}-\d{2}-\d{2}\)/g, '')
      .replace(/\s*@r\(\d+\)/g, '')
      .trim()
    return s.replace(/^—\s*/, '').trim()
  }

  // 临期徽章:逾期/今天截止=红,D-3 内=橙,其余不显示
  function dueBadge(t) {
    if (!t.due || t.status === 'done' || t.status === 'cancelled') return null
    const diff = Math.round((Date.parse(t.due) - Date.parse(todayS)) / 86400000)
    if (diff < 0) return { text: `逾期 ${-diff} 天`, danger: true }
    if (diff === 0) return { text: '今天截止', danger: true }
    if (diff <= 3) return { text: `D-${diff} 截止`, warn: true }
    return null
  }

  // ---------- 聚合 ----------
  let doneByDate = $derived.by(() => {
    const m = {}
    for (const t of todos) {
      if (t.doneDate) m[t.doneDate] = (m[t.doneDate] || 0) + 1
    }
    return m
  })
  let doneListByDate = $derived.by(() => {
    const m = {}
    for (const t of todos) if (t.doneDate) (m[t.doneDate] ||= []).push(t)
    return m
  })

  // fields 模式六视图派生;legacy 保持既有分区过滤
  let views = $derived(mode === 'fields' ? deriveViews(todos, todayS) : null)
  // 标签筛选:只作用于工作视图(今天/本周/池/等待/冻结+今日完成计数);
  // 统计口径(热力图/周月完成/曝光榜)与回收站保持全局,不随筛选收窄
  let allTags = $derived(
    [...new Set(todos.flatMap((t) => t.tags || []))].sort((a, b) =>
      a === '工作' ? -1 : b === '工作' ? 1 : a.localeCompare(b, 'zh'),
    ),
  )
  const byTag = (list) => (tagFilter ? list.filter((t) => t.tags?.includes(tagFilter)) : list)
  let dayTasks = $derived(views ? byTag(views.today) : byTag(todos.filter((t) => t.section === 'today')))
  let weekPlan = $derived(
    views ? byTag(views.week) : byTag(todos.filter((t) => t.section === 'week' && t.status !== 'done' && t.status !== 'cancelled')),
  )
  let weekDone = $derived(todos.filter((t) => t.doneDate && t.doneDate >= weekStartS))
  let poolTasks = $derived(
    views ? byTag(views.pool) : byTag(todos.filter((t) => t.section === 'pool' && t.status !== 'done' && t.status !== 'cancelled')),
  )
  let waitTasks = $derived(views ? byTag(views.waiting) : [])
  let holdTasks = $derived(views ? byTag(views.hold) : [])
  let trashTasks = $derived(views ? views.trash : [])
  let monthDone = $derived(todos.filter((t) => t.doneDate && t.doneDate >= monthStartS))
  let rolling = $derived(
    todos
      .filter((t) => (t.status === 'todo' || t.status === 'hold') && t.created && daysSince(t.created) >= 7)
      .map((t) => ({ ...t, days: daysSince(t.created) }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 10),
  )

  // fields 今天视图只含未完成的;完成数按 @d=今天 单算(跟随标签筛选,与列表口径一致)
  let todayDoneCount = $derived(byTag(todos.filter((t) => t.doneDate === todayS)).length)
  let doneCountToday = $derived(views ? todayDoneCount : dayTasks.filter((t) => t.status === 'done').length)
  let dayTotal = $derived(views ? dayTasks.length + todayDoneCount : dayTasks.length)
  let openTask = $derived(todos.find((t) => keyOf(t) === openKey) || null)

  // 筛选的标签消失(任务删光/改标签)时自动回「全部」
  $effect(() => {
    if (tagFilter && !allTags.includes(tagFilter)) tagFilter = null
  })
</script>

<!-- 任务行(各视图复用):勾选框 + 标题 + 徽章;点行开弹窗 -->
{#snippet taskRow(t)}
  {@const roll = t.created ? daysSince(t.created) : 0}
  {@const due = dueBadge(t)}
  <li class="flex gap-3 py-2.5 border-b border-fog last:border-b-0 cursor-pointer" onclick={() => openModal(t)}>
    <button class="task-check" data-done={t.status === 'done'} onclick={(e) => { e.stopPropagation(); toggle(t) }} aria-label="勾选">
      <svg viewBox="0 0 12 12"><path d="M2 6.5 L5 9.2 L10 3" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <div class="flex-1 min-w-0">
      <div class="text-[15px] font-medium leading-snug break-words {t.status === 'done' ? 'line-through text-slate' : ''}"><WikiText text={t.title} onopen={openWiki} /></div>
      {#if t.created}
        <div class="text-[11.5px] text-slate mt-0.5">
          @c {t.created}{t.promise ? ` · @p ${t.promise.slice(5)}` : ''}{t.wait ? ` · @w ${t.wait.slice(5)}` : ''}
        </div>
      {/if}
      {#if t.wait && t.waiting}
        <div class="text-[11.5px] text-slate mt-0.5">等待:{t.waiting}</div>
      {/if}
    </div>
    <!-- 标签徽章:#tag 父行自由文本解析,工作=深紫(plum-ink)免闭环域标记,其余白底 -->
    {#each t.tags || [] as tag}
      <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black whitespace-nowrap {tag === '工作' ? 'bg-plum-ink text-pure-white' : 'bg-pure-white text-slate'}">#{tag}</span>
    {/each}
    {#if t.status === 'hold'}
      <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-sky-pop whitespace-nowrap">冻结</span>
    {:else if t.status === 'done'}
      <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-mint-splash whitespace-nowrap">{t.doneDate?.slice(5)}</span>
    {:else}
      {#if t.wait}
        <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-peach-pop whitespace-nowrap flex items-center gap-0.5"><Hourglass size={10} /> 等待</span>
      {/if}
      {#if due}
        <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black whitespace-nowrap {due.danger ? 'bg-rise text-pure-white' : 'bg-warn'}">{due.text}</span>
      {:else if roll >= 7 && !t.wait}
        <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-peach-pop whitespace-nowrap">滚动 D{roll}</span>
      {/if}
    {/if}
    <!-- @r 再承诺徽章:≥2 橙,≥5 红 -->
    {#if t.rePromise >= 2 && t.status !== 'done' && t.status !== 'cancelled'}
      <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black whitespace-nowrap flex items-center gap-0.5 {t.rePromise >= 5 ? 'bg-rise text-pure-white' : 'bg-warn'}"><Repeat size={10} /> ×{t.rePromise}</span>
    {/if}
  </li>
{/snippet}

<!-- fields 弹窗块渲染:续行换行保留 + 子任务复选框可勾写穿,渲染 3 层 -->
{#snippet blockItems(items, depth, task)}
  {#each items as it}
    {#if it.type === 'text'}
      <div class="text-[13px] text-charcoal leading-relaxed break-words py-0.5" style="padding-left:{depth * 18}px"><WikiText text={it.text} onopen={openWiki} /></div>
    {:else}
      {@const subDone = it.mark === 'x' || it.mark === 'X'}
      <div class="flex gap-2 items-start py-1" style="padding-left:{depth * 18}px">
        <button class="task-check task-check--sm" data-done={subDone} disabled={busy || it.mark === '-'}
          onclick={(e) => { e.stopPropagation(); toggleSub(task, it) }} aria-label="子任务勾选">
          <svg viewBox="0 0 12 12"><path d="M2 6.5 L5 9.2 L10 3" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <span class="flex-1 min-w-0 text-[13px] leading-snug break-words {subDone || it.mark === '-' ? 'line-through text-slate' : ''}"><WikiText text={it.title} onopen={openWiki} /></span>
      </div>
      {#if depth < 2 && it.children?.length}
        {@render blockItems(it.children, depth + 1, task)}
      {/if}
    {/if}
  {/each}
{/snippet}

<div>
  <!-- 任务完成热力图(点击看当日明细) -->
  <div class="card p-4 md:p-5 mb-4">
    <div class="flex items-baseline justify-between mb-2">
      <h3 class="font-display text-[17px]">任务完成热力图</h3>
      <span class="text-[11px] text-slate">近 20 周 · 点击看明细</span>
    </div>
    <Heatmap data={doneByDate} weeks={20} thresholds={[0, 1, 2, 4]} oncell={(d) => (selectedDate = selectedDate === d ? null : d)} {selectedDate} />
    {#if selectedDate}
      <div class="mt-3 rounded-[12px] border border-ink-black bg-pure-white p-3">
        <div class="flex items-baseline justify-between">
          <span class="text-[14px] font-bold">{selectedDate}</span>
          <span class="text-[12px] text-slate">完成 {(doneListByDate[selectedDate] || []).length} 件</span>
        </div>
        {#if doneListByDate[selectedDate]?.length}
          <ul class="mt-2 text-[13px] space-y-1">
            {#each doneListByDate[selectedDate] as t}
              <li class="flex items-baseline gap-1.5"><Check size={13} class="flex-none translate-y-0.5 text-mint-dim" /> <span class="flex-1 min-w-0 break-words">{t.title}</span></li>
            {/each}
          </ul>
        {:else}
          <div class="mt-2 text-[13px] text-slate">该日无完成记录</div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- 子 tab:日/周/(等待 fields)/月 + 操作提示 -->
  <div class="flex gap-2 mb-3 items-center">
    {#each mode === 'fields' ? [['day', '日'], ['week', '周'], ['wait', '等待'], ['month', '月']] : [['day', '日'], ['week', '周'], ['month', '月']] as [key, label]}
      <button class="tab-btn tab-btn--sm" data-active={sub === key} onclick={() => (sub = key)}>
        {label}
      </button>
    {/each}
    {#if mode === 'fields'}<span class="text-[11px] text-slate">@p 模式</span>{/if}
    {#if busy}<LoaderCircle size={15} class="animate-spin text-slate" />{/if}
    {#if tip}<span class="text-[11.5px] text-mint-dim flex items-center gap-1"><Check size={12} /> {tip}</span>{/if}
  </div>

  <!-- 标签筛选行:有标签才出现;只收窄工作视图,统计口径不受影响 -->
  {#if allTags.length}
    <div class="flex gap-1.5 mb-3 items-center flex-wrap">
      <button class="tab-btn tab-btn--sm" data-active={tagFilter === null} onclick={() => (tagFilter = null)}>全部</button>
      {#each allTags as tag}
        <button class="tab-btn tab-btn--sm" data-active={tagFilter === tag}
          onclick={() => (tagFilter = tagFilter === tag ? null : tag)}>#{tag}</button>
      {/each}
    </div>
  {/if}

  {#if error}
    <div class="card p-4 text-[13px] text-rise">读取失败:{error}</div>
  {:else if loading}
    <div class="card p-6 text-center text-slate text-[14px]">读取 00_待办.md …</div>
  {:else}
    <!-- ==================== 日视图 ==================== -->
    {#if sub === 'day'}
      <div class="card p-4 md:p-5">
        <div class="flex items-baseline justify-between mb-1">
          <h3 class="font-display text-[17px] flex items-center gap-1.5"><Flame size={16} /> 今天</h3>
          <span class="text-[12px] px-2 py-0.5 rounded-full border border-ink-black bg-mint-splash font-bold">{doneCountToday}/{dayTotal}</span>
        </div>
        <ul>
          {#each dayTasks as t (keyOf(t))}
            {@render taskRow(t)}
          {/each}
          {#if dayTasks.length === 0}<li class="py-3 text-[13px] text-slate">{views ? '今天没有承诺任务。下面录一条,或从待办池捞。' : '今天区空的。下面录一条,或从待办池捞。'}</li>{/if}
        </ul>

        <!-- 录入行:legacy 区选 chip / fields @p chip,回车写穿 -->
        <div class="mt-3 pt-3 border-t border-fog">
          <div class="flex gap-1.5 mb-2">
            {#if mode === 'fields'}
              {#each PROMISE_CHIPS as s}
                <button class="tab-btn tab-btn--sm" data-active={newPromise === s.key} onclick={() => (newPromise = s.key)}>{s.label}</button>
              {/each}
            {:else}
              {#each SECTIONS as s}
                <button class="tab-btn tab-btn--sm" data-active={newSection === s.key} onclick={() => (newSection = s.key)}>{s.label}</button>
              {/each}
            {/if}
          </div>
          <div class="flex gap-2">
            <input bind:value={newTask} placeholder={mode === 'fields' ? '记一条任务,回车写穿 @c+@p …' : '记一条任务,回车写穿 …'}
              class="flex-1 min-w-0 px-2.5 py-1.5 text-[13px] border border-ink-black rounded-[8px] bg-pure-white"
              onkeydown={(e) => e.key === 'Enter' && addNew()} />
            <button class="btn-mint flex-none" disabled={busy || !newTask.trim()} onclick={addNew}><Plus size={13} /> 记下</button>
          </div>
          <div class="mt-2 text-[12px] text-slate">{mode === 'fields' ? '勾选写穿 00_待办.md · 点任务开详情(块/状态操作/备注/@due)' : '勾选写穿 00_待办.md · 点任务开详情(移动/冻结/@due/删除)'}</div>
        </div>
      </div>

      <!-- 待办池折叠区 -->
      <div class="card p-4 md:p-5 mt-4">
        <button class="w-full flex items-center justify-between" onclick={() => (poolOpen = !poolOpen)}>
          <h3 class="font-display text-[17px] flex items-center gap-1.5"><Inbox size={16} /> 待办池</h3>
          <span class="flex items-center gap-1.5 text-[12px] text-slate">
            {poolTasks.length} 条
            {#if poolOpen}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
          </span>
        </button>
        {#if poolOpen}
          <ul class="mt-1">
            {#each poolTasks as t (keyOf(t))}
              {@render taskRow(t)}
            {/each}
            {#if poolTasks.length === 0}<li class="py-3 text-[13px] text-slate">池子空了。</li>{/if}
          </ul>
          <div class="text-[12px] text-slate mt-1">{mode === 'fields' ? '点任务弹窗可承诺 @p / 转等待 / 冻结' : '点任务弹窗可移动到 今天/本周'}</div>
        {/if}
      </div>
      <!-- 回收站折叠区(fields):软删除整块沉底带 @x,可恢复 -->
      {#if mode === 'fields' && trashTasks.length > 0}
        <div class="card p-4 md:p-5 mt-4">
          <button class="w-full flex items-center justify-between" onclick={() => (trashOpen = !trashOpen)}>
            <h3 class="font-display text-[17px] flex items-center gap-1.5"><Trash2 size={16} /> 回收站</h3>
            <span class="flex items-center gap-1.5 text-[12px] text-slate">
              {trashTasks.length} 条
              {#if trashOpen}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
            </span>
          </button>
          {#if trashOpen}
            <ul class="mt-1">
              {#each trashTasks as t (keyOf(t))}
                <li class="flex gap-2 items-center py-2 border-b border-fog last:border-b-0">
                  <span class="flex-1 min-w-0 text-[13px] text-slate line-through break-words"><WikiText text={t.title} onopen={openWiki} /></span>
                  <span class="text-[11px] text-slate whitespace-nowrap">{t.deletedDate?.slice(5)}</span>
                  <button class="btn-mint flex-none text-[11px]" disabled={busy}
                    onclick={() => act(async () => { await store.restoreTask(t) }, '已恢复')}>恢复</button>
                </li>
              {/each}
            </ul>
            <div class="text-[12px] text-slate mt-1">删除整块沉底带 @x 标记 · 恢复即清 @x 回活跃列表末尾</div>
          {/if}
        </div>
      {/if}
    {/if}
    {#if sub === 'week'}
      <div class="grid gap-4">
        <div class="card p-4 md:p-5">
          <h3 class="font-display text-[17px] mb-2 flex items-center gap-1.5"><CalendarDays size={16} /> 本周计划</h3>
          <ul>
            {#each weekPlan as t (keyOf(t))}
              {@render taskRow(t)}
            {/each}
            {#if weekPlan.length === 0}<li class="py-2 text-[13px] text-slate">本周计划空的。</li>{/if}
          </ul>
        </div>
        <div class="card p-4 md:p-5">
          <h3 class="font-display text-[17px] mb-2">本周已完成 <span class="num text-[20px] text-mint-dim">{weekDone.length}</span></h3>
          <ul class="text-[13px] text-slate space-y-1">
            {#each weekDone as t (keyOf(t))}
              <li class="flex items-baseline gap-1.5"><Check size={13} class="flex-none translate-y-0.5 text-mint-dim" /> <span class="flex-1 min-w-0 break-words">{t.title}</span> <span class="num">{t.doneDate?.slice(5)}</span></li>
            {/each}
            {#if weekDone.length === 0}<li>本周暂无完成记录</li>{/if}
          </ul>
        </div>
      </div>
    {/if}

    <!-- ==================== 等待视图(fields 专属):等待中 + 冻结 ==================== -->
    {#if sub === 'wait' && views}
      <div class="grid gap-4">
        <div class="card p-4 md:p-5">
          <h3 class="font-display text-[17px] mb-2 flex items-center gap-1.5"><Hourglass size={16} /> 等待中 <span class="num text-[14px] text-slate">{waitTasks.length}</span></h3>
          <ul>
            {#each waitTasks as t (keyOf(t))}
              {@render taskRow(t)}
            {/each}
            {#if waitTasks.length === 0}<li class="py-2 text-[13px] text-slate">没有等别人的事。</li>{/if}
          </ul>
        </div>
        <div class="card p-4 md:p-5">
          <h3 class="font-display text-[17px] mb-2 flex items-center gap-1.5"><Snowflake size={16} /> 冻结 <span class="num text-[14px] text-slate">{holdTasks.length}</span></h3>
          <ul>
            {#each holdTasks as t (keyOf(t))}
              {@render taskRow(t)}
            {/each}
            {#if holdTasks.length === 0}<li class="py-2 text-[13px] text-slate">无冻结任务。</li>{/if}
          </ul>
        </div>
      </div>
    {/if}

    <!-- ==================== 月视图(纯统计) ==================== -->
    {#if sub === 'month'}
      <div class="grid gap-4">
        <div class="card p-4 md:p-5">
          <h3 class="font-display text-[17px] mb-2">本月完成 <span class="num text-[28px] text-mint-dim">{monthDone.length}</span> 件</h3>
          <div class="text-[12.5px] text-slate">日均 {(monthDone.length / parseInt(todayS.slice(8))).toFixed(1)} 件</div>
        </div>
        <div class="card p-4 md:p-5">
          <div class="flex items-baseline justify-between mb-2">
            <h3 class="font-display text-[17px] flex items-center gap-1.5"><AlarmClock size={16} /> 滚动任务曝光榜</h3>
            <span class="text-[11px] text-slate">滚 ≥7 天</span>
          </div>
          <ul>
            {#each rolling as t (keyOf(t))}
              <li class="flex items-baseline gap-3 py-2 border-b border-fog last:border-b-0 cursor-pointer" onclick={() => openModal(t)}>
                <span class="num text-[20px] text-warn w-14 flex-none">D{t.days}</span>
                <span class="flex-1 min-w-0 text-[14px] break-words">{t.title}</span>
                <span class="text-[11px] text-slate whitespace-nowrap">@c {t.created.slice(5)}</span>
              </li>
            {/each}
            {#if rolling.length === 0}<li class="text-[13px] text-slate flex items-center gap-1.5">无滚动任务,干净利落 <Sparkles size={13} /></li>{/if}
          </ul>
        </div>
      </div>
    {/if}
  {/if}

  <!-- ==================== 任务详情弹窗(点遮罩/Esc 关闭) ==================== -->
  {#if openTask}
    {@const t = openTask}
    {@const desc = descOf(t)}
    <div class="wb-modal-overlay" role="dialog" aria-modal="true" onclick={() => (openKey = null)}>
      <div class="wb-modal" onclick={(e) => e.stopPropagation()}>
        <div class="card p-5 md:p-6 grid gap-4 [&>*]:min-w-0">
          <!-- 标题行 -->
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="font-display text-[19px] leading-snug break-words {t.status === 'done' ? 'line-through text-slate' : ''}">{t.title}</h3>
              <div class="text-[11.5px] text-slate mt-1">
                {SECTIONS.find((s) => s.key === t.section)?.label || t.section || ''}
                {t.created ? ` · @c ${t.created}` : ''}{t.doneDate ? ` · @d ${t.doneDate}` : ''}{t.holdDate ? ` · @h ${t.holdDate}` : ''}{t.due ? ` · @due ${t.due}` : ''}{t.promise ? ` · @p ${t.promise}` : ''}{t.wait ? ` · @w ${t.wait}` : ''}{t.rePromise ? ` · @r×${t.rePromise}` : ''}
              </div>
            </div>
            <div class="flex items-center gap-1.5 flex-none">
              {#each t.tags || [] as tag}
                <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black whitespace-nowrap {tag === '工作' ? 'bg-plum-ink text-pure-white' : 'bg-pure-white text-slate'}">#{tag}</span>
              {/each}
              {#if t.status === 'hold'}
                <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-sky-pop">冻结</span>
              {/if}
              {#if t.wait}
                <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-peach-pop flex items-center gap-0.5"><Hourglass size={10} /> 等待</span>
              {/if}
              <button class="tab-btn tab-btn--sm" onclick={() => (openKey = null)}><X size={13} /></button>
            </div>
          </div>

          <!-- 完整描述(md 上下文首次面板可见) -->
          {#if desc}
            <div class="text-[13px] text-charcoal leading-relaxed break-words border-l-2 border-fog pl-3"><WikiText text={desc} onopen={openWiki} /></div>
          {/if}

          <!-- fields 块渲染:续行 + 子任务(可勾写穿,3 层) -->
          {#if mode === 'fields' && t.block?.length}
            <div class="grid border-l-2 border-fog pl-3">
              {@render blockItems(t.block, 0, t)}
            </div>
          {/if}

          {#if t.status !== 'done' && t.status !== 'cancelled'}
            {#if mode === 'fields'}
              <!-- fields 状态操作:冻结/转等待/降级回池/取消,可附备注(写进任务块) -->
              <div>
                <div class="text-[12px] text-slate mb-1.5">状态操作(备注可选,追加进任务块)</div>
                <input bind:value={actionNote} placeholder="备注(可选):进展 / 原因 / 等待条件 …"
                  class="w-full px-2.5 py-1.5 text-[13px] border border-ink-black rounded-[8px] bg-pure-white mb-2" />
                <div class="flex gap-1.5 flex-wrap items-center">
                  {#if t.status === 'hold'}
                    <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => doAction(t, 'unhold')}>
                      <Sun size={13} /> 解冻
                    </button>
                  {:else}
                    <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => doAction(t, 'hold')}>
                      <Snowflake size={13} /> 冻结
                    </button>
                  {/if}
                  {#if t.wait}
                    <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => doAction(t, 'unwait')}>
                      <Hourglass size={13} /> 解除等待
                    </button>
                  {:else}
                    <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => doAction(t, 'wait')}>
                      <Hourglass size={13} /> 转等待
                    </button>
                  {/if}
                  {#if t.promise || t.wait || t.status === 'hold'}
                    <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => doAction(t, 'pool')}>
                      <Inbox size={13} /> 降级回池
                    </button>
                  {/if}
                  {#if confirmCancel}
                    <span class="text-[11.5px] text-warn">标 [-] 留档不再做</span>
                    <button class="tab-btn tab-btn--sm" style="background:var(--color-warn);color:#fff" disabled={busy}
                      onclick={() => doAction(t, 'cancel')}>确认取消</button>
                    <button class="tab-btn tab-btn--sm" onclick={() => (confirmCancel = false)}>不了</button>
                  {:else}
                    <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => (confirmCancel = true)}>
                      <Ban size={13} /> 取消
                    </button>
                  {/if}
                </div>
              </div>

              <!-- fields 承诺日 @p:改期触发 @r 再承诺计数;清除=回池 -->
              <div>
                <div class="text-[12px] text-slate mb-1.5 flex items-center gap-1"><CalendarDays size={12} /> 承诺日 @p(改期自动记 @r)</div>
                <div class="flex gap-2 items-center flex-wrap">
                  <input type="date" bind:value={promiseInput}
                    class="px-2 py-1.5 text-[13px] border border-ink-black rounded-[8px] bg-pure-white" />
                  <button class="btn-mint" disabled={busy || !promiseInput || promiseInput === t.promise}
                    onclick={() => act(() => store.setTaskPromise(t, promiseInput), '已承诺 @p')}>存</button>
                  {#if t.promise}
                    <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => act(async () => { await store.setTaskPromise(t, null); promiseInput = '' }, '已清 @p(回池)')}>清除</button>
                  {/if}
                </div>
              </div>
            {:else}
              <!-- legacy 移动到 -->
              <div>
                <div class="text-[12px] text-slate mb-1.5">移动到</div>
                <div class="flex gap-1.5 flex-wrap">
                  {#each SECTIONS as s}
                    <button class="tab-btn tab-btn--sm" disabled={busy || t.section === s.key}
                      onclick={() => act(() => store.moveTask(t, s.key), `已移到${s.label}`)}>{s.label}</button>
                  {/each}
                </div>
              </div>

              <!-- legacy 冻结/取消(取消二次确认) -->
              <div class="flex gap-1.5 flex-wrap items-center">
                {#if t.status === 'hold'}
                  <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => act(() => store.setTaskHold(t, false), '已解冻')}>
                    <Sun size={13} /> 解冻
                  </button>
                {:else}
                  <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => act(() => store.setTaskHold(t, true), '已冻结')}>
                    <Snowflake size={13} /> 冻结
                  </button>
                {/if}
                {#if confirmCancel}
                  <span class="text-[11.5px] text-warn">标 [-] 留档不再做</span>
                  <button class="tab-btn tab-btn--sm" style="background:var(--color-warn);color:#fff" disabled={busy}
                    onclick={() => act(() => store.cancelTask(t), '已取消(留档 [-])')}>确认取消</button>
                  <button class="tab-btn tab-btn--sm" onclick={() => (confirmCancel = false)}>不了</button>
                {:else}
                  <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => (confirmCancel = true)}>
                    <Ban size={13} /> 取消
                  </button>
                {/if}
              </div>
            {/if}

            <!-- @due 截止日(双模式通用) -->
            <div>
              <div class="text-[12px] text-slate mb-1.5 flex items-center gap-1"><CalendarClock size={12} /> 截止日(硬截止才设,临期高亮)</div>
              <div class="flex gap-2 items-center flex-wrap">
                <input type="date" bind:value={dueInput}
                  class="px-2 py-1.5 text-[13px] border border-ink-black rounded-[8px] bg-pure-white" />
                <button class="btn-mint" disabled={busy || !dueInput || dueInput === t.due}
                  onclick={() => act(() => store.setTaskDue(t, dueInput), '已设 @due')}>存</button>
                {#if t.due}
                  <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => act(async () => { await store.setTaskDue(t, null); dueInput = '' }, '已清除 @due')}>清除</button>
                {/if}
              </div>
            </div>
          {/if}

          <!-- 删除(二次确认) -->
          <div class="flex justify-end gap-1.5 pt-1 border-t border-fog">
            {#if confirmDelete}
              <span class="text-[11.5px] text-rise self-center">移入回收站,可恢复</span>
              <button class="tab-btn tab-btn--sm" style="background:var(--color-rise);color:#fff" disabled={busy}
                onclick={() => act(async () => { await store.deleteTask(t); openKey = null }, '已入回收站')}>确认删除</button>
              <button class="tab-btn tab-btn--sm" onclick={() => (confirmDelete = false)}>取消</button>
            {:else}
              <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => (confirmDelete = true)}><Trash2 size={13} /> 删除</button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && openTask) openKey = null }} />
