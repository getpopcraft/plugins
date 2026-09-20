// The `popcraft` global for a plugin's main script. Every method is async: it is an RPC over the
// MessagePort. The ambient global declaration published to plugin authors is generated from
// `PopCraftApi` below, so the types cannot drift from what this actually implements.

import { createRpcClient, type RpcClient } from './rpc.js'
import type {
  PopCraftEvents, PopCraftExportOptions, PopCraftFindQuery, PopCraftNode, PopCraftNodeType,
  PopCraftPage, PopCraftPaint, PopCraftShowUIOptions, PopCraftVariables,
} from '../types.js'
import type {
  PopCraftSerialisedWidget, PopCraftWidgetDefinition, PopCraftWidgetHandler,
} from '../widget.js'

function clone<T>(v: T): T {
  return (v === undefined ? {} : JSON.parse(JSON.stringify(v))) as T
}

export function createMainApi(rpc: RpcClient = createRpcClient()) {
  // UI messages that arrive before the plugin registers a handler (the UI often loads first) are
  // queued and delivered as soon as one is set.
  const uiHandlers: ((msg: any) => void)[] = []
  let uiOnMessage: ((msg: any) => void) | null = null
  const uiQueue: unknown[] = []

  function deliverUI(msg: unknown): void {
    for (const cb of uiHandlers) { try { cb(msg) } catch (e) { console.error(e) } }
    if (typeof uiOnMessage === 'function') { try { uiOnMessage(msg) } catch (e) { console.error(e) } }
  }
  function flushUI(): void {
    if (uiHandlers.length || typeof uiOnMessage === 'function') uiQueue.splice(0).forEach(deliverUI)
  }
  rpc.on('uimessage', (msg: unknown) => {
    if (!uiHandlers.length && typeof uiOnMessage !== 'function') uiQueue.push(msg)
    else deliverUI(msg)
  })

  // Widgets: `render(state)` returns a UI tree; onClick handlers are functions (keyed by their
  // position in the tree) or names looked up in `handlers`. A handler may mutate the state it is
  // given or return a new one.
  let widgetDef: PopCraftWidgetDefinition | null = null
  const widgetQueue: WidgetClickEvent[] = []

  function renderWidget(state: any): { tree: PopCraftSerialisedWidget; handlers: Record<string, PopCraftWidgetHandler<any>> } {
    const handlers: Record<string, PopCraftWidgetHandler<any>> = {}
    function walk(el: any, path: string): any {
      if (!el || typeof el !== 'object') return el
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(el)) {
        const v = el[k]
        if (k === 'children') {
          out.children = (Array.isArray(v) ? v : [v])
            .filter((c: unknown) => c !== null && c !== undefined && c !== false)
            .map((c: unknown, i: number) => walk(c, path + '.' + i))
        } else if (k === 'onClick' && typeof v === 'function') {
          handlers[path] = v as PopCraftWidgetHandler<any>
          out.onClick = path
        } else {
          out[k] = v
        }
      }
      return out
    }
    return { tree: walk(widgetDef!.render(state), 'root'), handlers }
  }

  function initialWidgetState(): unknown {
    const s = widgetDef && widgetDef.initialState
    return clone(typeof s === 'function' ? (s as () => unknown)() : s)
  }

  function commitWidget(nodeId: string, state: unknown): Promise<void> {
    return rpc.call('widgetUpdate', { id: nodeId, state, tree: renderWidget(clone(state)).tree })
  }

  function handleWidgetClick(e: WidgetClickEvent): void {
    Promise.resolve()
      .then(() => {
        const state = clone(e.state)
        const rendered = renderWidget(state)
        const h = rendered.handlers[e.handler] || (widgetDef!.handlers && widgetDef!.handlers[e.handler])
        if (typeof h !== 'function') return
        return Promise.resolve(h(state, { nodeId: e.nodeId })).then(ret => commitWidget(e.nodeId, ret === undefined ? state : ret))
      })
      .catch((err: unknown) => rpc.send({ kind: 'error', message: String((err as Error)?.message || err) }))
  }
  rpc.on('widgetclick', (e: WidgetClickEvent) => {
    if (widgetDef) handleWidgetClick(e)
    else widgetQueue.push(e)
  })

  const popcraft = {
    /** Which menu command the user picked, or null when the plugin ran some other way. */
    command: null as string | null,

    getSelection: () => rpc.call<PopCraftNode[]>('getSelection'),
    setSelection: (ids: string[]) => rpc.call<void>('setSelection', { ids }),
    getNode: (id: string) => rpc.call<PopCraftNode | null>('getNode', { id }),
    findNodes: (query?: PopCraftFindQuery) => rpc.call<PopCraftNode[]>('findNodes', query || {}),
    getCurrentPage: () => rpc.call<PopCraftPage | null>('getCurrentPage'),
    createNode: (type: PopCraftNodeType, props?: Partial<PopCraftNode>) => rpc.call<string>('createNode', { type, props: props || {} }),
    updateNode: (id: string, props: Partial<PopCraftNode>) => rpc.call<void>('updateNode', { id, props }),
    deleteNode: (id: string) => rpc.call<void>('deleteNode', { id }),
    setText: (id: string, characters: string) => rpc.call<void>('setText', { id, characters }),

    getStyles: () => rpc.call<unknown[]>('getStyles'),
    createPaintStyle: (name: string, paints: PopCraftPaint[]) => rpc.call<string>('createPaintStyle', { name, paints }),
    getVariables: () => rpc.call<PopCraftVariables>('getVariables'),
    setVariableValue: (variableId: string, modeId: string, value: unknown) => rpc.call<void>('setVariableValue', { variableId, modeId, value }),

    exportNode: (id: string, options?: PopCraftExportOptions) => rpc.call<Uint8Array | string>('exportNode', { id, options: options || {} }),
    openExternal: (url: string) => rpc.call<void>('openExternal', { url }),
    notify: (message: string, options?: { error?: boolean }) => rpc.call<void>('notify', { message: String(message), error: !!(options && options.error) }),

    showUI: (options?: PopCraftShowUIOptions) => rpc.call<void>('showUI', options || {}),
    hideUI: () => rpc.call<void>('hideUI'),
    /** Ends the run. The optional message is shown as a notification. */
    closePlugin: (message?: string) => rpc.call<void>('closePlugin', { message }),

    storage: {
      get: <T = unknown>(key: string) => rpc.call<T | undefined>('storageGet', { key }),
      set: (key: string, value: unknown) => rpc.call<void>('storageSet', { key, value }),
    },

    ui: {
      get onmessage(): ((msg: any) => void) | null { return uiOnMessage },
      set onmessage(cb: ((msg: any) => void) | null) { uiOnMessage = cb; flushUI() },
      postMessage: (msg: unknown) => rpc.send({ kind: 'toUI', data: msg }),
      on: (cb: (msg: any) => void) => { uiHandlers.push(cb); flushUI() },
    },

    widget: {
      register<State extends object>(def: PopCraftWidgetDefinition<State>): void {
        if (!def || typeof def.render !== 'function') throw new Error('popcraft.widget.register needs a render(state) function')
        widgetDef = def as PopCraftWidgetDefinition
        widgetQueue.splice(0).forEach(handleWidgetClick)
      },
      insert<State extends object>(options?: { state?: State; x?: number; y?: number }): Promise<string> {
        if (!widgetDef) return Promise.reject(new Error('Call popcraft.widget.register first'))
        const o = options || {}
        const state = o.state !== undefined ? clone(o.state) : initialWidgetState()
        return rpc.call<string>('widgetInsert', { state, tree: renderWidget(state).tree, x: o.x, y: o.y })
      },
      getState: <State extends object = any>(nodeId: string) => rpc.call<State>('widgetGet', { id: nodeId }),
      setState<State extends object>(nodeId: string, state: State): Promise<void> {
        if (!widgetDef) return Promise.reject(new Error('Call popcraft.widget.register first'))
        return commitWidget(nodeId, clone(state))
      },
    },

    on: <E extends keyof PopCraftEvents>(event: E, cb: (data: PopCraftEvents[E]) => void) => rpc.on(event as string, cb),
    off: <E extends keyof PopCraftEvents>(event: E, cb: (data: PopCraftEvents[E]) => void) => rpc.off(event as string, cb),
  }

  rpc.on('init', (data: { command: string | null }) => { popcraft.command = data.command })
  return popcraft
}

