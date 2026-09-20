# @popcraft/plugin-typings

Ambient type definitions for the [PopCraft](https://popcraft.app) plugin API — the global `popcraft`
object available inside a plugin's `main` script.

```bash
npm i -D @popcraft/plugin-typings
```

Plugins are plain JavaScript, so reference the types from the top of `main.js`:

```js
/// <reference types="@popcraft/plugin-typings" />

popcraft.commands.on('hello', () => popcraft.notify('Hi'))
```

Or, in a TypeScript project, add it to `tsconfig.json`:

```json
{ "compilerOptions": { "types": ["@popcraft/plugin-typings"] } }
```

Full developer guide: <https://popcraft.app/docs/plugins>.
Working examples: <https://github.com/getpopcraft/plugin-examples>.
