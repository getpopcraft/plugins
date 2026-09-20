# Comic Themes (example)

A data-only plugin that adds two UI themes. There's no `main` script and no permissions; the manifest's
`contributes.themes` points at theme JSON files. See the [themes docs](https://popcraft.app/docs/themes).

To install, zip the contents of this folder so that `manifest.json` is at the root, then choose
**⋯ → Manage plugins… → Install from file**:

```bash
cd packages/examples/comic-themes && zip -r ../comic-themes.zip manifest.json themes
```
