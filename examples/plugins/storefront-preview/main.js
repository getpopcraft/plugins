/// <reference types="@popcraft/plugins" />

// Storefront Preview — an exporter (File → Export → Storefront preview) built on popcraft.getStorefront().
//
// getStorefront() hands a plugin the open page's store design with the store's data marked, not filled:
//   - a field of the record a page is about:  {{page.title}}
//   - a list, around its one copy:            <!-- pc:each list="Products" schema="commerce.product" as="item" limit="3" --> … <!-- pc:end -->
//   - a field inside a list's copy:           {{item.price}}
//   - a storefront form:                      <form data-pc-action="addToCart">
// A store-template plugin turns those marks into its platform's template language (Liquid, Handlebars, PHP).
// This one fills them with the design's own sample records instead, so the store can be shared as one file.

const escapeHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** `html` with every {{scope.key}} filled from `record` (a field it lacks is left empty). */
function fill(html, scope, record) {
  return html.replace(new RegExp(`\\{\\{${scope}\\.([\\w]+)\\}\\}`, 'g'), (_m, key) => escapeHtml(record?.[key]))
}

/** Each list drawn once per sample record of its collection, within its limit and offset. */
function expandLists(html, collections) {
  const each = /<!-- pc:each list="([^"]*)" schema="[^"]*" as="item"((?: \w+="\d+")*) -->([\s\S]*?)<!-- pc:end -->/
  let out = html
  for (let guard = 0; guard < 200 && each.test(out); guard++) {
    out = out.replace(each, (_m, list, attrs, copy) => {
      const n = name => Number((attrs.match(new RegExp(`${name}="(\\d+)"`)) || [])[1] || 0)
      const offset = n('offset'), limit = n('limit')
      const rows = (collections.find(c => c.name === list)?.samples ?? []).slice(offset, limit ? offset + limit : undefined)
      return rows.map(row => fill(copy, 'item', row)).join('\n')
    })
  }
  return out
}

/** A storefront form does nothing in a preview: it says so instead of posting. */
const quietForms = html => html.replace(/<form([^>]*) data-pc-action="(\w+)"/g, '<form$1 onsubmit="event.preventDefault(); alert(\'In the store, this form would: $2\')"')

;(async () => {
  const request = popcraft.exportRequest || (await popcraft.getExportRequest())
  const store = await popcraft.getStorefront()
  if (!store.pages.length) {
    await popcraft.notify('This page has no screens to export.', { error: true })
    return popcraft.closePlugin()
  }
  const pages = store.pages.map((page, i) => {
    // A page about a record (a product's page) is drawn with the first sample of its collection.
    const about = page.about ? store.collections.find(c => c.schema === page.about)?.samples[0] : null
    const html = quietForms(fill(expandLists(page.html, store.collections), 'page', about))
    return `<section class="pc-preview-page" id="page-${i}"><h2 class="pc-preview-label">${escapeHtml(page.name)}${page.route ? ` · ${escapeHtml(page.route)}` : ''}</h2>${html}</section>`
  })
  const nav = store.pages.map((p, i) => `<a href="#page-${i}">${escapeHtml(p.name)}</a>`).join('')
  const doc = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(store.name)} — storefront preview</title>
<style>
  body { margin: 0; background: #111; }
  .pc-preview-nav { position: sticky; top: 0; z-index: 10; display: flex; gap: 16px; padding: 10px 16px; background: #111; font: 600 13px system-ui; }
  .pc-preview-nav a { color: #eee; text-decoration: none; }
  .pc-preview-page { background: #fff; margin: 0 0 48px; }
  .pc-preview-label { margin: 0; padding: 8px 16px; background: #222; color: #aaa; font: 500 12px system-ui; }
</style></head>
<body><nav class="pc-preview-nav">${nav}</nav>
${pages.join('\n')}
</body></html>`
  await popcraft.saveExport({ name: request?.name || `${store.name} storefront.html`, mimeType: 'text/html', bytes: Array.from(new TextEncoder().encode(doc)) })
  await popcraft.notify(`Exported ${store.pages.length} pages of ${store.name}`)
  popcraft.closePlugin()
})()
