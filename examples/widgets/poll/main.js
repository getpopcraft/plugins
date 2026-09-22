/// <reference types="@popcraft/plugins" />
/** @typedef {import('@popcraft/plugins').PopCraftWidgetElement} PollRow */

// Pow Poll — a widget whose state is a list of options with vote counts. Each row's onClick is a
// closure over its index; the host keys it by its place in the tree, so it survives re-renders.
const COLORS = ['#FFED00', '#EC008C', '#00AEEF']
const POLL_INK = '#231F20'

popcraft.widget.register({
  initialState: () => ({ question: 'Which cover?', options: [{ label: 'Option A', votes: 0 }, { label: 'Option B', votes: 0 }, { label: 'Option C', votes: 0 }] }),
  render: (state) => {
    const total = state.options.reduce((n, o) => n + o.votes, 0)
    return {
      type: 'AutoLayout', direction: 'vertical', spacing: 10, padding: 16, width: 260,
      fill: '#FFFDF2', stroke: POLL_INK, strokeWidth: 3, cornerRadius: 4,
      children: [
        { type: 'Text', characters: state.question.toUpperCase(), fontSize: 20, fontWeight: 800, fill: POLL_INK },
        ...state.options.map((o, i) => /** @type {PollRow} */ ({
          type: 'AutoLayout', direction: 'vertical', spacing: 4, width: 228, tooltip: `Vote for ${o.label}`,
          onClick: (s) => { s.options[i].votes += 1 },
          children: [
            { type: 'Text', characters: `${o.label} — ${o.votes}`, fontSize: 13, fontWeight: 700, fill: POLL_INK },
            { type: 'AutoLayout', width: 228, height: 12, fill: '#ffffff', stroke: POLL_INK, strokeWidth: 2, children: [
              { type: 'Rectangle', width: Math.max(2, Math.round(224 * (total ? o.votes / total : 0))), height: 8, fill: COLORS[i % COLORS.length] },
            ] },
          ],
        })),
        { type: 'Text', characters: `${total} vote${total === 1 ? '' : 's'} · click a bar`, fontSize: 11, fill: '#6b6570' },
      ],
    }
  },
})

if (popcraft.command === 'insert') popcraft.widget.insert().then(() => popcraft.closePlugin())
