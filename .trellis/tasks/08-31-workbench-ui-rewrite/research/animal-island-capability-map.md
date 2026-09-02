# Research: animal-island-svelte 组件能力地图（供 obsidian-workbench UI 重写）

- **Query**: 35 个导出组件的 props/slots/events、样式机制、消费约束、portal 行为、Svelte 5 习语
- **Scope**: internal — 仓库 /Users/micrease/repos/animal-island-svelte
- **Date**: 2026-08-31

---

## 0. 库总览

- 包名 `animal-island-svelte`，version `0.1.0`，type: `module`，Svelte 5 peer 依赖（`package.json:1-15`）
- 入口 `src/lib/index.ts:1-35` — 35 个 `export * from './components/X'`
- 构建： `@sveltejs/package` （`svelte-package`），产物在 `dist/`，**保留 .svelte 源**（不预编译为 JS）。这意味着下游 Vite 必须装 `svelte` + `@sveltejs/vite-plugin-svelte` 来编译这些 .svelte 文件。
- 出口 map (`package.json:8-15`)：
  ```
  "." → dist/index.js / dist/index.d.ts
  "./style" → dist/styles/index.css
  "./items/*" → dist/items/*  (动物森友会物品图标 PNG)
  ```
  **注意**：`./style` 只暴露 `dist/styles/index.css`，**不能 deep-import 单个子文件**（如 `dist/styles/tokens.css` 不在 exports 中；要么改用相对路径 `animal-island-svelte/dist/styles/tokens.css` 绕过 exports，要么整体引 `./style`）。

---

## 1. 关键消费约束（下游 Obsidian 插件）

### 1.1 dist 新鲜度

`dist/` 与 `src/lib/` 同步。`find src/lib/components -name '*.svelte' -newer dist/index.js` 无结果（41 个 .svelte 全部早于 dist/index.js 构建时间 2026-08-31 12:41）。抽查 `dist/components/Icon/Icon.svelte` 与 `src/lib/components/Icon/Icon.svelte` 字节数一致（3838 B），`dist/styles/*.css` 与 `src/lib/styles/*.css` diff 为空。**dist 是最新构建产物，可直接使用**。

### 1.2 资产解析（关键）

dist 是 .svelte 源形态，**内部资产引用未编译**，下游 Vite 会按自身规则解析：

| 引用形式 | 文件 | 下游解析结果 |
|---|---|---|
| `import leafIcon from './icon-leaf.png'` | `dist/components/Tabs/Tabs.svelte:23` | Vite 处理 → `assetsInlineLimit 100_000` 下 base64 内联 ✓ |
| `import base64 from './back-top.base64?raw'` | `dist/components/BackTop/BackTop.svelte:20` | `?raw` Vite 原生支持 → 字符串内嵌 ✓ |
| CSS `url('../../assets/img/icons/icon-*.svg')` | `dist/components/Icon/Icon.svelte:91-128` | Vite 处理 → inline 阈值下 base64 内联 ✓ |
| CSS `url('data:image/svg+xml;base64,...')` | `dist/components/Select/Select.svelte:344` `dist/components/Divider/Divider.svelte:41-58` | data URI 原文，无需处理 ✓ |
| CSS `url('../../assets/img/cursor/cursor-icon.png')` | `dist/components/Cursor/cursor.css:5` | dist 中 `dist/assets/img/cursor/cursor-icon.png` 存在 ✓ → Vite inline ✓ |
| `import { gsap } from './island/gsap.min.js'` | `dist/components/Loading/Loading.svelte:13` | 第三方 ES module 直接打包 ✓ |
| CSS `url('../assets/fonts/nunito-latin-500-normal.woff2')` | `dist/styles/fonts.css:14` 等 9 条 | Vite 处理 → inline 阈值下 base64 内联 ✓ （中文字体较大，会显著增大 styles.css）|

### 1.3 组件 CSS 是 Svelte scoped style（关键）

**库的 .svelte 组件使用 Svelte scoped `<style>`**（如 `Button.svelte:73-323`）。这意味着：
- 组件 CSS **不会**通过 `import 'animal-island-svelte/style'` 进来；`./style` 只带 fonts/tokens/reset。
- 组件 CSS 在 Svelte 编译时生成（hash-scoped），下游 Vite 在编译这些 .svelte 时把它们打进 `cssCodeSplit: false` 的单一 styles.css ✓。
- 组件内对子元素 / portal 内容使用 `:global(...)` 穿透（如 `Collapse.svelte:192-219`、`Loading.svelte:96`、`Notification.svelte:421`）。这些是**全局选择器**，会写进最终 CSS 全局命名空间，但都带 `animal-` 前缀，与 Obsidian 内部样式不会撞名。

