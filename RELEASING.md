# Releasing

Two packages, versioned together: `@popcraft/plugin-typings` and `@popcraft/plugin-examples`.

## One-time: claim the scope and publish by hand

npm can only attach a trusted publisher to a package that already exists, so the first version
goes out from a laptop:

```bash
npm login                       # the @popcraft scope must exist / be claimable by this account
cd packages/plugin-typings && pnpm publish --access public --no-git-checks
cd ../examples          && pnpm publish --access public --no-git-checks
```

Use **pnpm**, not npm: only pnpm rewrites the `workspace:*` devDependency to a real version on
publish. `npm publish` would ship a manifest with a literal `workspace:*` spec in it.

## One-time: turn on OIDC trusted publishing

On npmjs.com, for **each** package → Settings → Trusted publisher:

| Field | Value |
| --- | --- |
| Organization or user | `getpopcraft` |
| Repository | `plugin-examples` |
| Workflow filename | `npm-release.yml` |
| Environment | *(leave blank)* |

After this, remove any classic automation token you were using for these packages — the workflow
publishes with no `NPM_TOKEN` at all.

## Every release after that

1. Land conventional commits on `main` (`feat:`, `fix:`, `perf:`, `feat!:`). `chore:`/`docs:`/`ci:`
   do not trigger a release.
2. `release.yml` runs [`tishlang/sem`](https://github.com/tishlang/sem), works out the next version,
   writes it into both `package.json`s, pushes the bump, tags it, and opens a **prerelease**.
3. Check the release notes, then **uncheck "Set as a pre-release"**.
4. `npm-release.yml` publishes both packages over OIDC, with provenance, skipping any version that
   is already on the registry.

Same promote-style flow as `tishlang/tish` and `tishlang/sem`.
