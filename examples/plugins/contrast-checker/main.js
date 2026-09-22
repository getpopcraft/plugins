/// <reference types="@popcraft/plugins" />

// Contrast Checker — WCAG 2.1 contrast for text layers.
//
// For each text layer: its colour is its first visible solid fill; its background is the first visible
// solid fill found walking up its parents (a page with nothing behind the text counts as white). Large
// text (24px, or 18.66px bold) needs 3:1 for AA; everything else needs 4.5:1. Layers that fail are
// selected so you can fix them in place. Gradients and images behind text can't be measured and are skipped.

;(async () => {
  const texts = popcraft.command === 'page'
    ? await popcraft.findNodes({ type: 'TEXT' })
    : (await popcraft.getSelection()).filter(n => n.type === 'TEXT')
  if (!texts.length) {
    return popcraft.closePlugin(popcraft.command === 'page' ? 'There is no text on this page' : 'Select some text layers (or run "Check the whole page")')
  }

  const failing = []
  let checked = 0
  let skipped = 0
  let worst = null
  for (const node of texts) {
    const fg = solidColor(node)
    const bg = await backgroundOf(node)
    if (!fg || bg === undefined) { skipped++; continue }
    const ratio = contrast(over(fg, bg), bg)
    const large = Number(node.fontSize) >= 24 || (Number(node.fontSize) >= 18.66 && Number(node.fontWeight) >= 700)
    const needed = large ? 3 : 4.5
    checked++
    if (ratio < needed) {
      failing.push(node.id)
      if (!worst || ratio < worst.ratio) worst = { name: node.name, ratio }
    }
  }

  if (failing.length) await popcraft.setSelection(failing)
  const skippedNote = skipped ? ` (${skipped} skipped: gradient, image or no fill)` : ''
  await popcraft.closePlugin(failing.length
    ? `${failing.length} of ${checked} text layer${checked === 1 ? '' : 's'} fail WCAG AA, now selected. Worst: “${worst.name}” at ${worst.ratio.toFixed(2)}:1${skippedNote}`
    : `All ${checked} text layer${checked === 1 ? '' : 's'} pass WCAG AA${skippedNote}`)
})()

/** The first visible solid fill as { r, g, b, a } in 0..1, null when there is none, undefined when it can't be measured. */
function solidColor(node) {
  const fills = Array.isArray(node.fills) ? node.fills.filter(f => f && f.visible !== false) : []
  if (!fills.length) return null
  const top = fills[fills.length - 1]
  if (top.type !== 'SOLID' || !top.color) return undefined
  const c = top.color
  return { r: c.r, g: c.g, b: c.b, a: (c.a ?? 1) * (top.opacity ?? 1) * (node.opacity ?? 1) }
}

/** The opaque colour behind a node, from its nearest ancestor with a solid fill. */
async function backgroundOf(node) {
  let id = node.parentId
  while (id) {
    const parent = await popcraft.getNode(id)
    if (!parent) break
    const c = solidColor(parent)
    if (c === undefined) return undefined
    if (c && c.a > 0) return over(c, { r: 1, g: 1, b: 1, a: 1 })
    id = parent.parentId
  }
  return { r: 1, g: 1, b: 1, a: 1 }
}

/** Composite a translucent colour over an opaque one. */
function over(c, bg) {
  const a = c.a ?? 1
  return { r: c.r * a + bg.r * (1 - a), g: c.g * a + bg.g * (1 - a), b: c.b * a + bg.b * (1 - a), a: 1 }
}

function luminance({ r, g, b }) {
  const lin = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