### 1.4 Cursor/cursor.css

`src/lib/components/Cursor/cursor.css` 存在，被 `Cursor.svelte:23` 静态 import；`dist/components/Cursor/cursor.css` 同样存在（与 src 同步）。下游 Vite 编译 Cursor.svelte 时会把 cursor.css 拉进 bundle，其中 `url('../../assets/img/cursor/cursor-icon.png')` 经 Vite 解析到 `dist/assets/img/cursor/cursor-icon.png`（存在 ✓）→ inline 阈值下 base64 内联。

### 1.5 字体自托管（关键）

9 个 woff2 文件位于 `dist/assets/fonts/`：
- `nunito-latin-{500,700,900}-normal.woff2`
- `noto-sans-sc-latin-{400,500,700}-normal.woff2`
- `noto-sans-sc-chinese-simplified-{400,500,700}-normal.woff2`

`fonts.css` 通过 `url('../assets/fonts/...')` 相对引用。下游 Vite 在 `assetsInlineLimit 100_000` 下会把 < 100KB 的字体 base64 内联进 styles.css；简体中文 woff2 通常 > 100KB（实测 200KB+），会**触发 asset emit**——但 Obsidian 插件要求单文件，需要把 `assetsInlineLimit` 调到能覆盖中文字体的值（例如 5_000_000），或者排除中文字体只 import 子集。

---

## 2. 全局 CSS 风险清单（Obsidian 插件需重点评估）

`import 'animal-island-svelte/style'` → `dist/styles/index.css` → `@import './fonts.css'; @import './tokens.css'; @import './reset.css';`（按此顺序）

### 2.1 全局规则

| 规则 | 文件 | 影响 |
|---|---|---|
| `@font-face` × 9 | `fonts.css:9-81` | 注册 Nunito / Noto Sans SC 字体名，**无 font-style/weight 冲突**，但会全局生效 |
| `:root { --animal-* }` × 37 tokens | `tokens.css:7-79` | **写到 :root**，与 Obsidian 主题变量共存（前缀 animal- 不冲突）✓ |
| `*::before, *::after, * { box-sizing: border-box }` | `reset.css:5-9` | **全局 box-sizing reset**——Obsidian 自身样式假设 content-box 的元素可能被破坏（风险中）|
| `[class^='animal-'] { font-family, color, -webkit-font-smoothing, -moz-osx-font-smoothing }` | `reset.css:11-16` | 命中所有 animal- 前缀类，非通用污染 ✓ |

### 2.2 组件级全局规则（:global 穿透）

下列规则在 Svelte scoped 编译后**仍然是全局选择器**，进入 styles.css 全局命名空间：

| 组件 | 选择器 | 文件 |
|---|---|---|
| Collapse | `.animal-collapse-answer :global(a / p / ul / li)` `:global(.animal-collapse-group)` | `Collapse.svelte:192-228` |
| Loading | `.animal-loading-container :global(.illustration)` | `Loading.svelte:96` |
| Notification | `:global(.animal-notification-root)` | `Notification.svelte:421` |
| FormItem | `.animal-form-item-control-input > :global(*)` | `FormItem.svelte:416` |

均带 `animal-` 前缀或嵌套在 animal- 容器下，**与 Obsidian 默认样式不冲突**。

### 2.3 token 清单（37 个）

```
Color:
  --animal-primary-color{-hover,-active,-bg}
  --animal-success-color{-hover,-active}
  --animal-warning-color{-hover,-active}
  --animal-error-color{-hover,-active}
Neutral:
  --animal-text-color{,-secondary,-muted,-disabled}
  --animal-border-color{,-hover,-light}
  --animal-bg-color{,-secondary,-disabled}
Overlay: --animal-mask-bg
Typography:
  --animal-font-family (含 !important)
  --animal-font-size-{sm,base,lg}
  --animal-line-height-base
Spacing: --animal-spacing-{xs,sm,md,lg,xl}
Border:
  --animal-border-radius-{sm,base,lg}
  --animal-border-width
Shadow: --animal-shadow-{sm,base,lg}
Motion:
  --animal-motion-duration-{fast,base,slow}
  --animal-motion-ease
Size: --animal-height-{sm,base,lg}
```

完整定义在 `src/lib/styles/tokens.css:7-79`。

### 2.4 Obsidian 集成的注意点

