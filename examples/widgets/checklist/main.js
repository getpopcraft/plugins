/// <reference types="@popcraft/plugins" />
/** @typedef {import('@popcraft/plugins').PopCraftWidgetElement} ChecklistRow */

// Panel Checklist — named handlers (`onClick: 'reset'`) next to per-row closures.
const LIST_INK = '#231F20'
const STEPS = ['Thumbnails', 'Pencils', 'Inks', 'Flats', 'Colours', 'Letters']

popcraft.widget.register({
  initialState: () => ({ done: STEPS.map(() => false) }),
  handlers: { reset: (s) => { s.done = s.done.map(() => false) } },
  render: (state) => {
    const count = state.done.filter(Boolean).length
    return {
      type: 'AutoLayout', direction: 'vertical', spacing: 6, padding: 14, width: 220,
      fill: '#ffffff', stroke: LIST_INK, strokeWidth: 3,
      children: [
        { type: 'AutoLayout', direction: 'horizontal', spacing: 8, verticalAlign: 'center', children: [
          { type: 'Text', characters: 'PAGE CHECKLIST', fontSize: 16, fontWeight: 800, fill: LIST_INK },
          { type: 'Text', characters: `${count}/${STEPS.length}`, fontSize: 12, fontWeight: 700, fill: count === STEPS.length ? '#1a9e4b' : '#EC008C' },
        ] },
        ...STEPS.map((step, i) => /** @type {ChecklistRow} */ ({
          type: 'AutoLayout', direction: 'horizontal', spacing: 8, verticalAlign: 'center', tooltip: step,
          onClick: (s) => { s.done[i] = !s.done[i] },
          children: [
            { type: 'Rectangle', width: 16, height: 16, fill: state.done[i] ? '#FFED00' : '#ffffff', stroke: LIST_INK, strokeWidth: 2 },
            { type: 'Text', characters: state.done[i] ? `${step} ✓` : step, fontSize: 13, fontWeight: state.done[i] ? 700 : 500, fill: state.done[i] ? '#6b6570' : LIST_INK },
          ],
        })),
        count > 0 && { type: 'Text', characters: 'Reset', fontSize: 11, fontWeight: 700, fill: '#00AEEF', onClick: 'reset' },
      ],
    }
  },
})

if (popcraft.command === 'insert') popcraft.widget.insert().then(() => popcraft.closePlugin())
