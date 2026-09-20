# PopCraft plugin examples

Example plugins for [PopCraft](https://popcraft.app), plus the type definitions for the plugin API.
Everything here is MIT-licensed — copy it, fork it, ship it.

| Package | What it is |
| --- | --- |
| [`@getpopcraft/plugin-typings`](packages/plugin-typings) | Ambient `.d.ts` for the global `popcraft` API |
| [`@getpopcraft/plugin-examples`](packages/examples) | The four example plugins below |

Full developer guide: <https://popcraft.app/docs/plugins>.

## The examples

- **[`random-colors/`](packages/examples/random-colors)** — commands, no UI.
- **[`rename-layers/`](packages/examples/rename-layers)** — UI panel, events, storage.
- **[`vote-counter/`](packages/examples/vote-counter)** — a canvas widget.
- **[`comic-themes/`](packages/examples/comic-themes)** — a data-only theme pack (no `main`, no permissions).

## Installing one

Install from **Main menu → Manage plugins… → Install from file…** with either:

- a `.zip` containing `manifest.json`, the `main` script and optional `ui` HTML (zip the folder), or
- a single-file `.json` bundle: `{ "manifest": { … }, "main": "…code…", "ui": "<html>…" }`.

## Types

```bash
npm i -D @getpopcraft/plugin-typings
```

```js
/// <reference types="@getpopcraft/plugin-typings" />
```

## Sandbox

Each plugin runs in an opaque-origin iframe (`sandbox="allow-scripts"`), talks to the editor only
over a private `MessagePort`, and is blocked from the network by CSP unless its manifest asks for `network`.
Users approve the manifest's permissions (`read`, `write`, `export`, `network`) on first run; calls outside the
granted set are rejected. Plugins are stored in IndexedDB and work offline.

## Widgets

`vote-counter/` is a canvas widget. Call `popcraft.widget.register({ initialState, render })` at the top of
`main.js`, then `popcraft.widget.insert()` from a command. `render(state)` returns a tree of `AutoLayout`,
`Text`, `Rectangle` and `Ellipse` elements; an element's `onClick` mutates (or returns) the next state.

The tree and state are stored on the `WIDGET` node, so the widget renders and syncs for every collaborator, even
without the plugin. Clicking needs the plugin installed (it runs in the background with command `"widget"`), and
only file editors can click. Undo reverts widget clicks like any other edit.
