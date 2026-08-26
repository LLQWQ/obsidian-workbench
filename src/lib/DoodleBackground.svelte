<!-- 贴纸涂鸦背景层 —— 参考可爱贴纸风：粗描边 + 平涂 Hatch 色 + 散布小元素 -->
<!-- 绝对定位铺满工作台，z-0 垫在内容下，pointer-events-none 不挡交互 -->
<div class="doodle-bg" aria-hidden="true">
  <!-- 笑脸花 -->
  <div class="doodle" style="top:3%;right:5%;width:56px;--r:8deg;opacity:.6;animation-duration:9s;animation-delay:0s">
    <svg viewBox="0 0 48 48" fill="none">
      <g stroke="#000" stroke-width="2">
        <circle cx="24" cy="11" r="6.5" fill="#ff99cc" />
        <circle cx="35.4" cy="19.3" r="6.5" fill="#ff99cc" />
        <circle cx="31.1" cy="32.7" r="6.5" fill="#ff99cc" />
        <circle cx="16.9" cy="32.7" r="6.5" fill="#ff99cc" />
        <circle cx="12.6" cy="19.3" r="6.5" fill="#ff99cc" />
      </g>
      <circle cx="24" cy="23" r="8" fill="#ffcc99" stroke="#000" stroke-width="2" />
      <circle cx="21" cy="21.5" r="1.3" fill="#000" />
      <circle cx="27" cy="21.5" r="1.3" fill="#000" />
      <path d="M21 25.2 Q24 27.6 27 25.2" stroke="#000" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  </div>

  <!-- 四角星芒 -->
  <div class="doodle" style="top:8%;left:5%;width:30px;--r:-6deg;opacity:.55;animation-duration:10s;animation-delay:-3s">
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M24 5 C26 16 28 18 43 24 C28 30 26 32 24 43 C22 32 20 30 5 24 C20 18 22 16 24 5 Z" fill="#7bbbff" stroke="#000" stroke-width="2" stroke-linejoin="round" />
    </svg>
  </div>

  <!-- 爱心 -->
  <div class="doodle" style="top:15%;right:9%;width:30px;--r:10deg;opacity:.55;animation-duration:8s;animation-delay:-2s">
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M24 40 C11 31 6.5 22.5 10 15.5 C13.2 9.5 20 11 24 16.5 C28 11 34.8 9.5 38 15.5 C41.5 22.5 37 31 24 40 Z" fill="#e0393e" stroke="#000" stroke-width="2" stroke-linejoin="round" />
      <path d="M14.5 17.5 Q16.8 13.8 20.5 14" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7" />
    </svg>
  </div>

  <!-- 金币 -->
  <div class="doodle max-md:hidden" style="top:20%;left:3.5%;width:34px;--r:-8deg;opacity:.5;animation-duration:11s;animation-delay:-5s">
    <svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="13" fill="#ffcc99" stroke="#000" stroke-width="2" />
      <circle cx="24" cy="24" r="8" fill="none" stroke="#000" stroke-width="1.6" stroke-dasharray="3.5 3" />
    </svg>
  </div>

  <!-- 齿轮 -->
  <div class="doodle max-md:hidden" style="top:27%;right:4%;width:38px;--r:0deg;opacity:.5;animation-duration:12s;animation-delay:-6s">
    <svg viewBox="0 0 48 48" fill="none">
      <g fill="#dddfe2" stroke="#000" stroke-width="2">
        <rect x="21" y="4.5" width="6" height="8" rx="1.5" />
        <rect x="21" y="4.5" width="6" height="8" rx="1.5" transform="rotate(60 24 24)" />
        <rect x="21" y="4.5" width="6" height="8" rx="1.5" transform="rotate(120 24 24)" />
        <rect x="21" y="4.5" width="6" height="8" rx="1.5" transform="rotate(180 24 24)" />
        <rect x="21" y="4.5" width="6" height="8" rx="1.5" transform="rotate(240 24 24)" />
        <rect x="21" y="4.5" width="6" height="8" rx="1.5" transform="rotate(300 24 24)" />
        <circle cx="24" cy="24" r="10.5" />
        <circle cx="24" cy="24" r="3.5" fill="#f5f4f0" />
      </g>
    </svg>
  </div>

  <!-- 波浪线 -->
  <div class="doodle max-md:hidden" style="top:33%;left:6%;width:46px;--r:4deg;opacity:.5;animation-duration:9.5s;animation-delay:-4s">
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M5 24 q4.5 -9 9 0 t9 0 t9 0 t9 0" stroke="#7bbbff" stroke-width="2.5" fill="none" stroke-linecap="round" />
    </svg>
  </div>

  <!-- 笑脸星星 -->
  <div class="doodle" style="top:41%;right:7%;width:42px;--r:-10deg;opacity:.6;animation-duration:10.5s;animation-delay:-1.5s">
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M24 6.5 L27.6 18 L40 18.4 L30.4 26 L33.6 38 L24 31 L14.4 38 L17.6 26 L8 18.4 L20.4 18 Z" fill="#ffcc99" stroke="#000" stroke-width="2" stroke-linejoin="round" />
      <circle cx="20.5" cy="21.5" r="1.3" fill="#000" />
      <circle cx="27.5" cy="21.5" r="1.3" fill="#000" />
      <path d="M20.5 25.5 Q24 28 27.5 25.5" stroke="#000" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  </div>

  <!-- 云朵 -->
  <div class="doodle" style="top:48%;left:3%;width:54px;--r:3deg;opacity:.55;animation-duration:11s;animation-delay:-7s">
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M12 34 A9 9 0 0 1 12 20 A10 10 0 0 1 30 14 A7.5 7.5 0 0 1 38 28 L36 34 Z" fill="#ffffff" stroke="#000" stroke-width="2" stroke-linejoin="round" />
    </svg>
  </div>

  <!-- 对勾圆 -->
  <div class="doodle" style="top:57%;right:5%;width:30px;--r:6deg;opacity:.55;animation-duration:8.5s;animation-delay:-2.5s">
    <svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="12.5" fill="#99ffcc" stroke="#000" stroke-width="2" />
      <path d="M17 24.5 l5 5 l9.5 -10.5" stroke="#000" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </div>

  <!-- 闪电 -->
  <div class="doodle max-md:hidden" style="top:64%;left:8%;width:28px;--r:-5deg;opacity:.5;animation-duration:9s;animation-delay:-3.5s">
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M27 5 L13 27 h8.5 L20 43 L35 20 h-9.5 Z" fill="#ffcc99" stroke="#000" stroke-width="2" stroke-linejoin="round" />
    </svg>
  </div>

  <!-- 长腿小绿团 -->
  <div class="doodle" style="top:72%;right:8%;width:58px;--r:-4deg;opacity:.6;animation-duration:10s;animation-delay:-6.5s">
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M24 7 C33.5 7 40 14 40 23.5 C40 33 33.5 39.5 24 39.5 C14.5 39.5 8 33 8 23.5 C8 14.5 14.5 7 24 7 Z" fill="#99ffcc" stroke="#000" stroke-width="2" />
      <circle cx="19.5" cy="21.5" r="1.5" fill="#000" />
      <circle cx="28.5" cy="21.5" r="1.5" fill="#000" />
      <path d="M19 26.5 Q24 30.5 29 26.5" stroke="#000" stroke-width="1.8" stroke-linecap="round" fill="none" />
      <path d="M17 39.5 L15 45 M31 39.5 L33 45" stroke="#000" stroke-width="2.2" stroke-linecap="round" />
      <path d="M12 45 h6 M30 45 h6" stroke="#000" stroke-width="2.2" stroke-linecap="round" />
    </svg>
  </div>

  <!-- 纸飞机 -->
  <div class="doodle max-md:hidden" style="top:79%;left:4%;width:38px;--r:-10deg;opacity:.5;animation-duration:12s;animation-delay:-1s">
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M6 22 L42 7 L31 41 L23 29 Z" fill="#ffffff" stroke="#000" stroke-width="2" stroke-linejoin="round" />
      <path d="M23 29 L42 7 M6 22 L23 29" stroke="#000" stroke-width="1.6" />
    </svg>
  </div>

  <!-- 彩点簇 -->
  <div class="doodle max-md:hidden" style="top:87%;right:11%;width:44px;--r:0deg;opacity:.55;animation-duration:10s;animation-delay:-5.5s">
    <svg viewBox="0 0 48 48" fill="none">
      <g stroke="#000" stroke-width="1.6">
        <circle cx="10" cy="12" r="3.2" fill="#ff99cc" />
        <circle cx="28" cy="7" r="2.4" fill="#7bbbff" />
        <circle cx="39" cy="20" r="3.4" fill="#99ffcc" />
        <circle cx="22" cy="26" r="2.6" fill="#ffcc99" />
        <circle cx="8" cy="34" r="2.2" fill="#e0393e" />
        <circle cx="34" cy="38" r="2.4" fill="#ffcc99" />
      </g>
    </svg>
  </div>

  <!-- 小太阳 -->
  <div class="doodle" style="top:93%;left:9%;width:40px;--r:0deg;opacity:.55;animation-duration:11.5s;animation-delay:-4.5s">
    <svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="10" fill="#ffcc99" stroke="#000" stroke-width="2" />
      <g stroke="#000" stroke-width="2.2" stroke-linecap="round">
        <path d="M24 6 v4 M24 38 v4 M6 24 h4 M38 24 h4 M11.3 11.3 l2.8 2.8 M33.9 33.9 l2.8 2.8 M36.7 11.3 l-2.8 2.8 M14.1 33.9 l-2.8 2.8" />
      </g>
    </svg>
  </div>
</div>

<style>
  .doodle-bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
  }
  .doodle {
    position: absolute;
    animation: doodle-float 10s ease-in-out infinite;
  }
  @keyframes doodle-float {
    0%,
    100% {
      transform: translateY(0) rotate(var(--r, 0deg));
    }
    50% {
      transform: translateY(-9px) rotate(var(--r, 0deg));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .doodle {
      animation: none;
    }
  }
</style>
