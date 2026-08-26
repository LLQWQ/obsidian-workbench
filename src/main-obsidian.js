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
    const store = createVaultStore(this.app.vault.adapter, this.app)
    // vault watcher:外部修改(手改文件/同步插件/Obsync)转发进 store,视图自动刷新
    this.registerEvent(
      this.app.vault.on('modify', (f) => {
        if (f?.path) store._emit(f.path)
      }),
    )
    this._app = mount(App, { target: el, props: { store } })
  }

  async onClose() {
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
