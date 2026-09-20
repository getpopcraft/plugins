// Widget element tree. A widget is an interactive canvas object: `render(state)` returns this tree,
// and both the tree and the state are stored on the WIDGET node, so everyone in the file sees the
// widget even without the plugin installed. Clicking an element with `onClick` runs the plugin (in
// the background if needed); the handler mutates or returns the next state and the widget re-renders.
//
// Colours are hex strings: '#rgb', '#rrggbb' or '#rrggbbaa'.

export type PopCraftWidgetColor = string

export type PopCraftWidgetHandler<State> = (
  state: State,
  ctx: { nodeId: string },
) => State | void | Promise<State | void>

export interface PopCraftWidgetBase<State> {
  /** A function (keyed by its position in the tree) or the name of one in `handlers`. */
  onClick?: PopCraftWidgetHandler<State> | (() => void) | string
  /** Tooltip, also used as the accessible name. */
  tooltip?: string
}

export interface PopCraftWidgetAutoLayout<State> extends PopCraftWidgetBase<State> {
  type: 'AutoLayout'
  direction?: 'horizontal' | 'vertical'
  spacing?: number
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number; horizontal?: number; vertical?: number }
  /** A fixed size, or 'hug' (the default) to fit the children. */
  width?: number | 'hug'
  height?: number | 'hug'
  horizontalAlign?: 'start' | 'center' | 'end'
  verticalAlign?: 'start' | 'center' | 'end'
  fill?: PopCraftWidgetColor
  stroke?: PopCraftWidgetColor
  strokeWidth?: number
  cornerRadius?: number
  /** Falsy children are dropped, so `cond && {…}` works. */
  children?: (PopCraftWidgetElement<State> | null | false | undefined)[]
}

export interface PopCraftWidgetText<State> extends PopCraftWidgetBase<State> {
  type: 'Text'
  characters: string
  fontSize?: number
  fontWeight?: number
  fill?: PopCraftWidgetColor
  width?: number
}

export interface PopCraftWidgetShape<State> extends PopCraftWidgetBase<State> {
  type: 'Rectangle' | 'Ellipse'
  width: number
  height: number
  fill?: PopCraftWidgetColor
  stroke?: PopCraftWidgetColor
  strokeWidth?: number
  cornerRadius?: number
}

export type PopCraftWidgetElement<State = any> =
  | PopCraftWidgetAutoLayout<State>
  | PopCraftWidgetText<State>
  | PopCraftWidgetShape<State>

export interface PopCraftWidgetDefinition<State extends object = any> {
  /** Starting state for a newly inserted widget. A function is called per insert. */
  initialState?: State | (() => State)
  render(state: State): PopCraftWidgetElement<State>
  /** Named handlers, for elements whose `onClick` is a string. */
  handlers?: Record<string, PopCraftWidgetHandler<State>>
}

/**
 * The serialised tree as it is stored on the node: `onClick` functions have been replaced by the
 * handler key the host sends back on a click. This is what the editor renders.
 */
export interface PopCraftSerialisedWidget {
  type: 'AutoLayout' | 'Text' | 'Rectangle' | 'Ellipse'
  onClick?: string
  children?: PopCraftSerialisedWidget[]
  [key: string]: unknown
}
