<!-- 仙鹤 mascot —— 极简线条立鹤，Hatch 插画风（stroke 手绘感） -->
<script>
  let { size = 120 } = $props()
</script>

<svg width="100%" viewBox="0 0 140 150" fill="none" aria-label="仙鹤">
  <!-- 尾羽 -->
  <path d="M94 88 Q118 90 128 76" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M94 95 Q116 99 124 88" stroke="#000" stroke-width="2" stroke-linecap="round"/>
  <!-- 身体 -->
  <ellipse cx="70" cy="95" rx="28" ry="19" transform="rotate(-8 70 95)" fill="#fff" stroke="#000" stroke-width="2.5"/>
  <!-- 翅膀（sky 淡填） -->
  <path d="M52 92 Q70 78 89 90 Q71 101 52 92 Z" fill="#7bbbff" fill-opacity="0.35" stroke="#000" stroke-width="1.5"/>
  <!-- 颈（S 曲线） -->
  <path d="M50 84 C 36 66, 40 44, 54 36" stroke="#000" stroke-width="3" stroke-linecap="round"/>
  <!-- 头 -->
  <circle cx="56" cy="32" r="8" fill="#fff" stroke="#000" stroke-width="2.5"/>
  <!-- 喙 -->
  <path d="M63 30 L84 34 L63 37.5 Z" fill="#000"/>
  <!-- 眼 -->
  <circle cx="58" cy="30.5" r="1.4" fill="#000"/>
  <!-- 丹顶 -->
  <path d="M50 25.5 Q56 19 62.5 24 Q56 22.5 50 25.5 Z" fill="#e0393e"/>
  <!-- 站立腿 + 爪 -->
  <path d="M66 112 L66 138" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M66 138 L59 144 M66 138 L66 145.5 M66 138 L73 144" stroke="#000" stroke-width="2" stroke-linecap="round"/>
  <!-- 收起的腿（单立姿态） -->
  <path d="M78 112 L88 121" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
</svg>
