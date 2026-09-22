/// <reference types="@popcraft/plugins" />

// Arrange in Grid — a small panel asks for the gap and the column count (prefilled from last time and
// from the command), then moves the selected layers. Layers keep their reading order: top to bottom,
// then left to right, by where they sit now. Each cell is as wide as the widest layer in its column and
// as tall as the tallest in its row, so mixed sizes still line up. The grid starts where the selection's
// top-left corner was.

;(async () => {
  const selection = (await popcraft.getSelection()).filter(n => !n.locked)
  if (selection.length < 2) return popcraft.closePlugin('Select two or more layers to arrange')
  const parent = selection[0].parentId ?? null
  if (selection.some(n => (n.parentId ?? null) !== parent)) return popcraft.closePlugin('Select layers inside the same frame or group')

  const gap = Number(await popcraft.storage.get('gap')) || 16
  const n = selection.length
  const columns = popcraft.command === 'row' ? n : popcraft.command === 'column' ? 1 : Math.ceil(Math.sqrt(n))

  await popcraft.showUI({ width: 260, height: 170, title: 'Arrange in grid' })
  popcraft.ui.onmessage = async (msg) => {
    if (msg.type === 'ready') return popcraft.ui.postMessage({ type: 'init', gap, columns, count: n })
    if (msg.type === 'cancel') return popcraft.closePlugin()
    if (msg.type !== 'apply') return
    const g = Math.max(0, Number(msg.gap) || 0)
    const cols = Math.min(n, Math.max(1, Math.round(Number(msg.columns) || 1)))
    await popcraft.storage.set('gap', g)
    await arrange(selection, cols, g)
    await popcraft.closePlugin(`Arranged ${n} layers in ${cols === n ? 'a row' : cols === 1 ? 'a column' : `${cols} columns`}`)
  }
})()

async function arrange(nodes, cols, gap) {
  // Reading order: rows first. Layers whose tops are within half the smallest height count as one row.
  const minH = Math.min(...nodes.map(n => n.height))
  const sorted = [...nodes].sort((a, b) => (Math.abs(a.y - b.y) < minH / 2 ? a.x - b.x : a.y - b.y))
  const rows = Math.ceil(sorted.length / cols)
  const colW = Array.from({ length: cols }, (_, c) => Math.max(0, ...sorted.filter((_, i) => i % cols === c).map(n => n.width)))
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(0, ...sorted.slice(r * cols, r * cols + cols).map(n => n.height)))
  const x0 = Math.min(...nodes.map(n => n.x))
  const y0 = Math.min(...nodes.map(n => n.y))
  for (let i = 0; i < sorted.length; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    const x = x0 + colW.slice(0, c).reduce((s, w) => s + w + gap, 0)
    const y = y0 + rowH.slice(0, r).reduce((s, h) => s + h + gap, 0)
    await popcraft.updateNode(sorted[i].id, { x, y })
  }
}
