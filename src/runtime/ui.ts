// The UI iframe shim: `popcraft.postMessage(msg)` talks to the main script, and messages arrive both
// as `popcraft.onmessage` and as window "message" events with `event.data.pluginMessage`
// (Figma-style, so existing UI code ports over).

import { createRpcClient, type RpcClient } from './rpc.js'

export function createUiApi(rpc: RpcClient = createRpcClient()) {
  const popcraft = {
    onmessage: null as ((msg: any) => void) | null,
    postMessage: (msg: unknown) => rpc.send({ kind: 'fromUI', data: msg }),
    close: () => rpc.send({ kind: 'closeUI' }),
  }
  rpc.on('message', (msg: unknown) => {
    if (typeof popcraft.onmessage === 'function') popcraft.onmessage(msg)
    window.dispatchEvent(new MessageEvent('message', { data: { pluginMessage: msg } }))
  })
  return popcraft
}

/** Everything a plugin's UI document can reach through the `popcraft` global. */
export type PopCraftUiApi = ReturnType<typeof createUiApi>

/** Called by the generated sandbox document — not part of the authoring surface. */
export function installUiApi(): PopCraftUiApi {
  const rpc = createRpcClient()
  const api = createUiApi(rpc)
  const w = window as unknown as Record<string, unknown>
  w.__popcraftRpc = rpc
  w.popcraft = api
  w.vizpops = api // plugins written before the rename
  return api
}
