<!-- 健康 tab:训练热力图(点击看明细)+ 今日面板 + 本期计划 + 趋势 -->
<script>
  import { onMount } from 'svelte'
  import Heatmap from './Heatmap.svelte'
  import { setsDetail } from './vault.js'
  import { Check } from '@lucide/svelte'

  let { store } = $props()

  let loading = $state(true)
  let error = $state(null)
  let byDate = $state({})
  let setsByDate = $state({})
  let bodyMetrics = $state([])
  let selectedDate = $state(null)

  // 补录表单
  let wInput = $state('')
  let fInput = $state('')
  let saving = $state(false)
  let savedTip = $state('')

  const today = new Date()
  const todayS = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  onMount(() => {
    reload()
    const off = store.onChange?.((p) => {
      if (p.startsWith('wiki/健康/data/')) reload()
    })
    return () => off?.()
  })

  async function reload() {
    try {
      const [tr, bm] = await Promise.all([store.getTraining(), store.getBodyMetrics()])
      byDate = tr.byDate
      setsByDate = tr.setsByDate
      bodyMetrics = bm
      error = null
    } catch (e) {
      error = String(e)
    } finally {
      loading = false
    }
  }

  async function saveMetric() {
    if (!wInput && !fInput) return
    saving = true
    try {
      await store.addBodyMetric({ date: todayS, weight: wInput, bodyfat: fInput })
      wInput = ''
      fInput = ''
      savedTip = '已写入 body_metrics.csv'
      setTimeout(() => (savedTip = ''), 2500)
      await reload()
    } catch (e) {
      error = String(e)
    } finally {
      saving = false
    }
  }

  let heatData = $derived.by(() => {
    const m = {}
    for (const d in byDate) m[d] = byDate[d].volume
    return m
  })

  let latest = $derived(bodyMetrics.length ? bodyMetrics[bodyMetrics.length - 1] : null)
  let detail = $derived(selectedDate ? setsDetail(setsByDate[selectedDate]) : null)
  let selectedSession = $derived(selectedDate ? byDate[selectedDate] : null)

  // 近 8 周容量 bars
  let weekly = $derived.by(() => {
    const map = {}
    for (const d in byDate) {
      const dt = new Date(d)
      const dow = (dt.getDay() + 6) % 7
      const monday = new Date(dt)
      monday.setDate(dt.getDate() - dow)
      const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
      map[key] = (map[key] || 0) + byDate[d].volume
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-8)
  })
  let maxWeekly = $derived(weekly.length ? Math.max(...weekly.map(([, v]) => v)) : 1)
</script>

