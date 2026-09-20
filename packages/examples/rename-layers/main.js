/// <reference types="@popcraft/plugin-typings" />

// Rename Layers — UI ↔ main messaging, selection events and per-plugin storage.
(async () => {
  await popcraft.showUI({ width: 280, height: 190, title: 'Rename layers' })
  const lastPattern = (await popcraft.storage.get('pattern')) || 'Layer #'

  const sendSelection = async () => {
    const selection = await popcraft.getSelection()
    popcraft.ui.postMessage({ type: 'selection', count: selection.length, pattern: lastPattern })
  }
  popcraft.on('selectionchange', sendSelection)

  popcraft.ui.onmessage = async (msg) => {
    if (msg.type === 'ready') return sendSelection()
    if (msg.type === 'cancel') return popcraft.closePlugin()
    if (msg.type === 'rename') {
      const selection = await popcraft.getSelection()
      let i = Number(msg.start) || 1
      for (const node of selection) {
        await popcraft.updateNode(node.id, { name: String(msg.pattern).replace(/#/g, String(i++)) })
      }
      await popcraft.storage.set('pattern', msg.pattern)
      await popcraft.notify(`Renamed ${selection.length} layer${selection.length === 1 ? '' : 's'}`)
    }
  }
})()