/// <reference types="@popcraft/plugins" />

// Pop Palette — creates paint styles, skipping any the file already has.
const PALETTE = [
  ['Pop/Yellow', '#FFED00'],
  ['Pop/Magenta', '#EC008C'],
  ['Pop/Cyan', '#00AEEF'],
  ['Pop/Ink', '#231F20'],
  ['Pop/Paper', '#FFFDF2'],
]

;(async () => {
  const existing = new Set((await popcraft.getStyles()).map((/** @type {any} */ s) => s && s.name))
  let added = 0
  for (const [name, color] of PALETTE) {
    if (existing.has(name)) continue
    await popcraft.createPaintStyle(name, [{ type: 'SOLID', color }])
    added++
  }
  await popcraft.closePlugin(added ? `Added ${added} colour style${added === 1 ? '' : 's'}` : 'The pop palette is already in this file')
})()
