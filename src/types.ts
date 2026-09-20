// The plugin contract: what a manifest may declare and what the `popcraft` global hands back.
// These types are the published API — the runtime in ./runtime implements them, and the ambient
// `popcraft` global is derived from that implementation, never written by hand.

/** What a plugin may do. `notify`, `showUI` and per-plugin storage are always allowed. */
export type PopCraftPermission =
  | 'read'      // read nodes, selection, pages, styles, variables; receive change events
  | 'write'     // create / update / delete nodes, set selection, create styles, set variable values
  | 'export'    // render nodes to PNG/JPG/WEBP/SVG/PDF bytes
  | 'network'   // fetch() from the plugin sandbox (otherwise blocked by CSP — offline by default)
  | 'comments'  // read the file's comment threads and their authors

export const ALL_PERMISSIONS: readonly PopCraftPermission[] = ['read', 'write', 'export', 'network', 'comments']

export type PopCraftNodeType =
  | 'RECTANGLE' | 'ELLIPSE' | 'POLYGON' | 'STAR' | 'LINE' | 'ARROW'
  | 'FRAME' | 'SECTION' | 'TEXT' | 'STICKY' | 'VECTOR' | 'WIDGET'

export interface PopCraftCommand {
  /** Passed to the plugin as `popcraft.command`. */
  id: string
  label: string
}

/** A UI theme file referenced from `contributes.themes`. */
export interface PopCraftTheme {
  type: 'dark' | 'light'
  extends?: string
  tokens?: Record<string, string>
  css?: string
}

export interface PopCraftThemeContribution {
  /** Theme id; must start with the plugin id (`my.plugin.dark`). */
  id: string
  label: string
  /** Path of the theme JSON inside the package. */
  path: string
}

/** Static contributions that need no code: they load without running the plugin sandbox. */
export interface PopCraftContributions {
  themes?: PopCraftThemeContribution[]
}

export interface PopCraftManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  /** Path of the main script inside the package. Optional for data-only plugins (e.g. theme packs). */
  main?: string
  /** Optional path of the UI HTML inside the package. */
  ui?: string
  permissions: PopCraftPermission[]
  /** Menu commands. Defaults to a single "Run" command. */
  commands?: PopCraftCommand[]
  contributes?: PopCraftContributions
  /** Marketplace listing; all optional, editable later by the publisher. */
  icon?: string
  screenshots?: string[]
  category?: string
  tags?: string[]
  homepage?: string
}

export interface PopCraftNode {
  id: string
  type: PopCraftNodeType
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  opacity?: number
  visible?: boolean
  locked?: boolean
  parentId?: string | null
  characters?: string
  [key: string]: unknown
}

export interface PopCraftFindQuery {
  type?: PopCraftNodeType
  name?: string
}

export interface PopCraftPage {
  id: string
  name: string
  childIds: string[]
}

export interface PopCraftPaint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE'
  color?: string
  opacity?: number
  [key: string]: unknown
}

/** `getVariables` returns the raw collections and variables of the open document. */
export interface PopCraftVariables {
  collections: unknown[]
  variables: unknown[]
}

export type PopCraftExportFormat = 'PNG' | 'JPG' | 'WEBP' | 'SVG' | 'PDF'

export interface PopCraftExportOptions {
  format?: PopCraftExportFormat
  /** Pixel scale for raster formats. */
  scale?: number
}

export interface PopCraftShowUIOptions {
  width?: number
  height?: number
  title?: string
  visible?: boolean
}

/** Events a plugin can subscribe to with `popcraft.on`. */
export interface PopCraftEvents {
  selectionchange: { ids: string[] }
  pagechange: { id: string }
  documentchange: void
}
