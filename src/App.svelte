<script>
  import NewsTab from './lib/NewsTab.svelte'
  import TodoTab from './lib/TodoTab.svelte'
  import HealthTab from './lib/HealthTab.svelte'
  import ReadingTab from './lib/ReadingTab.svelte'
  import Crane from './lib/Crane.svelte'
  import { ListChecks, Newspaper, Dumbbell, Library } from '@lucide/svelte'

  let { store } = $props()
  let tab = $state('todo')

  const tabs = [
    { key: 'todo', label: '待办', icon: ListChecks },
    { key: 'news', label: '新闻', icon: Newspaper },
    { key: 'reading', label: '读书', icon: Library },
    { key: 'health', label: '健康', icon: Dumbbell },
  ]

  const now = new Date()
  const dateS = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
</script>

<div class="workbench-root min-h-full bg-cream-paper text-ink-black">
  <div class="wb-content max-w-[960px] mx-auto px-4 md:px-6">
    <!-- 顶栏 -->
    <nav class="flex items-center justify-between pt-4">
      <div class="flex items-center gap-2.5">
        <span class="w-[34px] block"><Crane /></span>
        <span class="font-display text-[20px] tracking-[-0.02em]">阿斌工作台</span>
      </div>
      <span class="bg-mint-splash border border-ink-black rounded-full px-3.5 py-1 text-[12.5px] font-bold whitespace-nowrap">
        {dateS} {weekdays[now.getDay()]}
      </span>
    </nav>

    <!-- tab 栏(全端顶部,移动端紧凑) -->
    <div class="flex flex-wrap gap-2 mt-5">
      {#each tabs as t}
        <button class="tab-btn max-md:px-3 max-md:py-1.5 max-md:text-[13px]" data-active={tab === t.key} onclick={() => (tab = t.key)}>
          <t.icon size={15} strokeWidth={2.2} /> {t.label}
        </button>
      {/each}
    </div>

    <!-- 内容区 -->
    <main class="mt-4 md:mt-5">
      {#if tab === 'todo'}
        <TodoTab {store} />
      {:else if tab === 'news'}
        <NewsTab {store} />
      {:else if tab === 'reading'}
        <ReadingTab {store} />
      {:else if tab === 'health'}
        <HealthTab {store} />
      {/if}
    </main>
  </div>
</div>
