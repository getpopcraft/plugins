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

export interface PopCraftPresentationSettings {
  voice: string; voiceModel: 'natural' | 'hd' | 'standard'; speed: number;
  style: 'conversational' | 'corporate' | 'energetic' | 'calm' | 'documentary';
  mood: 'uplifting' | 'ambient' | 'cinematic' | 'lofi' | 'electronic' | 'acoustic' | 'none';
  musicModel: 'hq' | 'standard'; stingers: boolean; loudness: number; truePeak: number; beatAlign: boolean; autoAdvance: boolean;
  musicDb: number; duckDb: number; stingerDb: number; leadInMs: number; introMs: number; tailMs: number; minSlideMs: number;
}
export interface PopCraftPresentationAsset {
  mediaHash: string; name: string; durationMs: number; source: 'generated' | 'imported' | 'plugin' | 'fallback';
  model?: string; loudness?: { lufs: number; truePeak: number }; beats?: number[]; bpm?: number | null; hitMs?: number;
}
export interface PopCraftSlideTiming {
  frameId: string; index: number; start: number; duration: number; transitionMs: number;
  voiceStart: number | null; voiceMs: number; leaveAfterMs: number; advanceAfterMs: number; hit: number | null;
}
export interface PopCraftPresentationDeck {
  pageId: string; soundtrackId: string | null; settings: PopCraftPresentationSettings; total: number; trimDb: number;
  slides: { frameId: string; index: number; name: string; notes: string; script: string; animationMs: number;
    transition: { type: string; duration: number } | null; voice: PopCraftPresentationAsset | null; stale: boolean;
    holdMs: number | null; timing: PopCraftSlideTiming }[];
  music: PopCraftPresentationAsset | null; stinger: PopCraftPresentationAsset | null;
}
/** Arguments of an editor command method: see docs/plugins/methods.md for each one's schema. */
export type PopCraftCommandArgs = Record<string, unknown>;

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
    /** Host import mode when launched as an importer, else null. */
    importMode: null as "new" | "into-current" | null,
    /** Pending import file when the host handed one over, else null. */
    importFile: null as { name: string; dataUrl: string; byteLength: number; } | null,
    /** Pending export request (File → Export → this plugin's format), else null. */
    exportRequest: null as { exporterId: string; extension: string; name: string; nodeIds: string[]; } | null,

    getSelection: () => rpc.call<PopCraftNode[]>('getSelection'),
    setSelection: (ids: string[]) => rpc.call<void>('setSelection', { ids }),
    getNode: (id: string) => rpc.call<PopCraftNode | null>('getNode', { id }),
    findNodes: (query?: PopCraftFindQuery) => rpc.call<PopCraftNode[]>('findNodes', query || {}),
    getCurrentPage: () => rpc.call<PopCraftPage | null>('getCurrentPage'),
    createNode: (type: PopCraftNodeType, props?: Partial<PopCraftNode>) => rpc.call<string>('createNode', { type, props: props || {} }),
    updateNode: (id: string, props: Partial<PopCraftNode>) => rpc.call<void>('updateNode', { id, props }),
    deleteNode: (id: string) => rpc.call<void>('deleteNode', { id }),
    setText: (id: string, characters: string) => rpc.call<void>('setText', { id, characters }),
    /** Put TEXT layers on a path (another layer's outline, or their own arc, circle or wave), or tune one: brackets, alignment, placement, effect, overflow. */
    setTextPath: (opts: { ids?: string[]; mode?: 'PATH' | 'ARC' | 'CIRCLE' | 'WAVE' | 'NONE'; pathId?: string; bend?: number; radius?: number; amplitude?: number; frequency?: number; offset?: number; endOffset?: number; flip?: boolean; align?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFY'; placement?: 'BASELINE' | 'ASCENDER' | 'DESCENDER' | 'CENTER'; baselineShift?: number; spacing?: number; effect?: 'RAINBOW' | 'SKEW' | 'RIBBON' | 'STAIR' | 'GRAVITY'; overflow?: 'CLIP' | 'VISIBLE' | 'SHRINK'; }) => rpc.call<unknown>('setTextPath', opts || {}),
    /** Area type: flow a TEXT layer inside a closed shape, kept `inset` px in. */
    flowTextIntoShape: (opts: { id?: string; shapeId?: string; inset?: number; fit?: 'NONE' | 'SHRINK' | 'FIT'; }) => rpc.call<unknown>('flowTextIntoShape', opts || {}),
    /** Take TEXT layers off their path or out of their shape (or free every text linked to a path / shape). */
    detachText: (opts?: { ids?: string[]; }) => rpc.call<unknown>('detachText', opts || {}),
    /** Auto-size TEXT layers' type to their box, shape or path. */
    setTextFit: (opts: { ids?: string[]; fit: 'NONE' | 'SHRINK' | 'FIT'; }) => rpc.call<unknown>('setTextFit', opts || {}),
    createPage: (name?: string) => rpc.call<string>('createPage', name != null ? { name: String(name) } : {}),
    setCurrentPage: (pageId: string) => rpc.call<void>('setCurrentPage', { pageId }),
    createImage: (opts: { dataUrl?: string; bytes?: number[]; mimeType?: string; name?: string; x?: number; y?: number; width?: number; height?: number; parentId?: string; }) => rpc.call<string>('createImage', opts || {}),
    createDocument: (opts?: { name?: string; }) => rpc.call<{ key?: string; docId: string; name: string; }>('createDocument', opts || {}),
    getImportMode: () => rpc.call<"new" | "into-current" | null>('getImportMode'),
    getImportFile: () => rpc.call<{ name: string; dataUrl: string; byteLength: number; } | null>('getImportFile'),
    /**
    * The open page as a storefront design in a neutral form, for an exporter that writes its own store's templates:
    * each page's HTML with the store's data marked (`{{page.title}}`, `{{item.price}}`, `<!-- pc:each … -->` lists,
    * `data-pc-action` forms), and its collections with their commerce schema and sample records.
    */
    getStorefront: () => rpc.call<{ name: string; pages: { name: string; route: string | null; about: string | null; html: string }[]; collections: { id: string; name: string; schema: string | null; fields: string[]; samples: Record<string, unknown>[] }[]; }>('getStorefront'),
    getExportRequest: () => rpc.call<{ exporterId: string; extension: string; name: string; nodeIds: string[]; } | null>('getExportRequest'),
    /** Save the exporter's file (once per export request); the host enforces the contributed extension. */
    saveExport: (file: { name?: string; mimeType?: string; bytes?: Uint8Array | number[]; dataUrl?: string; }) => rpc.call<{ name: string; byteLength: number; }>('saveExport', file || {}),
    /**
    * Presentation audio (docs/plugins/presentation-audio.md): the deck's slides, notes, narration and timing; the
    * soundtrack's settings, bed and stinger.
    */
    getPresentationAudio: (opts?: { pageId?: string }) => rpc.call<PopCraftPresentationDeck>('getPresentationAudio', opts || {}),
    /** Change the soundtrack's settings (voice, style, mood, loudness, beat alignment, levels) and re-time it. */
    setPresentationAudioSettings: (opts: { pageId?: string } & Partial<PopCraftPresentationSettings>) => rpc.call<{ soundtrackId: string | null; settings: PopCraftPresentationSettings; total: number }>('setPresentationAudioSettings', opts || {}),
    /** Put a sound in (a slide's narration, the bed or the stinger): bytes are normalised to the soundtrack's target and stored. */
    setPresentationAudioClip: (opts: { pageId?: string; role: 'voice' | 'music' | 'stinger'; frameId?: string; bytes?: Uint8Array | number[]; mediaHash?: string; url?: string; name?: string; normalize?: boolean; bpm?: number; beats?: number[]; hitMs?: number }) => rpc.call<{ soundtrackId: string | null; asset: PopCraftPresentationAsset; total: number; mix: { lufs: number; truePeak: number } | null }>('setPresentationAudioClip', opts || {}),
    removePresentationAudioClip: (opts: { pageId?: string; role: 'voice' | 'music' | 'stinger'; frameId?: string }) => rpc.call<{ total: number }>('removePresentationAudioClip', opts || {}),
    /** Re-time: fixed slide lengths (ms, null clears) and beat-aligned changes. */
    setPresentationTiming: (opts: { pageId?: string; holds?: Record<string, number | null>; beatAlign?: boolean }) => rpc.call<{ total: number; slides: PopCraftSlideTiming[] }>('setPresentationTiming', opts || {}),
    /** The mix as the export carries it: loudness, true peak, and (wav: true) the 48 kHz stereo WAV. */
    getPresentationMix: (opts?: { pageId?: string; wav?: boolean; range?: [number, number] }) => rpc.call<{ lufs: number | null; truePeak: number | null; target?: number; ceiling?: number; durationMs: number; sampleRate?: number; wav?: Uint8Array }>('getPresentationMix', opts || {}),
    /** Ask the user to generate with AI (the panel opens with the request filled in; the user decides). */
    requestPresentationAudio: (opts?: { pageId?: string; what?: 'all' | 'voice' | 'music' | 'stingers'; slides?: string[] } & Partial<PopCraftPresentationSettings>) => rpc.call<{ status: 'generated'; summary: string } | { status: 'declined' } | { status: 'failed'; error: string }>('requestPresentationAudio', opts || {}),
    /** Editor commands: each takes the arguments documented in docs/plugins/methods.md (the agent tool of the same purpose). */
    moveNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('moveNodes', opts || {}),
    resizeNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('resizeNodes', opts || {}),
    renameNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('renameNodes', opts || {}),
    reparentNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('reparentNodes', opts || {}),
    duplicateNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('duplicateNodes', opts || {}),
    groupNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('groupNodes', opts || {}),
    ungroupNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('ungroupNodes', opts || {}),
    alignNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('alignNodes', opts || {}),
    distributeNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('distributeNodes', opts || {}),
    flipNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('flipNodes', opts || {}),
    rotateNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('rotateNodes', opts || {}),
    reorderNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('reorderNodes', opts || {}),
    setLocked: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setLocked', opts || {}),
    setVisible: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setVisible', opts || {}),
    setAutoLayout: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setAutoLayout', opts || {}),
    importSvg: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('importSvg', opts || {}),
    measureNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('measureNodes', opts || {}),
    setFills: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setFills', opts || {}),
    setStrokes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setStrokes', opts || {}),
    setEffects: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setEffects', opts || {}),
    replaceColor: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('replaceColor', opts || {}),
    setTypography: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setTypography', opts || {}),
    applyStyle: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('applyStyle', opts || {}),
    createComponent: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('createComponent', opts || {}),
    createInstance: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('createInstance', opts || {}),
    renamePage: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('renamePage', opts || {}),
    getDocumentOutline: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('getDocumentOutline', opts || {}),
    setPageSetup: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setPageSetup', opts || {}),
    setShowAdvance: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setShowAdvance', opts || {}),
    booleanOperation: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('booleanOperation', opts || {}),
    flattenNodes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('flattenNodes', opts || {}),
    outlineStroke: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('outlineStroke', opts || {}),
    setMask: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setMask', opts || {}),
    setMaskType: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setMaskType', opts || {}),
    shapeBuilder: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('shapeBuilder', opts || {}),
    setKeyframes: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setKeyframes', opts || {}),
    getAnimation: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('getAnimation', opts || {}),
    getCompositions: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('getCompositions', opts || {}),
    editBehaviours: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('editBehaviours', opts || {}),
    setTimeline: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setTimeline', opts || {}),
    setLayerTiming: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setLayerTiming', opts || {}),
    editTextAnimation: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('editTextAnimation', opts || {}),
    edit3DScene: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('edit3DScene', opts || {}),
    setInstancePlayback: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setInstancePlayback', opts || {}),
    editComponentProperty: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('editComponentProperty', opts || {}),
    setShaderFill: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('setShaderFill', opts || {}),
    createComposition: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('createComposition', opts || {}),
    editComposition: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('editComposition', opts || {}),
    editStateMachine: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('editStateMachine', opts || {}),
    getStateMachine: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('getStateMachine', opts || {}),
    applyMotionPreset: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('applyMotionPreset', opts || {}),
    staggerMotion: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('staggerMotion', opts || {}),
    createMotionComponent: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('createMotionComponent', opts || {}),
    addAudio: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('addAudio', opts || {}),
    editFrameAudio: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('editFrameAudio', opts || {}),
    editVideoClip: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('editVideoClip', opts || {}),
    detectAudioOnsets: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('detectAudioOnsets', opts || {}),
    cutToBeat: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('cutToBeat', opts || {}),
    editPrototype: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('editPrototype', opts || {}),
    usePresentationFallbackAudio: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('usePresentationFallbackAudio', opts || {}),
    /** Bring a Lottie, PDF or PopCraft file into the open document (the `importFile` field is the file an importer was handed). */
    importDocumentFile: (opts?: PopCraftCommandArgs) => rpc.call<unknown>('importDocumentFile', opts || {}),

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

  rpc.on('init', (data: { command: string | null; importMode?: typeof popcraft.importMode; importFile?: typeof popcraft.importFile; exportRequest?: typeof popcraft.exportRequest }) => {
    popcraft.command = data.command
    popcraft.importMode = data.importMode ?? null
    popcraft.importFile = data.importFile ?? null
    popcraft.exportRequest = data.exportRequest ?? null
  })
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
