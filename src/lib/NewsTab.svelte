<!-- 新闻 tab:读契约 JSON,富卡片 + 内置阅读器 + 按日翻历史 -->
<script>
  import { onMount } from 'svelte'
  import { Newspaper, ExternalLink, BookOpen, ChevronUp } from '@lucide/svelte'

  let { store } = $props()

  let news = $state(null) // { date, items, file, history }
  let loading = $state(true)
  let openIdx = $state(null)

  // Hatch 字母色块:无封面时的 pastel 占位(轮转 mint/sky/peach/pink)
  const placeholderColors = ['#99ffcc', '#7bbbff', '#ffcc99', '#ff99cc']
  function phColor(i) {
    return placeholderColors[i % placeholderColors.length]
  }

  onMount(() => {
    reload()
    const off = store.onChange?.((p) => {
      if (p.startsWith('wiki/新闻/data/')) reload()
    })
    return () => off?.()
  })

  async function reload() {
    try {
      news = await store.getNews()
    } catch {
      news = null
    } finally {
      loading = false
    }
  }

  async function switchDay(file) {
    if (file === news?.file) return
    try {
      const data = await store.getNewsByFile(file)
      news = { ...news, ...data, file }
      openIdx = null
    } catch { /* 文件读失败就停在那 */ }
  }

  function openUrl(url) {
    if (url) window.open(url, '_blank')
  }

  function hideBrokenImg(e) {
    e.currentTarget.style.display = 'none'
  }
</script>

<div class="grid gap-4">
  <div class="card p-5 md:p-6">
    <div class="flex items-baseline justify-between mb-1">
      <h3 class="font-display text-[19px] flex items-center gap-1.5"><Newspaper size={18} /> AI 新闻</h3>
      {#if news}
        <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-mint-splash">{news.date} · {news.items.length} 条</span>
      {:else}
        <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-bubblegum">契约待落</span>
      {/if}
    </div>

    <!-- 历史日期翻页 -->
    {#if news?.history?.length > 1}
      <div class="flex flex-wrap gap-1.5 mt-2">
        {#each news.history as f}
          {@const day = f.match(/(\d{4}-\d{2}-\d{2})/)?.[1]}
          <button
            class="text-[11.5px] px-2.5 py-1 rounded-full border border-ink-black cursor-pointer {f === news.file ? 'bg-mint-splash font-bold' : 'bg-pure-white'}"
            onclick={() => switchDay(f)}
          >
            {day?.slice(5)}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="card p-6 text-center text-slate text-[14px]">读取新闻契约 …</div>
  {:else if !news}
    <div class="card p-5 md:p-6">
      <div class="dash-frame p-4 text-[13px] text-slate text-center">
        流水线每天早上 08:00 落契约到 <code class="text-ink-black">wiki/新闻/data/</code>。<br />
        首张契约到了这里就是新闻流。
      </div>
    </div>
  {:else}
    <!-- 新闻卡片流:两列网格(移动端单列) -->
    <div class="grid gap-3 md:grid-cols-2">
      {#each news.items as item, i}
        <div class="card overflow-hidden flex flex-col">
          <!-- 统一封面区:有图显示图,无图整面 Hatch 色块字母 -->
          {#if item.cover}
            <img src={item.cover} alt="" loading="lazy" onerror={hideBrokenImg}
              class="w-full h-28 object-cover border-b border-ink-black bg-cream-paper" />
          {:else}
            <div class="h-28 border-b border-ink-black grid place-items-center" style="background:{phColor(i)}">
              <span class="font-display text-[26px] leading-none text-ink-black">{(item.title || item.source || '?').slice(0, 1)}</span>
            </div>
          {/if}
          <div class="p-3.5 flex-1 flex flex-col">
            <div class="min-w-0">
              <h4 class="text-[14px] font-bold leading-snug line-clamp-2">{item.title}</h4>
              <div class="text-[11px] text-slate mt-0.5">{item.source}</div>
            </div>
            {#if item.tldr}
              <p class="text-[12.5px] mt-2 text-charcoal {openIdx === i ? '' : 'line-clamp-2'}">{item.tldr}</p>
            {/if}
            <div class="flex gap-1.5 mt-auto pt-2.5">
              <button class="tab-btn tab-btn--sm" onclick={() => (openIdx = openIdx === i ? null : i)}>
                {#if openIdx === i}
                  <ChevronUp size={13} /> 收起
                {:else}
                  <BookOpen size={13} /> 阅读
                {/if}
              </button>
              <button class="tab-btn tab-btn--sm" onclick={() => openUrl(item.url)}>
                原文 <ExternalLink size={13} />
              </button>
            </div>

            <!-- 内置阅读器(本地渲染,离线可读) -->
            {#if openIdx === i}
              <div class="mt-2.5 rounded-[12px] border border-ink-black bg-cream-paper p-3.5">
                {#if item.summary}
                  <div class="text-[12.5px] font-medium mb-2 pb-2 border-b border-fog">{item.summary}</div>
                {/if}
                <div class="text-[12.5px] leading-relaxed text-charcoal whitespace-pre-wrap max-h-[45vh] overflow-y-auto">{item.content || '(正文抓取失败,点「原文」去看)'}</div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
