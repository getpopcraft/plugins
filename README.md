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
| `examples/` | One example of every marketplace kind, published to the marketplace by CI. Not in the npm package. |
| `scripts/publish.mjs` | Builds and publishes the examples (see [Publishing](#publishing-to-the-marketplace)). |

**The types are generated, not written.** `dist/generated/global.d.ts` declares the ambient
`popcraft` global as `PopCraftApi`, which is `ReturnType<typeof createMainApi>` — the type of the
object the runtime actually builds. Change a method and its published type changes with it; there is
no second description to keep in step.

## The examples

One folder per marketplace kind:

| Folder | Kind | Examples |
| --- | --- | --- |
| [`plugins/`](examples/plugins) | Plugins | [`arrange-grid`](examples/plugins/arrange-grid) (commands, a UI, storage), [`rename-layers`](examples/plugins/rename-layers) (UI panel, events, storage), [`contrast-checker`](examples/plugins/contrast-checker) (WCAG checks, `findNodes`, `setSelection`), [`pop-palette`](examples/plugins/pop-palette) (paint styles) |
| [`widgets/`](examples/widgets) | Canvas widgets (plugins that register a widget) | [`vote-counter`](examples/widgets/vote-counter), [`poll`](examples/widgets/poll), [`checklist`](examples/widgets/checklist) (named handlers) |
| [`themes/`](examples/themes) | Theme packs (data-only plugins) | [`comic-themes`](examples/themes/comic-themes) (two light themes), [`comic-noir`](examples/themes/comic-noir) (semi-dark) |
| [`brushes/`](examples/brushes) | Brush packs | [`comic-inkers`](examples/brushes/comic-inkers): liner, brush pen, stipple |
| [`shaders/`](examples/shaders) | Shader packs | [`pop-shaders`](examples/shaders/pop-shaders): Ben-Day dots, speed burst, misregistration (one `.wgsl` per shader) |
| [`templates/`](examples/templates) | Templates | [`pop-cover`](examples/templates/pop-cover), [`halftone-quote`](examples/templates/halftone-quote), [`comic-kanban`](examples/templates/comic-kanban) |

Component libraries are the one kind with no example here: a library is published from a cloud file in
the editor (**Assets → Publish library**), not from files in a repo.

Install one from **Main menu → Manage plugins… → Install from file…**, with either a `.zip` of the
folder (`manifest.json` at the root) or a single-file `.json` bundle:
`{ "manifest": { … }, "main": "…code…", "ui": "<html>…" }`.

## Publishing to the marketplace

Each item folder holds one of `manifest.json` (a plugin, widget or theme pack), `pack.json` (a brush or
shader pack: `{ meta, payload }`, images and `.wgsl` files referenced by path) or `template.json`
(`{ meta, payload }`). `scripts/publish.mjs` turns each folder into what the REST API takes and posts it:

```bash
node scripts/publish.mjs --dry-run                     # build and check everything
POPCRAFT_TOKEN=pop_… node scripts/publish.mjs          # publish
```

The `Marketplace` workflow runs the dry run on pull requests and publishes on `main`. It needs:

- the secret **`POPCRAFT_TOKEN`**: a personal access token (Account → Personal access tokens) with the
  **`marketplace:publish`** scope, owned by the account the listings should belong to;
- optionally the variable **`POPCRAFT_URL`** to target another deployment (default `https://popcraft.app`).

Plugins publish when their `version` is new: bump it to ship a change (an existing version is skipped).
Packs and templates are keyed by `meta.localId` and update in place when their folder changes. New plugin
versions go through marketplace review; new packs and templates start private, and you list them once
from the editor (**Publish** → *List on the marketplace*). After that, updates stay listed.

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
