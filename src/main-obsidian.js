// Obsidian 插件入口 —— ItemView + Svelte 5 mount,接真 vault store
import { Plugin, ItemView } from 'obsidian'
import { mount, unmount } from 'svelte'
import App from './App.svelte'
import { createVaultStore } from './lib/vault.js'
import './app.css'

const VIEW_TYPE = 'workbench-view'

class WorkbenchView extends ItemView {
  constructor(leaf) {
    super(leaf)
    this._app = null
  }

  getViewType() {
    return VIEW_TYPE
  }

  getDisplayText() {
    return '工作台'
  }

  getIcon() {
    return 'bird'
  }

  async onOpen() {
    const el = this.contentEl
    el.empty()
    el.style.padding = '0'
    // 任何子元素横向溢出都不允许变成「页面可左右滑动」
    el.style.overflowX = 'hidden'
    const store = createVaultStore(this.app.vault.adapter, this.app)

    // 移动端:测量 Obsidian mobile-navbar 高度,写入 CSS 变量,底栏/内容避让
    const updateNavH = () => {
      const navbar = document.body.querySelector('.mobile-navbar')
      const h = navbar && navbar.offsetParent !== null ? navbar.offsetHeight : 0
      el.style.setProperty('--obsidian-mobile-navbar-h', `${h}px`)
    }
    updateNavH()
    const navbar = document.body.querySelector('.mobile-navbar')
    if (navbar) {
      this._navObs = new ResizeObserver(updateNavH)
      this._navObs.observe(navbar)
    }
    this._onWinResize = updateNavH
    window.addEventListener('resize', updateNavH)

    // vault watcher:外部修改(手改文件/同步插件/Obsync)转发进 store,视图自动刷新
    this.registerEvent(
      this.app.vault.on('modify', (f) => {
        if (f?.path) store._emit(f.path)
      }),
    )
    this._app = mount(App, { target: el, props: { store } })
  }

  async onClose() {
    if (this._navObs) {
      this._navObs.disconnect()
      this._navObs = null
    }
    if (this._onWinResize) {
      window.removeEventListener('resize', this._onWinResize)
      this._onWinResize = null
    }
    if (this._app) {
      unmount(this._app)
      this._app = null
    }
  }
}

export default class WorkbenchPlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new WorkbenchView(leaf))

    this.addRibbonIcon('bird', '阿斌工作台', () => {
      this.activateView()
    })

    this.addCommand({
      id: 'open-workbench',
      name: '打开工作台',
      callback: () => {
        this.activateView()
      },
    })

    // 冷启动默认打开:布局就绪后,主工作区没有任何内容页(只有空态/全无 leaf)时自动开工作台
    this.app.workspace.onLayoutReady(() => {
      if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length > 0) return
      let hasPage = false
      this.app.workspace.iterateRootLeaves((leaf) => {
        const t = leaf.view?.getViewType?.()
        if (t && t !== 'empty') hasPage = true
      })
      if (!hasPage) this.activateView()
    })
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE)
  }

  async activateView() {
    const { workspace } = this.app

    const existing = workspace.getLeavesOfType(VIEW_TYPE)
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0])
      return
    }

    const leaf = workspace.getLeaf('tab')
    await leaf.setViewState({ type: VIEW_TYPE, active: true })
    workspace.revealLeaf(leaf)
  }
}
