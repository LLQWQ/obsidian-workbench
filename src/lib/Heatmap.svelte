<!-- 通用格子热力图(Hatch mint 色阶) —— 任务完成/训练通用 -->
<script>
  let { data = {}, weeks = 20, thresholds = [0, 1, 2, 4], oncell = null, selectedDate = null } = $props()

  const CELL = 12
  const GAP = 3

  function dstr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  let cells = $derived.by(() => {
    const today = new Date()
    const arr = []
    const dow = (today.getDay() + 6) % 7 // 周一=0
    const start = new Date(today)
    start.setDate(today.getDate() - dow - (weeks - 1) * 7)
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start)
        dt.setDate(start.getDate() + w * 7 + d)
        if (dt > today) continue
        const ds = dstr(dt)
        arr.push({ date: ds, x: w * (CELL + GAP), y: d * (CELL + GAP), value: data[ds] || 0 })
      }
    }
    return arr
  })

  function color(v) {
    const [t0, t1, t2, t3] = thresholds
    if (v <= t0) return '#f0efeb'
    if (v <= t1) return '#ccf5e3'
    if (v <= t2) return '#99ffcc'
    if (v <= t3) return '#5cd6a0'
    return '#2f9e6b'
  }
</script>

<svg viewBox="0 0 {weeks * (CELL + GAP)} {7 * (CELL + GAP)}" class="w-full h-auto">
  {#each cells as c (c.date)}
    <rect
      x={c.x}
      y={c.y}
      width={CELL}
      height={CELL}
      rx="3"
      fill={color(c.value)}
      stroke={selectedDate === c.date ? '#000' : 'none'}
      stroke-width="1.5"
      class="cursor-pointer hover:opacity-75"
      role="button"
      tabindex="0"
      onclick={() => oncell && oncell(c.date, c.value)}
      onkeydown={(e) => e.key === 'Enter' && oncell && oncell(c.date, c.value)}
    >
      <title>{c.date} · {c.value}</title>
    </rect>
  {/each}
</svg>