- `--animal-font-family` 末尾带 `!important`（`tokens.css:44-45`），这是**声明级**，但 `[class^='animal-']` 选择器特异性低 (0,1,0)，仅当元素带 animal- 前缀类时生效——不会污染 Obsidian 其他区域。
- `* { box-sizing: border-box }` 是**唯一真正的全局 reset**。Obsidian 自己的样式大量依赖 border-box，这条通常**没问题**，但若插件内嵌 Obsidian 原生组件（如 setting-tab），需测试。
- `@font-face` 字体声明会写进全局字体命名空间，但 Nunito / Noto Sans SC 名字通用，Obsidian 自身不冲突。

---

## 3. Portal / Overlay 行为

| 组件 | 行为 | 文件 |
|---|---|---|
| Modal | portal 到 document.body，`use:portal` action，打开时禁滚 | `Modal.svelte:50-57, 142-148, 170` |
| Drawer | portal 到 document.body，可选 `pushBackground` 背景下沉 | `Drawer.svelte:52-59, 261, 149-225` |
| Image (preview) | portal 到 document.body | `Image.svelte:43-50, 196` |
| Notification | 首次调用时 `mount()` 到 body 上一个 div | `Notification.svelte:161-170` |
| Tooltip | **不 portal**，相对 wrapper 定位 | `Tooltip.svelte:141-192` |
| Select (dropdown) | **不 portal**，相对 wrapper 定位 | `Select.svelte:201-233` |
| DatePicker / TimePicker | **不 portal**（popper 类） | — |

### 3.1 模块顶层副作用

- Notification 模块顶层创建了 `items/listeners/timers/container`（`Notification.svelte:87-93`），但**不调用 DOM API**；DOM 操作仅在 `notificationOpen()` 被显式调用后通过 `ensureMounted()` 触发，且 `ensureMounted` 自带 `typeof document === 'undefined'` 守卫（`Notification.svelte:163`）。
- 其他组件无模块顶层 DOM 副作用（已用 `grep "document\.\|window\." src/lib/components/*/*.svelte` 确认，全部命中在 `$effect` / 函数体内）。

**结论：库 import 时不会在 SSR / 加载期崩坏**。

---

## 4. Svelte 5 习语

### 4.1 $bindable props（双向绑定列表）

