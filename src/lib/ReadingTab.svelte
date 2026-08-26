<!-- 读书 tab:队列/在读/档案/感想 四子页签 + 卡关联视图(感想/摘录/摄取/相关待办) + 文章内置阅读器 -->
<script>
  import { onMount } from 'svelte'
  import {
    Inbox, BookOpen, Archive, Lightbulb, Plus, Minus, Check, X, Pencil, Trash2, LoaderCircle,
    ExternalLink, Sparkles, Search, Quote, NotebookPen, RotateCcw, FileText, ListChecks,
  } from '@lucide/svelte'

  let { store } = $props()

  let loading = $state(true)
  let error = $state(null)
  let books = $state([])
  let articles = $state([])
  let sub = $state('queue')
  let openPath = $state(null)     // 展开关联视图的卡
  let relatedMap = $state({})     // path → { sources, tasks }
  let newBook = $state('')
  let thoughtInput = $state('')
  let excerptInput = $state('')
  let q = $state('')
  let filter = $state('all')      // all | book | article | dropped
  let saving = $state(false)
  let tip = $state('')
  let editing = $state(null)      // `${path}|${区名}|${idx}` 正在编辑的条目
  let editText = $state('')
  let confirmDelete = $state(null) // 二次确认:第一次点删除=path 入此,再点确认才真删

  const today = new Date()
  const todayS = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const phColors = ['#99ffcc', '#7bbbff', '#ffcc99', '#ff99cc']
  const subs = [
    { key: 'queue', label: '队列', icon: Inbox },
    { key: 'reading', label: '在读', icon: BookOpen },
    { key: 'archive', label: '档案', icon: Archive },
    { key: 'thoughts', label: '感想', icon: Lightbulb },
  ]

  function ph(title) {
    let h = 0
    for (const ch of title || '?') h = (h + ch.charCodeAt(0)) % phColors.length
    return phColors[h]
  }
  function chipColor(status) {
    return {
      想读: 'bg-sky-pop', 'to-read': 'bg-sky-pop',
      在读: 'bg-mint-splash',
      已读: 'bg-fog', read: 'bg-fog',
      弃读: 'bg-peach-pop', archived: 'bg-peach-pop',
    }[status] || 'bg-fog'
  }
  function statusLabel(c) {
    return { 'to-read': '待读', read: '已读', archived: '已归档' }[c.status] || c.status
  }

  onMount(() => {
    reload()
    const off = store.onChange?.((p) => {
      if (p.startsWith('wiki/读书/') || p.startsWith('wiki/raw/articles/') || p === 'wiki/00_待办.md') reload()
    })
    return () => off?.()
  })

  async function reload() {
    try {
      const data = await store.getReading()
      books = data.books
      articles = data.articles
      error = null
      if (openPath) {
        const c = [...books, ...articles].find((x) => x.path === openPath)
        if (c) relatedMap[openPath] = await store.getRelated(c)
        else openPath = null
      }
    } catch (e) {
      error = String(e)
    } finally {
      loading = false
    }
  }

  async function act(fn, tipText) {
    saving = true
    try {
      await fn()
      if (tipText) { tip = tipText; setTimeout(() => (tip = ''), 2500) }
    } catch (e) {
      error = String(e)
    } finally {
      saving = false
    }
  }

  async function toggleOpen(c) {
    if (openPath === c.path) { openPath = null; return }
    openPath = c.path
    thoughtInput = ''
    excerptInput = ''
    confirmDelete = null
    relatedMap[c.path] = await store.getRelated(c)
  }

  // ---- 卡片角标删除:点角标→确认态(3s 超时复位),再点真删;与弹窗删除共用 confirmDelete ----
  let deleteTimer = null
  function armDelete(c) {
    confirmDelete = c.path
    clearTimeout(deleteTimer)
    deleteTimer = setTimeout(() => (confirmDelete = null), 3000)
  }
  async function doDelete(c) {
    clearTimeout(deleteTimer)
    await act(async () => {
      await store.deleteCard(c)
      confirmDelete = null
      if (openPath === c.path) openPath = null
    }, '已删除')
  }

  // ---- 取消摄取:排队 chip 点一下→确认态(3s 复位),再点回退;与删除角标同一确认语言 ----
  let confirmUningest = $state(null)
  let uningestTimer = null
  function armUningest(c) {
    confirmUningest = c.path
    clearTimeout(uningestTimer)
    uningestTimer = setTimeout(() => (confirmUningest = null), 3000)
  }
  async function doUningest(c) {
    clearTimeout(uningestTimer)
    await act(async () => {
      await store.updateCard(c.path, { ingest: '' })
      confirmUningest = null
    }, '已取消摄取排队')
  }

  function jumpTo(c) {
    sub = c.status === '在读' ? 'reading' : (c.status === '想读' || c.status === 'to-read') ? 'queue' : 'archive'
    openPath = null
    toggleOpen(c)
  }

  // ---- 条目改/删(感想/摘录) ----
  function startEdit(c, heading, idx, cur) {
    editing = `${c.path}|${heading}|${idx}`
    editText = cur
  }
  async function saveEdit(c, heading, idx) {
    if (!editText.trim()) return
    await act(() => store.updateCardEntry(c.path, heading, idx, editText.trim()), '已更新')
    editing = null
  }
  async function delEntry(c, heading, idx) {
    await act(() => store.deleteCardEntry(c.path, heading, idx), '已删除')
  }

  // 放回队列:书→想读(进度清零),文章→to-read;都清 finished
  async function requeue(c) {
    await act(
      () => store.updateCard(c.path, c.kind === 'book' ? { status: '想读', finished: '', progress: 0 } : { status: 'to-read', finished: '' }),
      '已放回队列',
    )
  }

  // ---- 分组 ----
  let queueItems = $derived.by(() =>
    [...books.filter((b) => b.status === '想读'), ...articles.filter((a) => a.status === 'to-read')]
      .sort((a, b) => (b.added || '').localeCompare(a.added || '')),
  )
  let readingBooks = $derived(books.filter((b) => b.status === '在读'))
  let archiveItems = $derived.by(() => {
    let items = [
      ...books.filter((b) => b.status === '已读' || b.status === '弃读'),
      ...articles.filter((a) => ['read', 'archived'].includes(a.status)),
    ]
    if (filter === 'book') items = items.filter((c) => c.kind === 'book')
    else if (filter === 'article') items = items.filter((c) => c.kind === 'article')
    else if (filter === 'dropped') items = items.filter((c) => c.status === '弃读' || c.status === 'archived')
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      items = items.filter((c) =>
        c.title.toLowerCase().includes(s)
        || c.thoughts.some((t) => t.text.toLowerCase().includes(s))
        || c.excerpts.some((t) => t.text.toLowerCase().includes(s)),
      )
    }
    return items.sort((a, b) => (b.finished || b.added || '').localeCompare(a.finished || a.added || ''))
  })
  let stats = $derived.by(() => {
    const y = String(today.getFullYear())
    return {
      y,
      nb: books.filter((b) => b.status === '已读' && (b.finished || '').startsWith(y)).length,
      na: articles.filter((a) => a.status === 'read' && (a.finished || '').startsWith(y)).length,
    }
  })
  let thoughtsFlow = $derived.by(() => {
    const rows = []
    for (const c of [...books, ...articles]) for (const t of c.thoughts) rows.push({ card: c, ...t })
    return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  })
  let thoughtCount = $derived(thoughtsFlow.length)
  let openCard = $derived([...books, ...articles].find((x) => x.path === openPath) || null)
