/// <reference types="@getpopcraft/plugin-typings" />

// Registered for every command: clicks on an inserted counter run this plugin with command "widget".
popcraft.widget.register({
  initialState: { count: 0, label: 'Votes' },
  render: (state) => ({
    type: 'AutoLayout',
    direction: 'horizontal',
    spacing: 12,
    padding: { horizontal: 14, vertical: 10 },
    verticalAlign: 'center',
    fill: '#ffffff',
    stroke: '#e4e4e7',
    cornerRadius: 14,
    children: [
      {
        type: 'AutoLayout', width: 32, height: 32, cornerRadius: 16, fill: '#f4f4f5', horizontalAlign: 'center', verticalAlign: 'center',
        onClick: () => { state.count = Math.max(0, state.count - 1) },
        children: [{ type: 'Text', characters: '−', fontSize: 18, fill: '#3f3f46' }],
      },
      {
        type: 'AutoLayout', direction: 'vertical', horizontalAlign: 'center',
        children: [
          { type: 'Text', characters: String(state.count), fontSize: 24, fontWeight: 700, fill: '#18181b' },
          { type: 'Text', characters: state.label, fontSize: 11, fill: '#71717a' },
        ],
      },
      {
        type: 'AutoLayout', width: 32, height: 32, cornerRadius: 16, fill: '#0c8ce9', horizontalAlign: 'center', verticalAlign: 'center',
        onClick: () => { state.count += 1 },
        children: [{ type: 'Text', characters: '+', fontSize: 18, fill: '#ffffff' }],
      },
    ],
  }),
})

if (popcraft.command === 'insert') {
  popcraft.widget.insert().then(() => popcraft.closePlugin())
}