interface WidgetClickEvent {
  nodeId: string
  handler: string
  state: unknown
}

/** Everything a plugin's main script can reach through the `popcraft` global. */
export type PopCraftApi = ReturnType<typeof createMainApi>

/** Called by the generated sandbox document — not part of the authoring surface. */
export function installMainApi(): PopCraftApi {
  const rpc = createRpcClient()
  const api = createMainApi(rpc)
  const w = window as unknown as Record<string, unknown>
  w.__popcraftRpc = rpc
  w.popcraft = api
  w.vizpops = api // plugins written before the rename
  window.addEventListener('error', e => rpc.send({ kind: 'error', message: String(e.message || e) }))
  window.addEventListener('unhandledrejection', e => rpc.send({ kind: 'error', message: String((e.reason && e.reason.message) || e.reason) }))
  return api
}

/**
 * Every RPC method name the `popcraft` global exposes, read off a real instance rather than a list
 * anyone has to remember to update. The editor asserts this matches the methods its command registry
 * exposes to plugins, so the two halves of the wire contract cannot drift apart.
 */
export function mainApiMethods(): string[] {
  const noop = () => {}
  const api = createMainApi({ call: () => new Promise(() => {}), send: noop, on: noop, off: noop }) as Record<string, unknown>
  // `on`/`off` are local event subscriptions, not RPCs.
  const methods = Object.keys(api).filter(k => typeof api[k] === 'function' && k !== 'on' && k !== 'off')
  const storage = Object.keys(api.storage as object).map(k => 'storage' + k[0]!.toUpperCase() + k.slice(1))
  const widget = ['widgetInsert', 'widgetUpdate', 'widgetGet']
  return [...methods, ...storage, ...widget].sort()
}
