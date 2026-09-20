# @popcraft/plugins

The [PopCraft](https://popcraft.app) plugin SDK — and the example plugins that use it.

```bash
npm i -D @popcraft/plugins
```

```js
/// <reference types="@popcraft/plugins" />

const selection = await popcraft.getSelection()
await popcraft.notify(`${selection.length} selected`)
await popcraft.closePlugin()
```

Full developer guide: <https://popcraft.app/docs/plugins>.

## What is in here

| | |
| --- | --- |
| `src/runtime/` | The `popcraft` global itself — the RPC client, the main-script API, the UI shim. Compiled to a self-contained IIFE and injected into the plugin sandbox by the editor. |
| `src/host.ts` | `buildMainDocument` / `buildUIDocument`: the sandboxed documents, with their CSP. |
| `src/types.ts`, `src/widget.ts` | The manifest, node and widget types. |
| `examples/` | Four working plugins. Not published — clone or copy them. |

**The types are generated, not written.** `dist/generated/global.d.ts` declares the ambient
`popcraft` global as `PopCraftApi`, which is `ReturnType<typeof createMainApi>` — the type of the
object the runtime actually builds. Change a method and its published type changes with it; there is
no second description to keep in step.

## The examples

- **[`random-colors/`](examples/random-colors)** — commands, no UI.
- **[`rename-layers/`](examples/rename-layers)** — UI panel, events, storage.
- **[`vote-counter/`](examples/vote-counter)** — a canvas widget.
- **[`comic-themes/`](examples/comic-themes)** — a data-only theme pack (no `main`, no permissions).

Install one from **Main menu → Manage plugins… → Install from file…**, with either a `.zip` of the
folder (`manifest.json` at the root) or a single-file `.json` bundle:
`{ "manifest": { … }, "main": "…code…", "ui": "<html>…" }`.

## Sandbox

Each plugin runs in an opaque-origin iframe (`sandbox="allow-scripts"`), talks to the editor only
over a private `MessagePort`, and is blocked from the network by CSP unless its manifest asks for
`network`. Users approve the manifest's permissions (`read`, `write`, `export`, `network`,
`comments`) on first run; calls outside the granted set are rejected. Plugins are stored in
IndexedDB and work offline.

## Widgets

`vote-counter/` is a canvas widget. Call `popcraft.widget.register({ initialState, render })` at the
top of `main.js`, then `popcraft.widget.insert()` from a command. `render(state)` returns a tree of
`AutoLayout`, `Text`, `Rectangle` and `Ellipse` elements; an element's `onClick` mutates (or returns)
the next state.

The tree and state are stored on the `WIDGET` node, so the widget renders and syncs for every
collaborator, even without the plugin. Clicking needs the plugin installed (it runs in the background
with command `"widget"`), and only file editors can click. Undo reverts widget clicks like any other
edit.

## Developing

```bash
pnpm install
pnpm build       # compile the runtime, emit dist/ + the ambient global
pnpm typecheck   # the package, then the examples against the generated global
```

Releases: see [RELEASING.md](RELEASING.md).
