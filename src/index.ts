/// <reference path="./generated/global.d.ts" />

// @popcraft/plugins — the PopCraft plugin SDK.
//
// Plugin authors want the types: the ambient `popcraft` global comes with the package, so
// `/// <reference types="@popcraft/plugins" />` at the top of a main script is all it takes.
//
// The editor imports the rest: the compiled sandbox runtime and the document builders that inline
// it under a CSP.

export { buildMainDocument, buildUIDocument, csp } from './host.js'
export { mainApiMethods } from './runtime/main.js'
export { MAIN_RUNTIME, UI_RUNTIME } from './generated/runtime.js'

export type { PopCraftApi } from './runtime/main.js'
export type { PopCraftUiApi } from './runtime/ui.js'

export * from './types.js'
export * from './widget.js'
