/// <reference types="@popcraft/plugin-typings" />

// Random Colors — recolours the selection. Demonstrates commands, read/write and notify.
(async () => {
  const selection = await popcraft.getSelection()
  if (selection.length === 0) {
    await popcraft.closePlugin('Select some layers first')
    return
  }
  const pastel = popcraft.command === 'pastel'
  for (const node of selection) {
    if (!('fills' in node)) continue
    const hue = Math.random()
    const [r, g, b] = hslToRgb(hue, pastel ? 0.6 : 0.85, pastel ? 0.82 : 0.55)
    await popcraft.updateNode(node.id, { fills: [{ type: 'SOLID', visible: true, opacity: 1, color: { r, g, b, a: 1 } }] })
  }
  await popcraft.closePlugin(`Recoloured ${selection.length} layer${selection.length === 1 ? '' : 's'}`)
})()

function hslToRgb(h, s, l) {
  const k = n => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}