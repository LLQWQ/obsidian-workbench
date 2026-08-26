<!-- 待办 tab:任务热力图 + 日/周/月三视图,真读写 00_待办.md -->
<script>
  import { onMount } from 'svelte'
  import Heatmap from './Heatmap.svelte'
  import { Flame, CalendarDays, Inbox, Check, Sparkles, AlarmClock } from '@lucide/svelte'

  let { store } = $props()

  let todos = $state([])
  let loading = $state(true)
  let error = $state(null)
  let sub = $state('day') // day | week | month
  let busy = $state(false)

  const today = new Date()
  const todayS = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const weekStartS = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
  const monthStartS = todayS.slice(0, 8) + '01'

  onMount(() => {
    reload()
    // 订阅文件变化:自写广播 + 外部修改(Obsync/手改)都触发重读
    const off = store.onChange?.((p) => {
      if (p === 'wiki/00_待办.md') reload()
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

  async function toggle(t) {
    if (busy) return
    busy = true
    // 乐观更新:UI 立刻翻转,不等落盘
    const target = t.status === 'done' ? 'todo' : 'done'
    todos = todos.map((x) => (x === t ? { ...x, status: target, doneDate: target === 'done' ? todayS : null } : x))
    try {
      await store.toggleTask(t)
      await reload()
    } catch (e) {
      error = String(e)
      await reload() // 失败回滚到文件真实状态
    } finally {
      busy = false
    }
  }

  function daysSince(d) {
    return Math.floor((Date.parse(todayS) - Date.parse(d)) / 86400000)
  }

  // ---------- 聚合 ----------
  let doneByDate = $derived.by(() => {
    const m = {}
    for (const t of todos) {
      if (t.doneDate) m[t.doneDate] = (m[t.doneDate] || 0) + 1
    }
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
</script>

<div>
  <!-- 任务完成热力图 -->
  <div class="card p-4 md:p-5 mb-4">
    <div class="flex items-baseline justify-between mb-2">
      <h3 class="font-display text-[17px]">任务完成热力图</h3>
      <span class="text-[11px] text-slate">近 20 周 · 点击格子看日期</span>
    </div>
    <Heatmap data={doneByDate} weeks={20} thresholds={[0, 1, 2, 4]} />
  </div>

  <!-- 子 tab:日/周/月 -->
  <div class="flex gap-2 mb-3">
    {#each [['day', '日'], ['week', '周'], ['month', '月']] as [key, label]}
      <button class="tab-btn tab-btn--sm" data-active={sub === key} onclick={() => (sub = key)}>
        {label}
      </button>
    {/each}
  </div>

  {#if error}
    <div class="card p-4 text-[13px] text-rise">读取失败:{error}</div>
  {:else if loading}
    <div class="card p-6 text-center text-slate text-[14px]">读取 00_待办.md …</div>
  {:else}
    <!-- 日视图 -->
    {#if sub === 'day'}
      <div class="card p-4 md:p-5">
        <div class="flex items-baseline justify-between mb-1">
          <h3 class="font-display text-[17px] flex items-center gap-1.5"><Flame size={16} /> 今天</h3>
          <span class="text-[12px] px-2 py-0.5 rounded-full border border-ink-black bg-mint-splash font-bold">{doneCountToday}/{dayTasks.length}</span>
        </div>
        <ul>
          {#each dayTasks as t (t.line + t.title)}
            {@const roll = t.created ? daysSince(t.created) : 0}
            <li class="flex gap-3 py-2.5 border-b border-fog last:border-b-0">
              <button class="task-check" data-done={t.status === 'done'} onclick={() => toggle(t)} aria-label="勾选">
                <svg viewBox="0 0 12 12"><path d="M2 6.5 L5 9.2 L10 3" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
              <div class="flex-1 min-w-0">
                <div class="text-[15px] font-medium leading-snug {t.status === 'done' ? 'line-through text-slate' : ''}">{t.title}</div>
                {#if t.created}
                  <div class="text-[11.5px] text-slate mt-0.5">@c {t.created}</div>
                {/if}
              </div>
              {#if t.status === 'hold'}
                <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-sky-pop whitespace-nowrap">冻结</span>
              {:else if t.status === 'done'}
                <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-mint-splash whitespace-nowrap">{t.doneDate?.slice(5)}</span>
              {:else if roll >= 7}
                <span class="self-start text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-peach-pop whitespace-nowrap">滚动 D{roll}</span>
              {/if}
            </li>
          {/each}
        </ul>
        <div class="mt-3 text-[12.5px] text-slate">勾选写穿 00_待办.md · 自动补 @d</div>
      </div>
    {/if}

    <!-- 周视图 -->
    {#if sub === 'week'}
      <div class="grid gap-4">
        <div class="card p-4 md:p-5">
          <h3 class="font-display text-[17px] mb-2 flex items-center gap-1.5"><CalendarDays size={16} /> 本周计划</h3>
          <ul>
            {#each weekPlan as t (t.line + t.title)}
              {@const roll = t.created ? daysSince(t.created) : 0}
              <li class="flex gap-3 py-2 border-b border-fog last:border-b-0 text-[14px]">
                <span class="flex-1 min-w-0">{t.title}</span>
                {#if t.status === 'hold'}
                  <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-sky-pop whitespace-nowrap">冻结</span>
                {:else if roll >= 7}
                  <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-peach-pop whitespace-nowrap">D{roll}</span>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
        <div class="card p-4 md:p-5">
          <h3 class="font-display text-[17px] mb-2">本周已完成 <span class="num text-[20px] text-mint-dim">{weekDone.length}</span></h3>
          <ul class="text-[13px] text-slate space-y-1">
            {#each weekDone as t (t.line + t.title)}
              <li class="flex items-baseline gap-1.5"><Check size={13} class="flex-none translate-y-0.5 text-mint-dim" /> <span class="flex-1">{t.title}</span> <span class="num">{t.doneDate?.slice(5)}</span></li>
            {/each}
            {#if weekDone.length === 0}<li>本周暂无完成记录</li>{/if}
          </ul>
        </div>
      </div>
    {/if}

    <!-- 月视图 -->
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
            {#each rolling as t (t.line + t.title)}
              <li class="flex items-baseline gap-3 py-2 border-b border-fog last:border-b-0">
                <span class="num text-[20px] text-warn w-14 flex-none">D{t.days}</span>
                <span class="flex-1 min-w-0 text-[14px]">{t.title}</span>
                <span class="text-[11px] text-slate whitespace-nowrap">@c {t.created.slice(5)}</span>
              </li>
            {/each}
            {#if rolling.length === 0}<li class="text-[13px] text-slate flex items-center gap-1.5">无滚动任务,干净利落 <Sparkles size={13} /></li>{/if}
          </ul>
        </div>
        <div class="card p-4 md:p-5">
          <h3 class="font-display text-[17px] mb-2 flex items-center gap-1.5"><Inbox size={16} /> 待办池</h3>
          <ul class="space-y-1.5 text-[14px]">
            {#each poolTasks as t (t.line + t.title)}
              <li class="flex gap-2"><span class="text-slate">·</span><span class="flex-1">{t.title}</span></li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
  {/if}
</div>
