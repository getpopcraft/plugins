// Type definitions for PopCraft plugins. Reference from the top of your main script with either
//   /// <reference types="@popcraft/plugin-typings" />   (npm i -D @popcraft/plugin-typings)
//   /// <reference path="./popcraft-plugin-typings.d.ts" /> (file downloaded next to your plugin)
//
// A plugin is a manifest.json + main script (+ optional ui.html), installed from a .zip or a
// single-file .json bundle `{ "manifest": {...}, "main": "...code...", "ui": "<html>" }`.
// The main script runs in a sandboxed, offline-by-default iframe; every call below is async.

type PopCraftNodeType = 'RECTANGLE' | 'ELLIPSE' | 'POLYGON' | 'STAR' | 'LINE' | 'ARROW' | 'FRAME' | 'SECTION' | 'TEXT' | 'STICKY' | 'VECTOR'
type PopCraftPermission = 'read' | 'write' | 'export' | 'network'

interface PopCraftColor { r: number; g: number; b: number; a: number }
interface PopCraftPaint { type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE' | string; color?: PopCraftColor; opacity?: number; visible?: boolean; [k: string]: unknown }

interface PopCraftNode {
  id: string
  type: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  parentId: string | null
  childIds?: string[]
  fills?: PopCraftPaint[]
  strokes?: PopCraftPaint[]
  characters?: string
  [prop: string]: unknown
}

interface PopCraftManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  /** Optional for data-only plugins (e.g. theme packs). */
  main?: string
  ui?: string
  permissions: PopCraftPermission[]
  commands?: { id: string; label: string }[]
  contributes?: {
    /** UI themes; ids must start with the plugin id. See docs/themes/publishing-themes. */
    themes?: { id: string; label: string; path: string }[]
  }
}

/** A UI theme file referenced from `contributes.themes` (tokens: see docs/themes/token-reference). */
interface PopCraftTheme {
  type: 'dark' | 'light'
  extends?: string
  tokens?: Record<string, string>
  css?: string
}

// ── Widgets ──────────────────────────────────────────────────────────────────
// A widget is an interactive canvas object. \`render(state)\` returns a declarative tree; the tree and the state
// are stored on the WIDGET node, so everyone in the file sees it (even without the plugin). Clicking an
// element with \`onClick\` runs the plugin (in the background if needed) — the handler mutates or returns the
// next state and the widget re-renders. Colors are hex strings ('#rgb', '#rrggbb', '#rrggbbaa').

type PopCraftWidgetHandler<S> = (state: S, ctx: { nodeId: string }) => S | void | Promise<S | void>

interface PopCraftWidgetBase<S> { onClick?: PopCraftWidgetHandler<S> | (() => void) | string }
interface PopCraftWidgetAutoLayout<S> extends PopCraftWidgetBase<S> {
  type: 'AutoLayout'
  direction?: 'horizontal' | 'vertical'
  spacing?: number
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number; horizontal?: number; vertical?: number }
  width?: number | 'hug'
  height?: number | 'hug'
  horizontalAlign?: 'start' | 'center' | 'end'
  verticalAlign?: 'start' | 'center' | 'end'
  fill?: string
  stroke?: string
  strokeWidth?: number
  cornerRadius?: number
  children?: (PopCraftWidgetElement<S> | null | false | undefined)[]
}
interface PopCraftWidgetText<S> extends PopCraftWidgetBase<S> { type: 'Text'; characters: string; fontSize?: number; fontWeight?: number; fill?: string; width?: number }
interface PopCraftWidgetShape<S> extends PopCraftWidgetBase<S> { type: 'Rectangle' | 'Ellipse'; width: number; height: number; fill?: string; stroke?: string; strokeWidth?: number; cornerRadius?: number }
type PopCraftWidgetElement<S = any> = PopCraftWidgetAutoLayout<S> | PopCraftWidgetText<S> | PopCraftWidgetShape<S>

interface PopCraftWidgetDefinition<S extends object> {
  initialState?: S | (() => S)
  render(state: S): PopCraftWidgetElement<S>
  /** Named handlers, for elements whose onClick is a string. */
  handlers?: Record<string, PopCraftWidgetHandler<S>>
}

interface PopCraftWidgetAPI {
  /** Register once, at the top of main.js, for every command (clicks run the plugin with command "widget"). */
  register<S extends object>(definition: PopCraftWidgetDefinition<S>): void
  /** Insert a widget (default: centered in the viewport, with the initial state). Returns the node id. */
  insert<S extends object>(options?: { state?: S; x?: number; y?: number }): Promise<string>
  getState<S extends object>(nodeId: string): Promise<S>
  setState<S extends object>(nodeId: string, state: S): Promise<void>
}

interface PopCraftAPI {
  widget: PopCraftWidgetAPI

  /** Command id chosen from the Plugins menu (first command, or "run"); "widget" when started by a widget click. */
  readonly command: string | null

  // read
  getSelection(): Promise<PopCraftNode[]>
  getNode(id: string): Promise<PopCraftNode | null>
  findNodes(query?: { type?: string; name?: string }): Promise<PopCraftNode[]>
  getCurrentPage(): Promise<{ id: string; name: string; childIds: string[] } | null>
  getStyles(): Promise<unknown[]>
  getVariables(): Promise<{ collections: unknown[]; variables: unknown[] }>

  // write (id/type/parentId/childIds are ignored in props)
  setSelection(ids: string[]): Promise<void>
  createNode(type: PopCraftNodeType, props?: Partial<PopCraftNode>): Promise<string>
  updateNode(id: string, props: Partial<PopCraftNode>): Promise<void>
  deleteNode(id: string): Promise<void>
  setText(id: string, characters: string): Promise<void>
  createPaintStyle(name: string, paints: PopCraftPaint[]): Promise<string>
  setVariableValue(variableId: string, modeId: string, value: unknown): Promise<void>

  // export
  exportNode(id: string, options?: { format?: 'PNG' | 'JPG' | 'WEBP' | 'SVG' | 'PDF'; scale?: number }): Promise<Uint8Array | string>

  /** Open an https URL in a new browser tab (http is allowed on localhost). Needs the `network` permission. */
  openExternal(url: string): Promise<void>

  // always available
  notify(message: string, options?: { error?: boolean }): Promise<void>
  showUI(options?: { width?: number; height?: number; title?: string; visible?: boolean }): Promise<void>
  hideUI(): Promise<void>
  closePlugin(message?: string): Promise<void>
  storage: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }
  ui: { postMessage(message: unknown): void; onmessage: ((message: any) => void) | null; on(handler: (message: any) => void): void }

  on(event: 'selectionchange', cb: (e: { ids: string[] }) => void): void
  on(event: 'pagechange', cb: (e: { id: string }) => void): void
  on(event: 'documentchange', cb: () => void): void
  off(event: string, cb: (...args: any[]) => void): void
}

/** Inside ui.html */
interface PopCraftUIAPI {
  postMessage(message: unknown): void
  onmessage: ((message: any) => void) | null
  close(): void
}

declare const popcraft: PopCraftAPI
