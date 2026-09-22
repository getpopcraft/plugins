#!/usr/bin/env node
// Publish every example under examples/ to the PopCraft marketplace.
//
//   POPCRAFT_TOKEN=pop_… node scripts/publish.mjs            publish everything
//   node scripts/publish.mjs --dry-run                       build and check every item, send nothing
//   node scripts/publish.mjs --changed-since <git ref>       packs and templates only when their folder changed
//
// An item is a folder holding one of:
//   manifest.json   a plugin, widget or theme pack → POST /api/v1/plugins (as a JSON bundle)
//   pack.json       a brush or shader pack         → POST /api/v1/packs
//   template.json   a template                     → POST /api/v1/templates
//
// Plugins are versioned: an unchanged version comes back 409 and is skipped, so bump `version` to ship.
// Packs and templates are keyed by `meta.localId` and updated in place, so they are only sent when changed.
// Everything published lands in review (plugins) or private (packs, templates) until you list it.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const since = args.includes('--changed-since') ? args[args.indexOf('--changed-since') + 1] : null
const root = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--changed-since') ?? 'examples'
const base = (process.env.POPCRAFT_URL || 'https://popcraft.app').replace(/\/$/, '')
const token = process.env.POPCRAFT_TOKEN

if (!dryRun && !token) fail('Set POPCRAFT_TOKEN to a personal access token with the marketplace:publish scope')

function fail(msg) { console.error(`✖ ${msg}`); process.exit(1) }
const readJson = (p) => {
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch (e) { throw new Error(`${p}: ${e.message}`) }
}

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
/** A path in the item folder → a data: URL (packs embed their images). URLs and data: URLs pass through. */
function dataUrl(dir, ref) {
  if (!ref || /^(data:|https:)/.test(ref)) return ref
  const type = MIME[extname(ref).toLowerCase()]
  if (!type) throw new Error(`${ref}: images must be .svg, .png, .jpg or .webp`)
  const bytes = readFileSync(join(dir, ref))
  return type === 'image/svg+xml' ? `data:${type};utf8,${encodeURIComponent(bytes.toString('utf8'))}` : `data:${type};base64,${bytes.toString('base64')}`
}

/** Every item folder under `dir`, with its kind. */
function findItems(dir) {
  const out = []
  for (const [file, kind] of [['manifest.json', 'plugin'], ['pack.json', 'pack'], ['template.json', 'template']]) {
    if (existsSync(join(dir, file))) return [{ dir, kind }]
  }
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (!name.startsWith('.') && name !== 'node_modules' && statSync(p).isDirectory()) out.push(...findItems(p))
  }
  return out
}

function buildPlugin(dir) {
  const manifest = readJson(join(dir, 'manifest.json'))
  for (const f of ['id', 'name', 'version']) if (!manifest[f]) throw new Error(`manifest.json needs "${f}"`)
  const bundle = { manifest }
  if (manifest.main) bundle.main = readFileSync(join(dir, manifest.main), 'utf8')
  if (manifest.ui) bundle.ui = readFileSync(join(dir, manifest.ui), 'utf8')
  const themes = manifest.contributes?.themes ?? []
  if (themes.length) bundle.themes = Object.fromEntries(themes.map(t => [t.path, readJson(join(dir, t.path))]))
  if (manifest.icon) manifest.icon = dataUrl(dir, manifest.icon)
  return { path: '/api/v1/plugins', label: `${manifest.id}@${manifest.version}`, body: bundle }
}

function buildPack(dir) {
  const { meta, payload } = readJson(join(dir, 'pack.json'))
  if (!meta?.localId || !meta?.kind || !meta?.name) throw new Error('pack.json needs meta.localId, meta.kind and meta.name')
  meta.thumbnail = dataUrl(dir, meta.thumbnail)
  meta.previews = (meta.previews ?? []).map(p => dataUrl(dir, p))
  if (meta.kind === 'shader') {
    payload.shaders = payload.shaders.map(s => {
      const code = s.code ?? readFileSync(join(dir, s.file), 'utf8')
      if (!/\bfn\s+shade\s*\(/.test(code)) throw new Error(`${s.name}: a shader must define fn shade(uv, res, time)`)
      return { name: s.name, code }
    })
  }
  if (meta.kind === 'brush') {
    for (const b of payload.brushes) for (const f of ['tipStampImage', 'grainImage']) if (b.dynamics?.[f]) b.dynamics[f] = dataUrl(dir, b.dynamics[f])
  }
  return { path: '/api/v1/packs', label: `${meta.kind} pack ${meta.localId}`, body: { meta, payload } }
}

function buildTemplate(dir) {
  const { meta, payload } = readJson(join(dir, 'template.json'))
  if (!meta?.localId || !meta?.name || !meta?.kind || !meta?.category) throw new Error('template.json needs meta.localId, name, kind and category')
  if (!payload?.variants?.length) throw new Error('template.json payload needs at least one variant')
  return { path: '/api/v1/templates', label: `template ${meta.localId}`, body: { meta, payload } }
}

function changed(dir) {
  if (!since) return true
  const out = execFileSync('git', ['diff', '--name-only', since, 'HEAD', '--', dir], { encoding: 'utf8' })
  return out.trim().length > 0
}

const items = findItems(root)
if (!items.length) fail(`No items under ${root}`)
let failed = 0
for (const item of items) {
  const where = relative(process.cwd(), item.dir)
  let built
  try {
    built = item.kind === 'plugin' ? buildPlugin(item.dir) : item.kind === 'pack' ? buildPack(item.dir) : buildTemplate(item.dir)
  } catch (e) {
    console.error(`✖ ${where}: ${e.message}`); failed++; continue
  }
  if (dryRun) { console.log(`✓ ${where}  ${built.label}  (${JSON.stringify(built.body).length} bytes)`); continue }
  if (item.kind !== 'plugin' && !changed(item.dir)) { console.log(`· ${where}  unchanged since ${since}`); continue }
  const res = await fetch(base + built.path, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(built.body),
  })
  const text = await res.text()
  if (res.status === 409 && item.kind === 'plugin') console.log(`· ${where}  ${built.label} already published`)
  else if (res.ok) console.log(`✓ ${where}  ${built.label}  ${res.status}`)
  else { console.error(`✖ ${where}  ${built.label}  ${res.status} ${text.slice(0, 300)}`); failed++ }
}
if (failed) fail(`${failed} item${failed === 1 ? '' : 's'} failed`)