| 组件 | bindable prop | 文件 |
|---|---|---|
| Tabs | `activeKey` | `Tabs.svelte:28` |
| Modal | `open` | `Modal.svelte:67` |
| Drawer | `open` | `Drawer.svelte:66` |
| Input | `value` | `Input.svelte:41` |
| Switch | `checked` | `Switch.svelte:34` |
| Checkbox | `value` (数组） | `Checkbox.svelte:40` |
| Radio | `value` | `Radio.svelte:42` |
| Select | `value` | `Select.svelte:28` |
| DatePicker | `value`, `open` | `DatePicker.svelte:57, 68` |
| TimePicker | `value`, `open` | `TimePicker.svelte:55, 66` |
| Carousel | `activeIndex` | `Carousel.svelte:47` |

### 4.2 Snippet 用法

- **children**: 几乎所有容器组件
- **带参 snippet**: `TableColumn.render: Snippet<[unknown, T, number]>` (`Table.svelte:17`)、`FormItem.children: Snippet<[FormItemFieldProps]>` (`FormItem.svelte:79`)
- **可选 string | Snippet 二选一**： `title` `label` `message` `description` `help` `emptyText` 等
- **渲染判别**: `{#if typeof x === 'string'}{x}{:else}{@render x()}{/if}` 模式贯穿

### 4.3 其他习语

- `$props.id()` 生成稳定组件 ID（`Tabs.svelte:39`, `Modal.svelte:159`）
- `untrack()` 隔离读写（`Modal.svelte:84`, `Collapse.svelte:33`, `Radio.svelte:70`）
- `use:action` 自定义 action： `portal`（Modal/Drawer/Image）、`registerTab`（Tabs）
- `SvelteMap` / `SvelteSet` 响应式集合（`Tabs.svelte:44`, `Notification.svelte:89-91`）
- 事件回调用 **小写 `onchange/onclose/onok/onfinish/oncopy`**（非 React 风格的 onChange/onClose）

---

## 5. 组件 API 详表（优先级 24 个）

### 5.1 Tabs — `src/lib/components/Tabs/Tabs.svelte`

```ts
interface TabItem {
    key: string;
    label: Snippet | string;
    children: Snippet | string;  // tab 面板内容
}
interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onchange'> {
    items: TabItem[];                  // 必填
    defaultActiveKey?: string;
    activeKey?: string;                // $bindable，父级 bind:activeKey
    onchange?: (key: string) => void;
    leafAnimation?: boolean;           // 默认 true（叶子摇摆动画）
    shadow?: boolean;                  // 默认 true（active tab 阴影）
    'aria-label'?: string;
}
```
- 内部： roving tabindex 键盘导航、左右/Home/End 键切换
- 资源： `import leafIcon from './icon-leaf.png'` （随 dist 一起，Vite inline）
- 样式： 已 local scoped

### 5.2 Card — `src/lib/components/Card/Card.svelte`

```ts
type CardType = 'default' | 'dashed';
type CardColor = 'default' | 'app-pink' | 'purple' | 'app-blue' | 'app-yellow' | 'app-orange' | 'app-teal' | 'app-green' | 'app-red' | 'lime-green' | 'yellow-green' | 'brown' | 'warm-peach-pink';
type CardPattern = 'none' | 'default' | CardColor-同名 12 种;
interface CardProps extends HTMLAttributes<HTMLDivElement> {
    type?: CardType;          // 默认 'default'
    color?: CardColor;        // 默认 'default'
    pattern?: CardPattern;    // 默认 'none'
    hoverable?: boolean;      // 默认 false，启用 cursor:pointer + translateY(-2px)
    children?: Snippet;
}
```
- 无事件；静态容器

### 5.3 Button — `src/lib/components/Button/Button.svelte`

```ts
type ButtonType = 'primary' | 'default' | 'dashed' | 'text' | 'link';
type ButtonSize = 'small' | 'middle' | 'large';
type ButtonHTMLType = 'submit' | 'reset' | 'button';
interface ButtonProps extends Omit<HTMLButtonAttributes, 'type'> {
    type?: ButtonType;          // 默认 'default'
    size?: ButtonSize;          // 默认 'middle'
    danger?: boolean;
    ghost?: boolean;
    block?: boolean;
    loading?: boolean;
    disabled?: boolean;
    icon?: Snippet;             // 图标 snippet
    htmlType?: ButtonHTMLType;  // 默认 'button'
    children?: Snippet;
    // 透传所有 button 原生 attrs (onclick 等)
}
```

### 5.4 Input — `src/lib/components/Input/Input.svelte`

```ts
type InputSize = 'small' | 'middle' | 'large';
interface InputProps extends Omit<HTMLInputAttributes, 'size' | 'prefix'> {
    size?: InputSize;             // 默认 'middle'
    prefix?: Snippet;
    suffix?: Snippet;
    allowClear?: boolean;         // 显示 × 清除按钮
    status?: 'error' | 'warning';
    shadow?: boolean;             // 默认 false
    disabled?: boolean;
    value?: string;               // $bindable
    defaultValue?: string;        // 默认 ''
    onchange?: ChangeEventHandler<HTMLInputElement>;  // 接收原生事件
    onclear?: () => void;
    clearAriaLabel?: string;      // 默认 '清除'
    // 透传 input 原生 attrs (placeholder, name, etc)
}
```

### 5.5 Modal — `src/lib/components/Modal/Modal.svelte`

```ts
interface ModalProps {
    open: boolean;                       // 必填，$bindable
    title?: string | Snippet;
    width?: number | string;             // 默认 520
    maskClosable?: boolean;              // 默认 true
    footer?: Snippet | null;             // null 关闭 footer；缺省渲染 取消/确定
    onclose?: () => void;
    onok?: () => void;
    children?: Snippet;
    class?: string;
    typeSpeed?: number;                  // 默认 80ms
    typewriter?: boolean;                // 默认 true
    maskStyle?: string;
}
```
- Portal 到 document.body
- 自动焦点管理（trap + return focus on close）
- ESC 关闭，body overflow hidden
- 默认启用打字机效果（typewriter=true，可通过 typeSpeed 调节）

### 5.6 Drawer — `src/lib/components/Drawer/Drawer.svelte`

```ts
type DrawerPlacement = 'left' | 'right' | 'top' | 'bottom';
interface DrawerProps {
    open: boolean;                  // 必填，$bindable
    title?: string | Snippet;
    placement?: DrawerPlacement;    // 默认 'right'
    width?: number | string;        // 默认 378 (left/right)
    height?: number | string;       // 默认 300 (top/bottom)
    maskClosable?: boolean;         // 默认 true
    pushBackground?: boolean;       // 默认 true，背景下沉景深
    footer?: Snippet | null;
    onclose?: () => void;
    children?: Snippet;
    class?: string;
    maskStyle?: string;
}
```
- Portal 到 document.body
- pushBackground=true 时对 body 直接子元素（非 fixed、非 SCRIPT/STYLE、无 `data-animal-drawer-ignore`）施加 `transform: scale(0.94); filter: blur(1px); border-radius: 14px; overflow: hidden`
- 自身 portal 容器有 `data-animal-drawer-portal`，跳过 pushBackground
- ESC 关闭，body overflow hidden

### 5.7 Collapse — `src/lib/components/Collapse/Collapse.svelte`

```ts
interface CollapseProps {
    question: Snippet;          // 标题
    answer: Snippet;            // 内容
    defaultExpanded?: boolean;  // 默认 false（仅初始值，非受控）
    disabled?: boolean;
    class?: string;
    style?: string;
}
```
- 无展开受控 prop（**只能非受控**）
- 多个 Collapse 包 `.animal-collapse-group` 实现间距（global 选择器）

### 5.8 Tag — `src/lib/components/Tag/Tag.svelte`

```ts
type TagSize = 'small' | 'medium' | 'large';        // 默认 medium
type TagVariant = 'solid' | 'outlined' | 'dashed' | 'soft';  // 默认 soft
type TagColor = 'default' | 同名 12 种;
interface TagProps {
    children?: Snippet;
    size?: TagSize;
    variant?: TagVariant;
    color?: TagColor;            // 默认 'default'
    closable?: boolean;
    onclose?: (e: MouseEvent) => void;
    onclick?: (e: MouseEvent) => void;  // 开启后 span 升级 role=button
    disabled?: boolean;
    class?: string;
    style?: string;
}
```

### 5.9 Switch — `src/lib/components/Switch/Switch.svelte`

```ts
type SwitchSize = 'small' | 'default';
interface SwitchProps {
    checked?: boolean;          // $bindable
    defaultChecked?: boolean;
    size?: SwitchSize;          // 默认 'default'
    disabled?: boolean;
    loading?: boolean;
    checkedChildren?: Snippet;
    unCheckedChildren?: Snippet;
    onchange?: (checked: boolean) => void;
    class?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
}
```

### 5.10 Checkbox — `src/lib/components/Checkbox/Checkbox.svelte`

```ts
type CheckboxSize = 'small' | 'middle' | 'large';
interface CheckboxOption {
    label: string | Snippet;
    value: string | number;
    disabled?: boolean;
}
interface CheckboxProps {
    value?: Array<string | number>;       // $bindable
    defaultValue?: Array<string | number>;
    options: CheckboxOption[];            // 必填
    size?: CheckboxSize;                  // 默认 'middle'
    disabled?: boolean;
    direction?: 'horizontal' | 'vertical';// 默认 'horizontal'
    onchange?: (values: Array<string | number>) => void;
    class?: string;
    style?: string;
}
```

### 5.11 Radio — `src/lib/components/Radio/Radio.svelte`

```ts
type RadioSize = 'small' | 'middle' | 'large';
interface RadioOption { label, value, disabled? }   // 同 Checkbox
interface RadioProps {
    value?: string | number;              // $bindable
    defaultValue?: string | number;
    options: RadioOption[];               // 必填
    size?: RadioSize;                     // 默认 'middle'
    disabled?: boolean;
    direction?: 'horizontal' | 'vertical';
    onchange?: (value: string | number) => void;
    class?: string;
    style?: string;
}
```
- 完整 roving tabindex + 方向键/Home/End 键盘导航

### 5.12 Select — `src/lib/components/Select/Select.svelte`

```ts
interface SelectOption { key: string; label: string; }
interface SelectProps {
    options: SelectOption[];              // 必填
    value?: string;                       // $bindable
    onchange?: (key: string) => void;
    placeholder?: string;                 // 默认 '请选择'
    disabled?: boolean;
    'aria-label'?: string;
    'aria-labelledby'?: string;
}
```
- 触发器是 div role=combobox（非原生 select）
- 下拉不 portal，相对 wrapper 定位，自动避让视口边缘（左右上下翻转）
- 键盘： Enter/Space/ArrowUp/Down/Home/End/ESC

### 5.13 Form — `src/lib/components/Form/`

**完整 antd 风格 Form**：Form, FormItem, FormProvider, createForm

```ts
// Form.svelte
interface FormProps<T> extends Omit<HTMLFormAttributes, 'onsubmit' | 'onreset' | 'children'> {
    form?: FormInstance<T>;               // createForm() 产出
    initialValues?: Partial<T>;
    layout?: 'horizontal' | 'vertical' | 'inline';  // 默认 horizontal
    labelAlign?: 'left' | 'right';
    labelCol?: ColProps;                  // { span, offset }
    wrapperCol?: ColProps;
    size?: 'small' | 'middle' | 'large';
    disabled?: boolean;
    colon?: boolean;                      // 默认 true
    requiredMark?: boolean | 'optional';
    onFinish?: (values: T) => void;
    onFinishFailed?: (info: ValidateInfo) => void;
    onValuesChange?: (changed: Partial<T>, all: T) => void;
    onReset?: (e: Event) => void;
    children?: Snippet;
}

// FormItem.svelte — 通过带参 snippet 注入字段 props
interface FormItemProps {
    name?: NamePath;                      // string | number | (string|number)[]
    label?: string | Snippet;
    rules?: Rules;                        // RuleObject[] 含 required/min/max/pattern/validator
    required?: boolean;
    dependencies?: NamePath[];            // 声明，未实现接线（注释说明）
    valuePropName?: string;               // 默认 'value'
    trigger?: string;                     // 默认 'onchange'（注意小写）
    getValueFromEvent?: (event: unknown) => unknown;
    normalize?: (value, prev, prevAll) => unknown;
    hidden?: boolean;
    hasFeedback?: boolean;
    validateStatus?: 'success' | 'warning' | 'error' | 'validating' | '';
    help?: string | Snippet;
    noStyle?: boolean;
    labelCol?: ColProps;
    wrapperCol?: ColProps;
    colon?: boolean;
    requiredMark?: RequiredMark;
    layout?: 'horizontal' | 'vertical';
    initialValue?: StoreValue;            // 声明，未接线
    class?: string;
    children?: Snippet<[FormItemFieldProps]>;  // 接收字段 props 包
}

// 用法（demo）:
<Form {form} initialValues={{...}} onFinish={...}>
    <FormItem label="用户名" name="username" rules={[...]}>
        {#snippet children(field)}
            <Input {...field} placeholder="..." />
        {/snippet}
    </FormItem>
</Form>
```

### 5.14 Title — `src/lib/components/Title/Title.svelte`

```ts
type TitleSize = 'small' | 'middle' | 'large';   // 14 / 20 / 28 px
type TitleColor = 'default' | 同名 12 种;
interface TitleProps extends HTMLAttributes<HTMLSpanElement> {
    children: Snippet;                    // 必填
    size?: TitleSize;                     // 默认 middle
    color?: TitleColor;                   // 默认 default（绿色）
}
```
- 飘带造型（ribbon）： 燕尾 + 折角 + 正面主体

### 5.15 Divider — `src/lib/components/Divider/Divider.svelte`

```ts
type DividerType = 'line-brown' | 'line-teal' | 'line-white' | 'line-yellow' | 'wave-yellow' | 'dashed-brown' | 'dashed-teal' | 'dashed-white' | 'dashed-yellow';
interface DividerProps {
    type?: DividerType;     // 默认 'line-brown'
    class?: string;
    style?: string;
}
```
- 无内容，仅分隔线； line-* 是 SVG 三角图案； dashed-* 是 CSS 渐变； wave-yellow 是波浪 SVG

### 5.16 Loading — `src/lib/components/Loading/Loading.svelte`

```ts
interface LoadingProps {
    class?: string;
    style?: string;
    active?: boolean;   // 默认 true；false 触发圆形遮罩扩散关闭动画，结束后 display:none
}
```
- 内部用 GSAP + MotionPathPlugin （打包在 `dist/components/Loading/island/`）
- 视觉：黑色背景 + 小岛 SVG 动画；通常用于全屏 loading 遮罩

### 5.17 Skeleton — `src/lib/components/Skeleton/`

```ts
// Skeleton.svelte
type SkeletonVariant = 'text' | 'circle' | 'rect' | 'paragraph';
interface SkeletonProps {
    loading?: boolean;        // 默认 true；false 渲染 children
    variant?: SkeletonVariant;
    active?: boolean;         // 默认 true（流光动画）
    rows?: number;            // paragraph 模式
    width?: number | string;  // text 模式
    rowWidths?: (number | string)[];
    widthValue?: number | string;   // circle/rect
    heightValue?: number | string;  // rect/text
    class?: string;
    style?: string;
    children?: Snippet;
}
// SkeletonButton / SkeletonInput / SkeletonAvatar — 各自 size: small/middle/large
```

### 5.18 Progress — `src/lib/components/Progress/Progress.svelte`

```ts
type ProgressSize = 'small' | 'middle' | 'large';        // 12 / 20 / 28 px
type ProgressInfoPosition = 'inside' | 'right' | 'top';  // 默认 inside
interface ProgressProps {
    percent: number;                          // 必填，0-100
    size?: ProgressSize;
    showInfo?: boolean;                       // 默认 true
    infoPosition?: ProgressInfoPosition;
    infoFormat?: (percent: number) => string; // 默认 `${percent}%`
    duration?: number;                        // 默认 0.6s
    class?: string;
    style?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
}
```

### 5.19 Tooltip — `src/lib/components/Tooltip/Tooltip.svelte`

```ts
type TooltipPlacement = 'top'|'top-start'|'top-end'|'bottom'|'bottom-start'|'bottom-end'|'left'|'left-start'|'left-end'|'right'|'right-start'|'right-end';
type TooltipTrigger = 'hover' | 'focus' | 'click';
type TooltipVariant = 'default' | 'island';  // island = 动森不规则气泡（与 Modal 同款 clip-path）
interface TooltipProps {
    title: string | Snippet;      // 必填，string 可用 \n 换行
    placement?: TooltipPlacement; // 默认 'top'
    trigger?: TooltipTrigger;     // 默认 'hover'
    variant?: TooltipVariant;     // 默认 'default'
    bordered?: boolean;           // 默认 true
    children: Snippet;            // 必填，触发元素
    class?: string;
    style?: string;
}
```
- **不 portal**；相对 wrapper 定位
- 自动 aria-describedby 关联到 wrapper 首个子元素

### 5.20 Notification — `src/lib/components/Notification/Notification.svelte`

**命令式 API（非声明式组件）**:

```ts
import { Notification } from 'animal-island-svelte';

Notification.success({ message: '...', description: '...' });
Notification.info(config | string);
Notification.warning(...);
Notification.error(...);
Notification.open(...);          // = info
Notification.destroy(key?);      // 关闭指定 key / 全部

interface NotificationConfig {
    message: string | Snippet;   // 必填
    description?: string | Snippet;
    duration?: number;           // 默认 4.5s；0 = 不自动关
    position?: 'top'|'topLeft'|'topRight'|'bottom'|'bottomLeft'|'bottomRight';  // 默认 top
    type?: NotificationType;     // 会被方法名覆盖
    icon?: string | Snippet;
    btn?: string | Snippet;
    key?: string;                // 显式指定后同 key 调用更新现有
    onClose?: () => void;
    onClick?: () => void;
    closeIcon?: string | Snippet;
    class?: string;
    style?: string;
}
```
- 首次调用时 `mount()` 到 body 上 `data-animal-notification-root` div
- z-index 2000，高于 Modal(1000)/Drawer(1001)
- 退场动画 250ms

### 5.21 BackTop — `src/lib/components/BackTop/BackTop.svelte`

```ts
interface BackTopProps {
    target?: () => HTMLElement | Window;   // 默认 window
    visibilityHeight?: number;             // 默认 400 px
    onclick?: (e: MouseEvent | KeyboardEvent) => void;
    class?: string;
    style?: string;
    duration?: number;                     // 默认 300 ms
}
```
- 内置 Nook 袋 PNG （经 `?raw` import base64 内嵌）
- Fixed positioning: bottom 48px, right 32px

### 5.22 Icon — `src/lib/components/Icon/Icon.svelte`

```ts
type IconName = 'icon-miles'|'icon-camera'|'icon-chat'|'icon-critterpedia'|'icon-design'|'icon-diy'|'icon-helicopter'|'icon-map'|'icon-shopping'|'icon-variant';
interface IconProps {
    name?: IconName;        // 内置图标（与 src 二选一）
    src?: string;           // 自定义 URL（与 name 二选一）
    size?: number | string; // 默认 24
    class?: string;
    style?: string;
    bounce?: boolean;       // 默认 false，hover 弹跳
    [key: string]: unknown; // 透传任意 attr
}
```
- 内部 10 个 SVG url() 指向 `../../assets/img/icons/icon-*.svg`，dist 中这些 SVG 文件位于 `dist/assets/img/icons/` （下游 Vite inline）
- 物品图标 (item-*) 通过 `animal-island-svelte/items/item-001.png` 子路径 import

### 5.23 Image — `src/lib/components/Image/Image.svelte`

```ts
type ImageColor = 'white' | 'default' | 同名 12 种;
interface ImageProps extends Omit<HTMLImgAttributes, 'src'|'alt'|'width'|'height'|'onload'|'onerror'> {
    src: string;                 // 必填
    alt?: string;
    width?: number | string;
    height?: number | string;
    color?: ImageColor;          // 默认 white（白色衬板相框）
    lazy?: boolean;
    preview?: boolean;           // 默认 true，点击弹大图预览（portal 到 body）
    onload?: EventHandler<Event, HTMLImageElement>;
    onerror?: EventHandler<Event, HTMLImageElement>;
}
```

### 5.24 Table — `src/lib/components/Table/Table.svelte`

```ts
interface TableColumn<T = Record<string, unknown>> {
    title: Snippet | string;
    dataIndex?: keyof T;
    render?: Snippet<[unknown, T, number]>;   // 带参 snippet
    width?: string | number;
    align?: 'left' | 'center' | 'right';
    fixed?: 'left' | 'right';                 // 类型声明，行为未实现
    style?: string;
}
interface TableProps {
    columns?: TableColumn[];
    dataSource?: Record<string, unknown>[];
    rowKey?: string | ((record) => string);   // 默认 'key'
    striped?: boolean;                        // 默认 true
    showHeader?: boolean;                     // 默认 true
    rowClass?: string | ((record, index) => string);
    onrow?: (record, index) => HTMLAttributes<HTMLTableRowElement>;  // 行 attr（含 onclick）
    loading?: boolean;
    emptyText?: Snippet | string;             // 默认 '暂无数据'
    scroll?: { x?: number|string; y?: number|string };  // 仅切换 overflow:auto
    class?: string;
    style?: string;
}
```

---

## 6. 次要组件（一行简介）

| 组件 | 简介 | 关键 props |
|---|---|---|
| Carousel | 轮播，Snippet[] 子元素 | `items: Snippet[]`, `activeIndex` $bindable, `autoplay`, `loop`, `showArrows/Dots` |
| Countdown | 倒计时（里程表滚动动画） | `value: number\|Date`, `format: 'DD HH mm ss'`, `onfinish` |
| Cursor | 全局/局部自定义鼠标光标 | `forceAll?: boolean` （默认 true), `children` |
| DatePicker | 日期/月份/范围选择 | `value` $bindable, `picker: 'date'\|'month'`, `range`, `disabledDate`, `format` |
| TimePicker | 时分秒选择 | `value` $bindable ('HH:mm:ss'), `format`, `hourStep/minuteStep/secondStep` |
| Time | 实时时钟显示 | `type: 'hud'\|'game'` （默认 game) |
| Typewriter | 打字机逐字显示 | `speed` （默认 90ms), `trigger` （变即重启）, `autoPlay` （默认 true), `ondone` |
| CodeBlock | 简易 JSX 高亮 + 复制 | `code: string`, `copyable` （默认 true), `oncopy` |
| Phone | 动森手机界面展示 | `class?: string` 只接受 class |
| Footer | 海/树底图 | `type: 'sea'\|'tree'`, `seamless` |
| Wallet | 钱袋金额显示 | `value: number\|string`, `icon: Snippet`, `size`, `thousandSeparator` |