<div class="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
  <!-- 训练热力图 -->
  <div class="card p-4 md:p-5 md:col-span-2">
    <div class="flex items-baseline justify-between mb-2">
      <h3 class="font-display text-[17px]">训练热力图</h3>
      <span class="text-[11px] text-slate">近 20 周 · 容量 kg · 点击看明细</span>
    </div>
    {#if loading}
      <div class="text-slate text-[13px] py-4 text-center">读取训练数据 …</div>
    {:else}
      <Heatmap data={heatData} weeks={20} thresholds={[0, 3000, 5000, 7000]} oncell={(d) => (selectedDate = d)} {selectedDate} />
      {#if selectedDate}
        <div class="mt-3 rounded-[12px] border border-ink-black bg-pure-white p-3">
          <div class="flex items-baseline justify-between">
            <span class="text-[14px] font-bold">{selectedDate}</span>
            {#if selectedSession}
              <span class="text-[12px] text-slate">{Math.round(selectedSession.volume)}kg · {selectedSession.dur}min</span>
            {/if}
          </div>
          {#if detail && detail.length}
            <ul class="mt-2 text-[13px] space-y-1">
              {#each detail as d}
                <li class="flex justify-between gap-2">
                  <span>{d.movement}</span>
                  <span class="text-slate">{d.sets} 组{d.maxW ? ` · 最大 ${d.maxW}kg` : ''}</span>
                </li>
              {/each}
            </ul>
          {:else}
            <div class="mt-2 text-[13px] text-slate">该日无训练</div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>

  <!-- 今日面板 -->
  <div class="card p-4 md:p-5">
    <div class="flex items-baseline justify-between mb-3">
      <h3 class="font-display text-[17px]">今日面板</h3>
      <span class="text-[11px] text-slate">{todayS.slice(5)}</span>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <div class="text-[12px] text-slate">体重</div>
        <div class="num text-[28px]">{latest?.weight ?? '—'}<span class="text-[13px] text-slate">kg</span></div>
      </div>
      <div>
        <div class="text-[12px] text-slate">体脂</div>
        <div class="num text-[28px]">{latest?.bodyfat ?? '—'}<span class="text-[13px] text-slate">%</span></div>
      </div>
      <div>
        <div class="text-[12px] text-slate">目标热量</div>
        <div class="num text-[28px] text-slate">—<span class="text-[13px]">kcal</span></div>
      </div>
      <div>
        <div class="text-[12px] text-slate">营养素目标</div>
        <div class="num text-[28px] text-slate">—</div>
      </div>
    </div>
    <div class="text-[11.5px] text-slate mt-2">目标值待活活出「本期计划」后填充 · 体重/体脂跟活活说一句即录</div>

    <!-- 补录表单(写穿 body_metrics.csv) -->
    <div class="mt-3 dash-frame p-3">
      <div class="text-[12px] text-slate mb-2">补录今日(写穿 CSV)</div>
      <div class="flex flex-wrap gap-2 items-end">
        <input bind:value={wInput} placeholder="体重 kg" inputmode="decimal"
          class="flex-1 min-w-0 px-2 py-1.5 text-[14px] border border-ink-black rounded-[8px] bg-pure-white" />
        <input bind:value={fInput} placeholder="体脂 %" inputmode="decimal"
          class="flex-1 min-w-0 px-2 py-1.5 text-[14px] border border-ink-black rounded-[8px] bg-pure-white" />
        <button onclick={saveMetric} disabled={saving} class="btn-mint flex-none">
          {saving ? '写入…' : '记一笔'}
        </button>
      </div>
      {#if savedTip}<div class="text-[11.5px] text-mint-dim mt-1.5 flex items-center gap-1"><Check size={12} /> {savedTip}</div>{/if}
    </div>
  </div>

  <!-- 本期计划(空态,等活活) -->
  <div class="card p-4 md:p-5 flex flex-col">
    <div class="flex items-baseline justify-between mb-3">
      <h3 class="font-display text-[17px]">本期计划</h3>
      <span class="text-[11px] px-2 py-0.5 rounded-full border border-ink-black bg-bubblegum">待活活出方案</span>
    </div>
    <div class="dash-frame flex-1 grid place-items-center py-6 px-4 text-center">
      <div class="space-y-2 text-[13px] text-slate">
        <p>名称 / 起止 / 周频次 / 饮食规则 / 体脂目标</p>
        <p>活活出草案 → 阿斌批准激活 → 进度自动算(计划场次 vs 实练)</p>
      </div>
    </div>
  </div>

  <!-- 趋势:训练容量(现成)+ 体重(积累中) -->
  <div class="card p-4 md:p-5 md:col-span-2">
    <h3 class="font-display text-[17px] mb-3">趋势</h3>
    <div class="grid md:grid-cols-2 gap-4">
      <div>
        <div class="text-[12px] text-slate mb-1.5">近 8 周训练容量(kg)</div>
        <div class="flex items-end gap-1.5 h-[60px]">
          {#each weekly as [wk, v]}
            <div class="flex-1 flex flex-col items-center">
              <div class="w-full rounded-t-[4px] border border-ink-black bg-sky-pop" style="height:{(v / maxWeekly) * 52 + 4}px" title="{wk}: {Math.round(v)}kg"></div>
            </div>
          {/each}
        </div>
      </div>
      <div>
        <div class="text-[12px] text-slate mb-1.5">体重趋势</div>
        {#if bodyMetrics.length >= 2}
          <svg viewBox="0 0 100 40" class="w-full h-[60px]">
            <polyline
              points={bodyMetrics.map((m, i) => `${(i / (bodyMetrics.length - 1)) * 96 + 2},${38 - ((m.weight - Math.min(...bodyMetrics.map((x) => x.weight))) / (Math.max(...bodyMetrics.map((x) => x.weight)) - Math.min(...bodyMetrics.map((x) => x.weight)) || 1)) * 34}`).join(' ')}
              fill="none" stroke="#000" stroke-width="1.5" />
          </svg>
        {:else}
          <div class="dash-frame h-[60px] grid place-items-center text-[12px] text-slate">数据积累中(≥2 条出曲线)</div>
        {/if}
      </div>
    </div>
  </div>
</div>
