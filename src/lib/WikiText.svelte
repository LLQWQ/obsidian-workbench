<script>
  // WikiText:把文本里的 [[wikilink]] / [[link|alias]] 渲染为可点双链
  // 点击 stopPropagation——任务行/卡片本身的点击(开弹窗)不被触发
  let { text = '', onopen } = $props()

  const parts = $derived.by(() => {
    const out = []
    const re = /\[\[([^\[\]|]+?)(?:\|([^\[\]]*))?\]\]/g
    let m
    let last = 0
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ t: 0, v: text.slice(last, m.index) })
      out.push({ t: 1, target: m[1].trim(), alias: (m[2] || m[1]).trim() })
      last = m.index + m[0].length
    }
    if (last < text.length) out.push({ t: 0, v: text.slice(last) })
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
  {:else}
    {p.v}
  {/if}
{/each}