---

## 7. Demo 用法参考

`src/demo/pages/*.svelte` 提供完整用法，包括：
- `FormPage.svelte:31-71` — Form + FormItem + createForm 完整范例
- `ModalPage.svelte:14-25` — Modal bind:open 用法
- `TabsPage.svelte:31` — Tabs 受控用法
- `SkeletonPage.svelte:11` — Skeleton 组合用法
- `SelectPage.svelte:37` — Select 受控用法

入口用法（`HomePage.svelte:164`）：
```ts
import { Button, Modal, Switch } from 'animal-island-svelte';
import 'animal-island-svelte/style';
```

---

## 8. Caveats / Not Found

- **组件 CSS 走 Svelte scoped 编译**，不能从 dist 单独 import；若需要绕过 Svelte 编译直接用其 CSS 不可行
- **Drawer pushBackground 副作用**：会修改 body 直接子元素的 transform/filter/border-radius/overflow/transition，对 Obsidian 工作区影响需评估；可以传 `pushBackground: false` 关闭
- **Modal 默认开 typewriter**：长内容会逐字显示，可能不符合所有场景；通过 `typewriter={false}` 关闭
- **Collapse 只能非受控**：没有 `expanded` prop 受控接口，仅 `defaultExpanded`
- **TableColumn.fixed / TableProps.scroll.x|y 仅类型声明**，行为未实现（注释明确说明）
- **FormItem.dependencies 仅声明**，原版未实现接线
- **notification API 与浏览器 Notification 构造器同名**：库内部用 `notificationApi` 避免冲突，但消费方 import 时仍是 `import { Notification }`，与 `window.Notification` 命名冲突时需注意
- **CSS 内 `--animal-font-family` 带 `!important`**：声明级重要，但选择器特异性低，实际影响限于 animal- 前缀类
- **exports map 只允许 `./style`**：要按需引 fonts/tokens/reset 需绕开 exports 用 `animal-island-svelte/dist/styles/tokens.css` 形式（Vite 默认允许）
