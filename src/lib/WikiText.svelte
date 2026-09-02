<script>
  // WikiText:把文本里的 [[wikilink]] / [[link|alias]] 渲染为可点双链,#tag 渲染为标签 chip
  // 点击 stopPropagation——任务行/卡片本身的点击(开弹窗)不被触发
  let { text = '', onopen } = $props()

  // 两遍切词:先 [[link]],文本段内再切 #tag
  // #tag 遵循 Obsidian 规则:# 前须行首/空白(防误吃 [[page#heading]]),纯数字不算标签
  const TAG_RE = /(^|\s)#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu
  const parts = $derived.by(() => {
    const out = []
    const pushTags = (s) => {
      let m
      let last = 0
      TAG_RE.lastIndex = 0
      while ((m = TAG_RE.exec(s))) {
        const tag = m[2]
        if (/^\d+$/.test(tag)) continue
        const start = m.index + m[1].length // 前导空白留在文本段里
        if (start > last) out.push({ t: 0, v: s.slice(last, start) })
        out.push({ t: 2, v: tag })
        last = start + tag.length + 1
      }
      if (last < s.length) out.push({ t: 0, v: s.slice(last) })
    }
    const re = /\[\[([^\[\]|]+?)(?:\|([^\[\]]*))?\]\]/g
    let m
    let last = 0
    while ((m = re.exec(text))) {
      if (m.index > last) pushTags(text.slice(last, m.index))
      out.push({ t: 1, target: m[1].trim(), alias: (m[2] || m[1]).trim() })
      last = m.index + m[0].length
    }
    if (last < text.length) pushTags(text.slice(last))
    return out
  })
</script>

{#each parts as p}
  {#if p.t === 1}
    <a
      href={p.target}
      class="text-mint-dim underline decoration-dotted underline-offset-2 cursor-pointer hover:decoration-solid"
      onclick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onopen?.(p.target)
      }}>{p.alias}</a>
  {:else if p.t === 2}
    <span
      class="text-[0.8em] px-1.5 py-px rounded-full border whitespace-nowrap {p.v === '工作'
        ? 'border-ink-black bg-plum-ink text-pure-white'
        : 'border-fog bg-pure-white text-slate'}">#{p.v}</span>
  {:else}
    {p.v}
  {/if}
{/each}
