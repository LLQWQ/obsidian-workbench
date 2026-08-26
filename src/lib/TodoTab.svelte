<!-- 待办 tab:热力图(点击明细) + 日/周/月三视图 + 任务弹窗全生命周期操作,真读写 00_待办.md -->
<script>
  import { onMount } from 'svelte'
  import Heatmap from './Heatmap.svelte'
  import {
    Flame, CalendarDays, Inbox, Check, Sparkles, AlarmClock, Plus, X, Trash2,
    ChevronDown, ChevronUp, Snowflake, Sun, CalendarClock, Ban, LoaderCircle,
  } from '@lucide/svelte'

  let { store } = $props()

  let todos = $state([])
  let loading = $state(true)
  let error = $state(null)
  let sub = $state('day') // day | week | month
  let busy = $state(false)
  let tip = $state('')

  // 录入行
  let newTask = $state('')
  let newSection = $state('today')

  // 待办池折叠
  let poolOpen = $state(false)

  // 热力图点击明细
  let selectedDate = $state(null)

  // 任务弹窗
  let openKey = $state(null) // `${title}|${created}`
  let confirmDelete = $state(false)
  let dueInput = $state('')

  // 过夜归档守卫
  let archiving = $state(false)

  const today = new Date()
  const todayS = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const weekStartS = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
  const monthStartS = todayS.slice(0, 8) + '01'

  const SECTIONS = [
    { key: 'today', label: '今天' },
    { key: 'week', label: '本周' },
    { key: 'pool', label: '待办池' },
  ]
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
      todos = await store.getTodos()
      error = null
    } catch (e) {
      error = String(e)
    } finally {
      loading = false
    }
  }

  // 过夜自动归档:非已完成区的 [x] 且 @d<今天 → 静默移入已完成区
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

  async function addNew() {
    const title = newTask.trim()
    if (!title) return
    await act(async () => {
      await store.addTask({ title, section: newSection })
      newTask = ''
    }, `已入${SECTIONS.find((s) => s.key === newSection).label}`)
  }

  function openModal(t) {
    openKey = keyOf(t)
    confirmDelete = false
    dueInput = t.due || ''
  }

  function daysSince(d) {
    return Math.floor((Date.parse(todayS) - Date.parse(d)) / 86400000)
  }

  // 弹窗描述:body 去粗体标题 + 去元数据标记 + 去前导破折号
  function descOf(t) {
    let s = t.body
      .replace(/^\*\*(.+?)\*\*/, '')
      .replace(/\s*@(c|s|d|h|due)\(\d{4}-\d{2}-\d{2}\)/g, '')
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

  let dayTasks = $derived(todos.filter((t) => t.section === 'today'))
  let weekPlan = $derived(todos.filter((t) => t.section === 'week' && t.status !== 'done' && t.status !== 'cancelled'))
  let weekDone = $derived(todos.filter((t) => t.doneDate && t.doneDate >= weekStartS))
  let poolTasks = $derived(todos.filter((t) => t.section === 'pool' && t.status !== 'done' && t.status !== 'cancelled'))
  let monthDone = $derived(todos.filter((t) => t.doneDate && t.doneDate >= monthStartS))
  let rolling = $derived(
    todos
      .filter((t) => (t.status === 'todo' || t.status === 'hold') && t.created && daysSince(t.created) >= 7)
      .map((t) => ({ ...t, days: daysSince(t.created) }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 10),
  )

  let doneCountToday = $derived(dayTasks.filter((t) => t.status === 'done').length)
  let openTask = $derived(todos.find((t) => keyOf(t) === openKey) || null)
</script>

<!-- 任务行(日/周/池三处复用):勾选框 + 标题 + 徽章;点行开弹窗 -->
{#snippet taskRow(t)}
  {@const roll = t.created ? daysSince(t.created) : 0}
  {@const due = dueBadge(t)}
  <li class="flex gap-3 py-2.5 border-b border-fog last:border-b-0 cursor-pointer" onclick={() => openModal(t)}>
    <button class="task-check" data-done={t.status === 'done'} onclick={(e) => { e.stopPropagation(); toggle(t) }} aria-label="勾选">
      <svg viewBox="0 0 12 12"><path d="M2 6.5 L5 9.2 L10 3" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <div class="flex-1 min-w-0">
      <div class="text-[15px] font-medium leading-snug break-words {t.status === 'done' ? 'line-through text-slate' : ''}">{t.title}</div>
      {#if t.created}
        <div class="text-[11.5px] text-slate mt-0.5">@c {t.created}</div>
      {/if}
    </div>
    {#if t.status === 'hold'}
      <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-sky-pop whitespace-nowrap">冻结</span>
    {:else if t.status === 'done'}
      <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-mint-splash whitespace-nowrap">{t.doneDate?.slice(5)}</span>
    {:else}
      {#if due}
        <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black whitespace-nowrap {due.danger ? 'bg-rise text-pure-white' : 'bg-warn'}">{due.text}</span>
      {:else if roll >= 7}
        <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-peach-pop whitespace-nowrap">滚动 D{roll}</span>
      {/if}
    {/if}
  </li>
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

  <!-- 子 tab:日/周/月 + 操作提示 -->
  <div class="flex gap-2 mb-3 items-center">
    {#each [['day', '日'], ['week', '周'], ['month', '月']] as [key, label]}
      <button class="tab-btn tab-btn--sm" data-active={sub === key} onclick={() => (sub = key)}>
        {label}
      </button>
    {/each}
    {#if busy}<LoaderCircle size={15} class="animate-spin text-slate" />{/if}
    {#if tip}<span class="text-[11.5px] text-mint-dim flex items-center gap-1"><Check size={12} /> {tip}</span>{/if}
  </div>

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
          <span class="text-[12px] px-2 py-0.5 rounded-full border border-ink-black bg-mint-splash font-bold">{doneCountToday}/{dayTasks.length}</span>
        </div>
        <ul>
          {#each dayTasks as t (keyOf(t))}
            {@render taskRow(t)}
          {/each}
          {#if dayTasks.length === 0}<li class="py-3 text-[13px] text-slate">今天区空的。下面录一条,或从待办池捞。</li>{/if}
        </ul>

        <!-- 录入行:区选 chip + 输入,回车写穿 -->
        <div class="mt-3 pt-3 border-t border-fog">
          <div class="flex gap-1.5 mb-2">
            {#each SECTIONS as s}
              <button class="tab-btn tab-btn--sm" data-active={newSection === s.key} onclick={() => (newSection = s.key)}>{s.label}</button>
            {/each}
          </div>
          <div class="flex gap-2">
            <input bind:value={newTask} placeholder="记一条任务,回车写穿 …"
              class="flex-1 min-w-0 px-2.5 py-1.5 text-[13px] border border-ink-black rounded-[8px] bg-pure-white"
              onkeydown={(e) => e.key === 'Enter' && addNew()} />
            <button class="btn-mint flex-none" disabled={busy || !newTask.trim()} onclick={addNew}><Plus size={13} /> 记下</button>
          </div>
          <div class="mt-2 text-[12px] text-slate">勾选写穿 00_待办.md · 点任务开详情(移动/冻结/@due/删除)</div>
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
          <div class="text-[12px] text-slate mt-1">点任务弹窗可移动到 今天/本周</div>
        {/if}
      </div>
    {/if}

    <!-- ==================== 周视图 ==================== -->
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
                {SECTIONS.find((s) => s.key === t.section)?.label || t.section}
                {t.created ? ` · @c ${t.created}` : ''}{t.doneDate ? ` · @d ${t.doneDate}` : ''}{t.holdDate ? ` · @h ${t.holdDate}` : ''}{t.due ? ` · @due ${t.due}` : ''}
              </div>
            </div>
            <div class="flex items-center gap-1.5 flex-none">
              {#if t.status === 'hold'}
                <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-sky-pop">冻结</span>
              {/if}
              <button class="tab-btn tab-btn--sm" onclick={() => (openKey = null)}><X size={13} /></button>
            </div>
          </div>

          <!-- 完整描述(md 上下文首次面板可见) -->
          {#if desc}
            <div class="text-[13px] text-charcoal leading-relaxed break-words border-l-2 border-fog pl-3">{desc}</div>
          {/if}

          <!-- 移动到 -->
          {#if t.status !== 'done' && t.status !== 'cancelled'}
            <div>
              <div class="text-[12px] text-slate mb-1.5">移动到</div>
              <div class="flex gap-1.5 flex-wrap">
                {#each SECTIONS as s}
                  <button class="tab-btn tab-btn--sm" disabled={busy || t.section === s.key}
                    onclick={() => act(() => store.moveTask(t, s.key), `已移到${s.label}`)}>{s.label}</button>
                {/each}
              </div>
            </div>

            <!-- 冻结/取消 -->
            <div class="flex gap-1.5 flex-wrap">
              {#if t.status === 'hold'}
                <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => act(() => store.setTaskHold(t, false), '已解冻')}>
                  <Sun size={13} /> 解冻
                </button>
              {:else}
                <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => act(() => store.setTaskHold(t, true), '已冻结')}>
                  <Snowflake size={13} /> 冻结
                </button>
              {/if}
              <button class="tab-btn tab-btn--sm" disabled={busy} onclick={() => act(() => store.cancelTask(t), '已取消(留档 [-])')}>
                <Ban size={13} /> 取消
              </button>
            </div>

            <!-- @due 截止日 -->
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
              <span class="text-[11.5px] text-rise self-center">物理删行,不可恢复</span>
              <button class="tab-btn tab-btn--sm" style="background:var(--color-rise);color:#fff" disabled={busy}
                onclick={() => act(async () => { await store.deleteTask(t); openKey = null }, '已删除')}>确认删除</button>
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