</script>

<!-- 卡封面区:有封面图用图,无封面 pastel 色块首字(新闻卡同语言) -->
{#snippet coverBlock(c, h)}
  {#if c.cover}
    <img src={store.coverUrl(c.cover)} alt="" class="w-full {h} object-cover border-b border-ink-black bg-cream-paper" />
  {:else}
    <div class="{h} border-b border-ink-black grid place-items-center" style="background:{ph(c.title)}">
      <span class="font-display text-[26px] leading-none text-ink-black">{c.title.slice(0, 1)}</span>
    </div>
  {/if}
{/snippet}

<!-- 删除角标:卡片右上角,点一下变确认态(3s 复位),再点真删;stopPropagation 防开弹窗 -->
{#snippet cornerDelete(c)}
  <span class="absolute top-2 right-2 z-10 flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
    {#if confirmDelete === c.path}
      <button class="text-[11px] px-2 py-1 rounded-full border border-ink-black bg-rise text-pure-white font-bold" disabled={saving}
        onclick={() => doDelete(c)}>确认删?</button>
      <button class="w-6 h-6 grid place-items-center rounded-full border border-ink-black bg-pure-white" onclick={() => (confirmDelete = null)}><X size={12} /></button>
    {:else}
      <button class="w-6 h-6 grid place-items-center rounded-full border border-ink-black bg-pure-white text-rise" title="删除"
        onclick={() => armDelete(c)}><Trash2 size={12} /></button>
    {/if}
  </span>
{/snippet}

<!-- 图标钮组:读全文(有 raw 源文件时) + 打开卡 -->
{#snippet iconActs(c)}
  {#if c.sourceFile}
    <button class="w-7 h-7 grid place-items-center rounded-full border border-ink-black bg-pure-white hover:bg-mint-splash" title="读全文"
      onclick={() => store.openPage(c.sourceFile)}><FileText size={13} /></button>
  {/if}
  <button class="w-7 h-7 grid place-items-center rounded-full border border-ink-black bg-pure-white hover:bg-mint-splash" title="打开卡"
    onclick={() => store.openPage(c.path)}><ExternalLink size={13} /></button>
{/snippet}

<!-- 摄取闭环(仅文章卡):摄取 → 排队中(loader 动效,点→确认态再点取消) → 已摄取 -->
{#snippet ingestCtl(c)}
  {#if c.kind === 'article'}
    {#if c.ingest === 'pending'}
      {#if confirmUningest === c.path}
        <button class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-rise text-pure-white font-bold" disabled={saving}
          onclick={() => doUningest(c)}>取消排队?</button>
      {:else}
        <button class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-bubblegum flex items-center gap-1" title="摄取排队中,点击可取消" disabled={saving}
          onclick={() => armUningest(c)}>
          <LoaderCircle size={11} class="animate-spin" /> 摄取排队中
        </button>
      {/if}
    {:else if c.ingest === 'ingested'}
      <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-mint-splash flex items-center gap-1"><Check size={11} /> 已摄取</span>
    {:else}
      <button class="w-7 h-7 grid place-items-center rounded-full border border-ink-black bg-pure-white hover:bg-bubblegum" title="摄取" disabled={saving}
        onclick={() => act(() => store.updateCard(c.path, { ingest: 'pending' }), '已标记摄取')}><Sparkles size={13} /></button>
    {/if}
  {/if}
{/snippet}

<!-- 摘录/感想通用区:条目可改可删,追加写穿 -->
{#snippet entryEditor(c, heading, items, dated)}
  <div>
    <div class="text-[12.5px] font-bold flex items-center gap-1.5 mb-1.5">
      {#if heading === '摘录'}<Quote size={13} />{:else}<NotebookPen size={13} />{/if}
      {heading} ({items.length})
    </div>
    {#if items.length}
      <ul class="space-y-1.5 text-[12.5px] text-charcoal">
        {#each items as t, ti}
          <li class="flex gap-2 items-start">
            {#if editing === `${c.path}|${heading}|${ti}`}
              <input bind:value={editText}
                class="flex-1 px-2 py-1 text-[12.5px] border border-ink-black rounded-[8px] bg-pure-white"
                onkeydown={(e) => e.key === 'Enter' && saveEdit(c, heading, ti)} />
              <button class="btn-mint" disabled={saving} onclick={() => saveEdit(c, heading, ti)}>存</button>
              <button class="tab-btn tab-btn--sm" onclick={() => (editing = null)}><X size={12} /></button>
            {:else}
              {#if dated}<span class="text-[11px] text-slate w-9 flex-none pt-0.5 num">{t.date}</span>{/if}
              {#if heading === '摘录'}
                <span class="border-l-2 border-ink-black pl-2.5 flex-1 min-w-0 break-words">{t.text}</span>
              {:else}
                <span class="flex-1 min-w-0 break-words">{t.text}</span>
              {/if}
              <button class="text-slate hover:text-ink-black flex-none pt-1" title="改" onclick={() => startEdit(c, heading, ti, t.text)}><Pencil size={12} /></button>
              <button class="text-slate hover:text-rise flex-none pt-1" title="删" onclick={() => delEntry(c, heading, ti)}><X size={12} /></button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    <div class="flex gap-2 mt-2">
      {#if heading === '摘录'}
        <input bind:value={excerptInput} placeholder="抄一句原文金句 …"
          class="flex-1 px-2.5 py-1.5 text-[13px] border border-ink-black rounded-[8px] bg-pure-white" />
        <button class="btn-mint" disabled={saving || !excerptInput.trim()}
          onclick={() => act(async () => { await store.addCardExcerpt(c.path, excerptInput.trim()); excerptInput = '' }, '已写入卡的摘录区')}>记下</button>
      {:else}
        <input bind:value={thoughtInput} placeholder="我的想法 …"
          class="flex-1 px-2.5 py-1.5 text-[13px] border border-ink-black rounded-[8px] bg-pure-white" />
        <button class="btn-mint" disabled={saving || !thoughtInput.trim()}
          onclick={() => act(async () => { await store.addCardThought(c.path, thoughtInput.trim()); thoughtInput = '' }, '已写入卡的感想区')}>记下</button>
      {/if}
    </div>
  </div>
{/snippet}


{#snippet detail(c)}
  <div class="card p-5 md:p-6 grid gap-4 [&>*]:min-w-0">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="font-display text-[19px] leading-snug">{c.title}</h3>
        <div class="text-[11.5px] text-slate mt-1">
          {c.kind === 'book' ? '书' : '文章'}{c.author ? ` · ${c.author}` : ''} · 入列 {c.added || c.captured || '—'}{c.finished ? ` · 读完 ${c.finished}` : ''}
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-none">
        <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black {chipColor(c.status)}">{statusLabel(c)}</span>
        <button class="tab-btn tab-btn--sm" onclick={() => (openPath = null)}><X size={13} /></button>
      </div>
    </div>

    <!-- 书:进度 + 评分 -->
    {#if c.kind === 'book'}
      <div>
        <div class="flex items-center justify-between text-[12px] text-slate mb-1.5">
          <span>阅读进度</span><span class="num text-[15px] text-ink-black">{c.progress}%</span>
        </div>
        <div class="h-2.5 rounded-full border border-ink-black bg-pure-white overflow-hidden">
          <div class="h-full bg-mint-splash" style="width:{c.progress}%"></div>
        </div>
        {#if c.status === '在读'}
          <div class="flex items-center gap-2 mt-2.5 flex-wrap">
            <button class="tab-btn tab-btn--sm" disabled={saving} onclick={() => act(() => store.setCardProgress(c.path, c.progress - 10))}><Minus size={13} />10</button>
            <input type="range" min="0" max="100" step="5" value={c.progress}
              class="flex-1 min-w-[120px] accent-mint-splash"
              onchange={(e) => act(() => store.setCardProgress(c.path, +e.currentTarget.value))} />
            <button class="tab-btn tab-btn--sm" disabled={saving} onclick={() => act(() => store.setCardProgress(c.path, c.progress + 10))}><Plus size={13} />10</button>
          </div>
        {/if}
        <div class="flex items-center gap-1.5 mt-3 flex-wrap">
          <span class="text-[12px] text-slate mr-1">评分</span>
          {#each ['强推', '可读', '不推荐'] as r}
            <button class="tab-btn tab-btn--sm" data-active={c.rating === r} disabled={saving}
              onclick={() => act(() => store.updateCard(c.path, { rating: c.rating === r ? '' : r }))}>{r}</button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- 动作行:读全文(开 raw 源文件)/原文/摄取/打开卡 -->
    <div>
      <div class="flex gap-1.5 flex-wrap items-center">
        {#if c.sourceFile}
          <button class="tab-btn tab-btn--sm" onclick={() => store.openPage(c.sourceFile)}>
            <FileText size={13} /> 读全文
          </button>
        {/if}
        {#if c.sourceUrl}
          <button class="tab-btn tab-btn--sm" onclick={() => window.open(c.sourceUrl, '_blank')}>原文 <ExternalLink size={13} /></button>
        {/if}
        {#if c.kind === 'article'}
          {#if !c.ingest}
            <button class="tab-btn tab-btn--sm" disabled={saving}
              onclick={() => act(() => store.updateCard(c.path, { ingest: 'pending' }), '已标记摄取，跟鹤鹤/灵犀说「处理摄取队列」或等 cron 巡检')}>
              <Sparkles size={13} /> 摄取
            </button>
          {:else if c.ingest === 'pending'}
            {#if confirmUningest === c.path}
              <button class="tab-btn tab-btn--sm" style="background:var(--color-rise);color:#fff" disabled={saving}
                onclick={() => doUningest(c)}>取消排队?</button>
            {:else}
              <button class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-bubblegum flex items-center gap-1 self-center" title="摄取排队中,点击可取消" disabled={saving}
                onclick={() => armUningest(c)}>
                <LoaderCircle size={11} class="animate-spin" /> 摄取排队中
              </button>
            {/if}
          {:else}
            <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-mint-splash flex items-center gap-1 self-center"><Check size={11} /> 已摄取</span>
          {/if}
        {/if}
        {#if ['read', 'archived', '已读', '弃读'].includes(c.status)}
          <button class="tab-btn tab-btn--sm" disabled={saving} onclick={() => requeue(c)}>
            <RotateCcw size={13} /> 放回队列
          </button>
        {/if}
        <button class="tab-btn tab-btn--sm" onclick={() => store.openPage(c.path)}>打开卡 <ExternalLink size={13} /></button>
        <span class="flex-1"></span>
        {#if confirmDelete === c.path}
          <span class="text-[11.5px] text-rise">{c.kind === 'article' ? '卡和全文一起删，' : ''}不可恢复</span>
          <button class="tab-btn tab-btn--sm" style="background:var(--color-rise);color:#fff" disabled={saving}
            onclick={() => doDelete(c)}>确认删除</button>
          <button class="tab-btn tab-btn--sm" onclick={() => (confirmDelete = null)}>取消</button>
        {:else}
          <button class="tab-btn tab-btn--sm" disabled={saving} onclick={() => (confirmDelete = c.path)}><Trash2 size={13} /> 删除</button>
        {/if}
      </div>
    </div>

    <!-- 摘录 / 感想(可改可删) -->
    {@render entryEditor(c, '摘录', c.excerpts, false)}
    {@render entryEditor(c, '感想', c.thoughts, true)}

    <!-- 关联:摄取卡 + 相关待办(反向链接索引) -->
    <div class="grid gap-2.5 md:grid-cols-2">
      <div class="dash-frame p-3">
        <div class="text-[12px] font-bold mb-1.5 flex items-center gap-1"><Sparkles size={12} /> 摄取</div>
        {#if c.sourceCard}
          <button class="text-[12.5px] underline underline-offset-2 text-left" onclick={() => store.openPage(c.sourceCard)}>{c.sourceCard.split('/').pop()}</button>
        {:else if !relatedMap[c.path]}
          <div class="text-[12px] text-slate">加载关联 …</div>
        {:else if relatedMap[c.path]?.sources?.length}
          {#each relatedMap[c.path].sources as s}
            <button class="block text-[12.5px] underline underline-offset-2 text-left" onclick={() => store.openPage(s.path)}>{s.title}</button>
          {/each}
        {:else}
          <div class="text-[12px] text-slate">未摄取{c.kind === 'article' ? '：点上方「摄取」标进队列' : '：跟鹤鹤说「摄取这本书」'}</div>
        {/if}
      </div>
      <div class="dash-frame p-3">
        <div class="text-[12px] font-bold mb-1.5 flex items-center gap-1"><ListChecks size={12} /> 相关待办</div>
        {#if !relatedMap[c.path]}
          <div class="text-[12px] text-slate">加载关联 …</div>
        {:else if relatedMap[c.path]?.tasks?.length}
          <ul class="space-y-1 text-[12.5px]">
            {#each relatedMap[c.path].tasks as t}<li class="text-charcoal">{t.status === 'done' ? '✓' : '·'} {t.title}</li>{/each}
          </ul>
        {:else}
          <div class="text-[12px] text-slate">00_待办 里带 [[{c.name}]] 的任务会出现在这</div>
        {/if}
      </div>
    </div>
  </div>
{/snippet}

<div class="grid gap-4 [&>*]:min-w-0">
  <!-- 子页签栏 -->
  <div class="flex items-center gap-2 flex-wrap">
    {#each subs as s}
      {@const n = s.key === 'queue' ? queueItems.length : s.key === 'reading' ? readingBooks.length : s.key === 'archive' ? archiveItems.length : thoughtCount}
      <button class="tab-btn" data-active={sub === s.key} onclick={() => { sub = s.key; openPath = null }}>
        <s.icon size={15} strokeWidth={2.2} /> {s.label}
        <span class="text-[11px] text-slate">{n}</span>
      </button>
    {/each}
    {#if saving}<LoaderCircle size={15} class="animate-spin text-slate" />{/if}
    {#if tip}<span class="text-[11.5px] text-mint-dim flex items-center gap-1"><Check size={12} /> {tip}</span>{/if}
  </div>

  {#if error}
    <div class="card p-4 text-[13px] text-rise">{error}</div>
  {/if}

  {#if loading}
    <div class="card p-6 text-center text-slate text-[14px]">扫读书卡 …</div>

  <!-- ============ 队列 ============ -->
  {:else if sub === 'queue'}
    <div class="card p-5 md:p-6">
      <div class="flex items-baseline justify-between mb-1">
        <h3 class="font-display text-[19px] flex items-center gap-1.5"><Inbox size={18} /> 待读队列</h3>
        <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-sky-pop">{queueItems.length} 项</span>
      </div>
      <div class="text-[12px] text-slate">想读的书 + 待读的文章混排 · clipper 剪藏自动入列 · 点开卡片记感想/标摄取</div>
      <!-- 加书(写穿建卡) -->
      <div class="flex gap-2 mt-3">
        <input bind:value={newBook} placeholder="加一本书：《书名》"
          class="flex-1 px-2.5 py-1.5 text-[13px] border border-ink-black rounded-[8px] bg-pure-white"
          onkeydown={(e) => e.key === 'Enter' && newBook.trim() && act(async () => { await store.addBook(newBook.replace(/^《|》$/g, '')); newBook = '' }, '已入队列')} />
        <button class="btn-mint" disabled={saving || !newBook.trim()}
          onclick={() => act(async () => { await store.addBook(newBook.replace(/^《|》$/g, '')); newBook = '' }, '已入队列')}><Plus size={13} /> 加书</button>
      </div>
    </div>

    {#if queueItems.length}
      <div class="grid gap-3 md:grid-cols-3">
        {#each queueItems as c (c.path)}
          <div class="card card--link relative flex flex-col overflow-hidden cursor-pointer" onclick={() => toggleOpen(c)}>
            {@render cornerDelete(c)}
            {@render coverBlock(c, 'h-24')}
            <div class="p-3 flex-1 flex flex-col min-w-0">
              <div class="flex items-center gap-1.5 text-[10.5px] text-slate">
                <span class="px-1.5 py-px rounded-full border border-ink-black {c.kind === 'book' ? 'bg-peach-pop' : 'bg-sky-pop'}">{c.kind === 'book' ? '书' : '文章'}</span>
                <span>{c.added || c.captured}</span>
              </div>
              <h4 class="text-[13.5px] font-bold leading-snug line-clamp-2 mt-1">{c.title}</h4>
              <div class="mt-auto pt-2 flex items-center gap-1.5 flex-wrap" onclick={(e) => e.stopPropagation()}>
                {#if c.kind === 'book'}
                  <button class="tab-btn tab-btn--sm" disabled={saving}
                    onclick={() => act(() => store.updateCard(c.path, { status: '在读', started: todayS }), '开始读')}>开始读</button>
                {:else}
                  <button class="tab-btn tab-btn--sm" disabled={saving}
                    onclick={() => act(() => store.updateCard(c.path, { status: 'read', finished: todayS }), '已读，进档案')}>标已读</button>
                {/if}
                <span class="flex-1"></span>
                {@render ingestCtl(c)}
                {@render iconActs(c)}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="card p-5"><div class="dash-frame p-4 text-[13px] text-slate text-center">队列空了。按 clipper 收文章，或上面加本书。</div></div>
    {/if}

  <!-- ============ 在读 ============ -->
  {:else if sub === 'reading'}
    {#if readingBooks.length}
      <div class="grid gap-3 md:grid-cols-2">
        {#each readingBooks as c (c.path)}
          <div class="card relative overflow-hidden flex flex-col cursor-pointer" onclick={() => toggleOpen(c)}>
            {@render cornerDelete(c)}
            {@render coverBlock(c, 'h-28')}
            <div class="p-4 flex-1 flex flex-col">
              <div class="flex items-start justify-between gap-2">
                <h4 class="text-[15px] font-bold leading-snug">{c.title}</h4>
                <span class="num text-[20px] flex-none">{c.progress}%</span>
              </div>
              <div class="h-2.5 rounded-full border border-ink-black bg-pure-white overflow-hidden mt-2">
                <div class="h-full bg-mint-splash" style="width:{c.progress}%"></div>
              </div>
              <div class="text-[11px] text-slate mt-1.5">开始于 {c.started || '—'}</div>
              <div class="flex gap-1.5 mt-3 flex-wrap items-center" onclick={(e) => e.stopPropagation()}>
                <button class="tab-btn tab-btn--sm" disabled={saving} onclick={() => act(() => store.setCardProgress(c.path, c.progress + 10))}><Plus size={13} />10</button>
                <button class="btn-mint" disabled={saving}
                  onclick={() => act(() => store.updateCard(c.path, { status: '已读', finished: todayS, progress: 100 }), '读完，进档案')}>读完 <Check size={13} /></button>
                <button class="tab-btn tab-btn--sm" disabled={saving}
                  onclick={() => act(() => store.updateCard(c.path, { status: '弃读', finished: todayS }))}>弃读</button>
                <span class="flex-1"></span>
                {@render ingestCtl(c)}
                {@render iconActs(c)}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="card p-5"><div class="dash-frame p-4 text-[13px] text-slate text-center">没有在读的书。从队列挑一本「开始读」。</div></div>
    {/if}

  <!-- ============ 档案 ============ -->
  {:else if sub === 'archive'}
    <div class="card p-5 md:p-6">
      <div class="flex items-baseline justify-between mb-1">
        <h3 class="font-display text-[19px] flex items-center gap-1.5"><Archive size={18} /> 已读档案</h3>
        <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-mint-splash num">{stats.y} 已读 {stats.nb} 本 · {stats.na} 篇</span>
      </div>
      <div class="flex gap-2 mt-3 items-center flex-wrap">
        <div class="relative flex-1 min-w-[160px]">
          <Search size={13} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" />
          <input bind:value={q} placeholder="搜书名 / 文章 / 感想 / 摘录 …"
            class="w-full pl-7 pr-2.5 py-1.5 text-[13px] border border-ink-black rounded-[8px] bg-pure-white" />
        </div>
        {#each [['all', '全部'], ['book', '书'], ['article', '文章'], ['dropped', '弃读/归档']] as [k, label]}
          <button class="tab-btn tab-btn--sm" data-active={filter === k} onclick={() => (filter = k)}>{label}</button>
        {/each}
      </div>
    </div>

    {#if archiveItems.length}
      <div class="grid gap-3 md:grid-cols-2">
        {#each archiveItems as c (c.path)}
          <div class="card card--link relative overflow-hidden flex flex-col cursor-pointer" onclick={() => toggleOpen(c)}>
            {@render cornerDelete(c)}
            <div class="flex">
              {@render coverBlock(c, 'h-20 w-14 flex-none border-b-0 border-r')}
              <div class="p-3 flex-1 min-w-0">
                <div class="flex items-center gap-1.5 text-[10.5px] text-slate flex-wrap">
                  <span class="px-1.5 py-px rounded-full border border-ink-black {c.kind === 'book' ? 'bg-peach-pop' : 'bg-sky-pop'}">{c.kind === 'book' ? '书' : '文章'}</span>
                  <span class="px-1.5 py-px rounded-full border border-ink-black {chipColor(c.status)}">{statusLabel(c)}</span>
                  {#if c.rating}<span class="font-bold text-ink-black">{c.rating}</span>{/if}
                </div>
                <h4 class="text-[13.5px] font-bold leading-snug line-clamp-2 mt-1">{c.title}</h4>
                <div class="text-[11px] text-slate mt-1">
                  {c.finished ? `读完 ${c.finished}` : ''}{c.thoughts.length ? ` · ${c.thoughts.length} 条感想` : ''}
                </div>
                <!-- 快捷动作:档案卡直接放回队列(stopPropagation 防展开) -->
                <div class="mt-1.5 flex items-center gap-1.5 flex-wrap" onclick={(e) => e.stopPropagation()}>
                  <button class="tab-btn tab-btn--sm" disabled={saving} onclick={() => requeue(c)}>
                    <RotateCcw size={12} /> 放回队列
                  </button>
                  <span class="flex-1"></span>
                  {@render ingestCtl(c)}
                  {@render iconActs(c)}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="card p-5"><div class="dash-frame p-4 text-[13px] text-slate text-center">档案是空的。读完的书和文章会进这里，随时可搜可重读。</div></div>
    {/if}

  <!-- ============ 感想流 ============ -->
  {:else if sub === 'thoughts'}
    <div class="card p-5 md:p-6">
      <div class="flex items-baseline justify-between mb-1">
        <h3 class="font-display text-[19px] flex items-center gap-1.5"><Lightbulb size={18} /> 感想流</h3>
        <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-bubblegum">{thoughtCount} 条</span>
      </div>
      <div class="text-[12px] text-slate">所有书卡/文章卡感想区的时间流 · 点徽章跳到对应的卡</div>
    </div>
    {#if thoughtsFlow.length}
      <div class="grid gap-2.5">
        {#each thoughtsFlow as t}
          <div class="card p-4 flex gap-3">
            <div class="text-[11px] text-slate w-10 flex-none pt-0.5 num">{t.date || '—'}</div>
            <div class="flex-1 min-w-0">
              <p class="text-[13.5px] text-charcoal leading-relaxed break-words">{t.text}</p>
              <button class="mt-1.5 text-[11px] px-2 py-0.5 rounded-full border border-ink-black {t.card.kind === 'book' ? 'bg-peach-pop' : 'bg-sky-pop'}"
                onclick={() => jumpTo(t.card)}>
                {t.card.kind === 'book' ? '书' : '文章'} · {t.card.title.length > 24 ? t.card.title.slice(0, 24) + '…' : t.card.title}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="card p-5"><div class="dash-frame p-4 text-[13px] text-slate text-center">还没有感想。点开任意一张卡，在「感想」区记一条。</div></div>
    {/if}
  {/if}

  <!-- ============ 卡详情弹窗(点遮罩/Esc 关闭) ============ -->
  {#if openCard}
    <div class="wb-modal-overlay" role="dialog" aria-modal="true" onclick={() => (openPath = null)}>
      <div class="wb-modal" onclick={(e) => e.stopPropagation()}>
        {@render detail(openCard)}
      </div>
    </div>
  {/if}
</div>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && openCard) openPath = null }} />
