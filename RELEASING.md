# Releasing `@popcraft/plugins`

One package: the sandbox runtime the editor injects, and the types plugin authors build against.

## One-time: claim the scope and publish by hand

npm can only attach a trusted publisher to a package that already exists, so the first version goes
out from a laptop:

```bash
npm login
pnpm publish --access public --no-git-checks
```

`prepack` runs the build, so the tarball always carries a freshly compiled `dist/`.

## One-time: turn on OIDC trusted publishing

On npmjs.com → `@popcraft/plugins` → Settings → Trusted publisher:

| Field | Value |
| --- | --- |
| Organization or user | `getpopcraft` |
| Repository | `plugins` |
| Workflow filename | `npm-release.yml` |
| Environment | *(leave blank)* |

Then remove any classic automation token for this package — the workflow publishes with no
`NPM_TOKEN` at all.

## Every release after that

1. Land conventional commits on `main` (`feat:`, `fix:`, `perf:`, `feat!:`). `chore:`/`docs:`/`ci:`
   do not trigger a release.
2. `release.yml` runs [`tishlang/sem`](https://github.com/tishlang/sem), works out the next version,
   pushes the bump, tags it, and opens a **prerelease**.
3. Check the notes, then **uncheck "Set as a pre-release"**.
4. `npm-release.yml` publishes over OIDC with provenance, skipping a version already on the registry.

Same promote-style flow as `tishlang/tish` and `tishlang/sem`.

## A word on the editor

The PopCraft editor depends on this package for `buildMainDocument` / `buildUIDocument` and the
compiled runtime, so **a plugin API change ships here first**. To work across both repos before
publishing, point the app at a checkout:

```bash
cd ~/Projects/popcraft-app && pnpm add -D "link:../plugins"
```

Undo it before committing — the app's `package.json` should always carry a real version range.
