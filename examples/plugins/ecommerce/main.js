/// <reference types="@popcraft/plugins" />

// Ecommerce — a store for a storefront design, as a plugin: everything about Shopify lives here, none of it in the
// editor. Its Store tab (contributes.panels) connects a Shopify store, browses its real catalogue, fills the design
// with it, makes any design a store and checks what it still needs; its exporter (contributes.exporters) writes a
// Shopify theme. The editor keeps only what every store shares: the design's data, its forms, and Publish › Store,
// which deploys the design as a Next.js Commerce store with the site environment this plugin sets.
//
// Shopify's Storefront API answers any origin (CORS *), so the catalogue is read straight from the store with its
// public token — the token every visitor's browser uses on a headless store, which is why it may be kept in the file.

const API_VERSION = '2025-07'
/** What the plugin keeps with the open file (popcraft.setFileData): the store this design sells from. */
const STORE_KEY = 'store'
const REMEMBER_KEY = 'last-store'

// ─── Shopify ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A store's address as Shopify names it, from what was pasted (a URL, an admin link, the bare name). */
function shopDomain(input) {
  const host = String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host)) return host
  if (/^[a-z0-9][a-z0-9-]*$/.test(host)) return `${host}.myshopify.com`
  return null
}

async function shopify(store, query, variables = {}) {
  const res = await fetch(`https://${store.domain}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-shopify-storefront-access-token': store.token },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.errors?.length) throw new Error(body.errors?.[0]?.message || (res.status === 401 || res.status === 403 ? 'Shopify refused the token' : `Shopify answered ${res.status}`))
  return body.data
}

const PRODUCT = `id handle title description availableForSale tags
  priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
  featuredImage { url altText width height }
  variants(first: 1) { nodes { id } }`

/** Shopify's sort keys: a collection's products sort by CREATED, a search's by CREATED_AT. */
const SORTS = {
  newest: { products: 'CREATED_AT', collection: 'CREATED', reverse: true },
  'price-asc': { products: 'PRICE', collection: 'PRICE', reverse: false },
  'price-desc': { products: 'PRICE', collection: 'PRICE', reverse: true },
  title: { products: 'TITLE', collection: 'TITLE', reverse: false },
  'best-selling': { products: 'BEST_SELLING', collection: 'BEST_SELLING', reverse: false },
}

/**
 * The store's products for a query: one product by its handle, a category's (a Shopify collection's handle), or a
 * search over the whole catalogue; sorted, at most `first`.
 */
async function products(store, { category = '', product = '', q = '', sort = 'newest', first = 24 }) {
  const n = Math.max(1, Math.min(Number(first) || 24, 100))
  const s = SORTS[sort] || SORTS.newest
  if (product) {
    const d = await shopify(store, `query($h: String!) { product(handle: $h) { ${PRODUCT} } }`, { h: product })
    return d.product ? [d.product] : []
  }
  if (category) {
    const d = await shopify(store, `query($h: String!, $n: Int!, $k: ProductCollectionSortKeys, $r: Boolean) {
      collection(handle: $h) { products(first: $n, sortKey: $k, reverse: $r) { nodes { ${PRODUCT} } } } }`,
    { h: category, n, k: s.collection, r: s.reverse })
    const list = d.collection?.products.nodes ?? []
    // A category's products are searched here: Shopify's search spans the whole catalogue, not one collection.
    return q ? list.filter(p => `${p.title} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())) : list
  }
  const d = await shopify(store, `query($n: Int!, $k: ProductSortKeys, $r: Boolean, $q: String) { products(first: $n, sortKey: $k, reverse: $r, query: $q) { nodes { ${PRODUCT} } } }`,
    { n, k: s.products, r: s.reverse, q: q || null })
  return d.products.nodes
}

async function categories(store) {
  const d = await shopify(store, '{ collections(first: 100, sortKey: TITLE) { nodes { handle title description } } }')
  return d.collections.nodes.filter(c => c.handle !== 'frontpage')
}

const money = m => (m ? new Intl.NumberFormat('en-US', { style: 'currency', currency: m.currencyCode }).format(Number(m.amount)) : '')

/** A Shopify product as the design's product fields (commerce.product's keys). */
const productValues = p => ({
  title: p.title, handle: p.handle, url: `/product/${p.handle}`, description: p.description,
  price: money(p.priceRange.minVariantPrice), max_price: money(p.priceRange.maxVariantPrice),
  image: p.featuredImage?.url ?? '', image_alt: p.featuredImage?.altText || p.title,
  available: p.availableForSale, variant_id: p.variants.nodes[0]?.id ?? '', tags: p.tags.join(', '),
})

// ─── The design ──────────────────────────────────────────────────────────────────────────────────────────────────

/** What a store's collections are called when this plugin makes them, and a few samples each starts with. */
const STORE_COLLECTIONS = [
  { schema: 'commerce.product', name: 'Products', samples: [
    { title: 'Canvas tote', handle: 'canvas-tote', url: '/product/canvas-tote', description: 'Heavy waxed canvas with leather handles.', price: '$48.00', image_alt: 'Canvas tote', available: true, variant_id: 'gid://shopify/ProductVariant/1', tags: 'bags' },
    { title: 'Wool beanie', handle: 'wool-beanie', url: '/product/wool-beanie', description: 'Ribbed merino, one size.', price: '$32.00', image_alt: 'Wool beanie', available: true, variant_id: 'gid://shopify/ProductVariant/2', tags: 'hats' },
    { title: 'Field notebook', handle: 'field-notebook', url: '/product/field-notebook', description: 'Ninety-six dot-grid pages that lie flat.', price: '$14.00', image_alt: 'Field notebook', available: true, variant_id: 'gid://shopify/ProductVariant/3', tags: 'paper' },
  ] },
  { schema: 'commerce.collection', name: 'Categories', samples: [
    { title: 'Bags', handle: 'bags', url: '/search/bags', description: 'Totes, packs and pouches.' },
    { title: 'Hats', handle: 'hats', url: '/search/hats', description: 'For every season.' },
  ] },
  { schema: 'commerce.cartLine', name: 'Cart lines', samples: [
    { title: 'Canvas tote', variant: '', url: '/product/canvas-tote', quantity: 1, price: '$48.00', merchandise_id: 'gid://shopify/ProductVariant/1' },
  ] },
  { schema: 'commerce.cart', name: 'Cart', samples: [{ count: 1, subtotal: '$48.00', taxes: 'Calculated at checkout', total: '$48.00', checkout_url: '' }] },
  { schema: 'commerce.menu', name: 'Menu', samples: [{ title: 'Shop all', url: '/search' }, { title: 'Bags', url: '/search/bags' }] },
]

/** The design's collection that stands for `schema`, if it has one (getStorefront lists them with their schema). */
async function collectionFor(schema) {
  const store = await popcraft.getStorefront()
  return store.collections.find(c => c.schema === schema) ?? null
}

/**
 * Make a collection's records `rows` (values by field key), matched by handle: a record the design already has keeps
 * its id, so the layers linked to it (set_record) stay linked, and only the others are removed. `keep` leaves the
 * rest in place (adding one product).
 */
async function syncRecords(collection, rows, keep = false) {
  const have = /** @type {{ records?: { id: string, values: Record<string, unknown> }[] }} */ (await popcraft.getRecords({ collection: collection.id, limit: 200 }))
  const byHandle = new Map((have?.records ?? []).map(r => [String(r.values.handle ?? ''), r.id]))
  const upsert = rows.map(values => ({ ...(byHandle.has(values.handle) ? { id: byHandle.get(values.handle) } : {}), values }))
  const wanted = new Set(rows.map(r => r.handle))
  const remove = keep ? [] : (have?.records ?? []).filter(r => !wanted.has(String(r.values.handle ?? ''))).map(r => r.id)
  await popcraft.editRecords({ collection: collection.id, ...(remove.length ? { remove } : {}), upsert })
}

/** Field keys a layer shows of a product, by what the layer or a component property is called. */
const LINKS = [[/title|name/i, 'title'], [/price/i, 'price'], [/image|picture|photo|cover/i, 'image'], [/description|body/i, 'description']]

/**
 * The selected layers show `product`: it is put in the design's Products (or kept up to date there), the layers are
 * about it, and what they show follows its fields — a picture its picture, a text by its name, a component's TEXT
 * and IMAGE properties by theirs. What a layer already follows is left as it is.
 */
async function link(product) {
  const col = await collectionFor('commerce.product')
  if (!col) throw new Error('This design has no products collection: Make it a store first')
  const ids = await popcraft.getSelection()
  if (!ids.length) throw new Error('Select the layers that should show this product first')
  await syncRecords(col, [product], true)
  await popcraft.setRecord({ ids, collection: col.id, record: product.handle })
  let bound = 0
  for (const id of ids) {
    const node = await popcraft.getNode(id)
    if (!node) continue
    const has = node.boundExpressions ?? {}
    const field = name => LINKS.find(([re]) => re.test(name))?.[1]
    if (node.type === 'IMAGE' && !has.imageUrl) { await popcraft.bindField({ ids: [id], property: 'picture', field: 'image' }); bound++ }
    if (node.type === 'TEXT' && !has.characters && field(node.name)) { await popcraft.bindField({ ids: [id], property: 'text', field: field(node.name) }); bound++ }
    if (node.type === 'INSTANCE') {
      const main = await popcraft.getNode(node.mainComponentId)
      const set = main?.parentId ? await popcraft.getNode(main.parentId) : null
      const defs = (set?.type === 'COMPONENT_SET' ? set : main)?.componentPropertyDefinitions ?? {}
      for (const [name, def] of Object.entries(defs)) {
        const f = (def.type === 'IMAGE' ? 'image' : def.type === 'TEXT' ? field(name) : undefined)
        if (f && !has[`prop:${name}`]) { await popcraft.bindField({ ids: [id], property: name, field: f }); bound++ }
      }
    }
  }
  return bound
}

/** Make the store's collections the design is missing, each with samples (or the connected store's products). */
async function makeStore(store) {
  const made = []
  for (const c of STORE_COLLECTIONS) {
    if (await collectionFor(c.schema)) continue
    await popcraft.editCollection({ name: c.name, schema: c.schema })
    const col = await collectionFor(c.schema)
    let rows = c.samples
    if (store && c.schema === 'commerce.product') rows = (await products(store, { first: 6 })).map(productValues)
    if (store && c.schema === 'commerce.collection') rows = (await categories(store)).slice(0, 6).map(x => ({ title: x.title, handle: x.handle, url: `/search/${x.handle}`, description: x.description }))
    if (col && rows.length) await syncRecords(col, rows)
    made.push(c.name)
  }
  return made
}

// ─── What the design still needs to sell ─────────────────────────────────────────────────────────────────────────

const layerOf = id => String(id).split('~')[0]
/** Each storefront form in a page's HTML: its layer, what it does, and the names it sends. */
function formsIn(html) {
  const out = []
  const re = /<form\b([^>]*)>([\s\S]*?)<\/form>/g
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const action = /data-pc-action="(\w+)"/.exec(m[1])?.[1]
    const id = /data-pc-id="([^"]+)"/.exec(m[1])?.[1]
    if (!action || !id) continue
    const names = [...m[2].matchAll(/\bname="([^"]+)"/g)].map(x => x[1])
    out.push({ action, id: layerOf(id), names })
  }
  return out
}

/** A form's hidden field: the value it sends, made a layer of the form that takes no room. */
async function addHiddenField(formId, name, value) {
  const id = await popcraft.createNode('TEXT', { parentId: formId, name: `${name} field`, characters: '', width: 1, height: 1, layoutPositioning: 'ABSOLUTE' })
  await popcraft.setControl({ ids: [id], kind: 'INPUT', inputType: 'hidden', name, value })
  return id
}

/**
 * The checklist: each thing a store needs, whether the design has it, the layer to look at, and the fix the plugin
 * can make itself (`fix`).
 */
async function checklist() {
  const design = await popcraft.getStorefront()
  const env = await popcraft.getSiteEnvironment()
  const has = schema => design.collections.some(c => c.schema === schema)
  const lists = schema => design.pages.filter(p => p.html.includes(`schema="${schema}"`))
  const forms = design.pages.flatMap(p => formsIn(p.html).map(f => ({ ...f, page: p.name })))
  const items = []
  const add = (id, label, ok, more = {}) => items.push({ id, label, ok, ...more })
  add('store', 'Sells from a Shopify store', !!env.SHOPIFY_STORE_DOMAIN, { hint: 'Connect one above: Publish › Store deploys with it.' })
  add('products', 'A products collection', has('commerce.product'), { fix: has('commerce.product') ? undefined : 'make-store' })
  add('list', 'A list of products', lists('commerce.product').length > 0, { hint: 'Repeat a product card over Products (Repeat for each record).' })
  add('product-page', 'A page per product', design.pages.some(p => p.about === 'commerce.product'), { hint: 'Give the product screen a page per record of Products (Page address).' })
  const adds = forms.filter(f => f.action === 'addToCart')
  add('add', 'Add to cart', adds.length > 0, { hint: 'Set a form inside a product to Sending it › Adds the product to the cart.' })
  for (const f of adds.filter(f => !f.names.includes('merchandiseId'))) add(`add-field-${f.id}`, `Add to cart on ${f.page} sends its product`, false, { layer: f.id, fix: 'field', field: ['merchandiseId', '{{item.variant_id}}'] })
  add('cart', 'A cart page', lists('commerce.cartLine').length > 0, { hint: 'Repeat a line over Cart lines on the cart screen.' })
  for (const f of forms.filter(f => (f.action === 'removeCartLine' || f.action === 'updateCartLine') && !f.names.includes('merchandiseId'))) add(`line-field-${f.id}`, `${f.action === 'removeCartLine' ? 'Remove' : 'Quantity'} on ${f.page} sends its line`, false, { layer: f.id, fix: 'field', field: ['merchandiseId', '{{item.merchandise_id}}'] })
  add('checkout', 'Checkout', forms.some(f => f.action === 'checkout'), { hint: 'Set a form on the cart to Sending it › Goes to checkout.' })
  return items
}

// ─── The Store tab ───────────────────────────────────────────────────────────────────────────────────────────────

async function panel() {
  /** @type {{ domain: string, token: string, name: string } | null} */
  let store = (await popcraft.getFileData(STORE_KEY)) || null
  const say = (type, body) => popcraft.ui.postMessage({ type, ...body })
  const fail = (e, about) => say('error', { about, message: e instanceof Error ? e.message : String(e) })

  popcraft.ui.onmessage = async msg => {
    try {
      switch (msg.type) {
        case 'ready':
          say('store', { store: store && { domain: store.domain, name: store.name }, remembered: store ? null : await popcraft.storage.get(REMEMBER_KEY) })
          if (store) say('categories', { categories: await categories(store) })
          say('checklist', { items: await checklist() })
          break
        case 'connect': {
          const domain = shopDomain(msg.domain)
          if (!domain) throw new Error('That is not a store address: your-store.myshopify.com')
          const token = String(msg.token || '').trim()
          if (token.length < 16) throw new Error('Paste the public access token from Headless › your storefront › Storefront API')
          const next = { domain, token }
          const d = await shopify(next, '{ shop { name } }')
          store = { ...next, name: d.shop.name }
          await popcraft.setFileData(STORE_KEY, store)
          // Remembered on this account too (plugin storage, on this device), to fill the form in the next file.
          await popcraft.storage.set(REMEMBER_KEY, { domain, token })
          // What Publish › Store deploys with: the store's address and public token, as the site environment.
          await popcraft.setSiteEnvironment({ SHOPIFY_STORE_DOMAIN: domain, SHOPIFY_STOREFRONT_ACCESS_TOKEN: token })
          say('store', { store: { domain, name: store.name } })
          say('categories', { categories: await categories(store) })
          say('checklist', { items: await checklist() })
          await popcraft.notify(`Connected ${store.name}`)
          break
        }
        case 'disconnect':
          store = null
          await popcraft.setFileData(STORE_KEY, null)
          await popcraft.setSiteEnvironment({ SHOPIFY_STORE_DOMAIN: null, SHOPIFY_STOREFRONT_ACCESS_TOKEN: null })
          say('store', { store: null })
          say('checklist', { items: await checklist() })
          break
        case 'query':
          if (!store) throw new Error('Connect a store first')
          say('products', { products: (await products(store, msg.query)).map(p => ({ ...productValues(p), width: p.featuredImage?.width, height: p.featuredImage?.height })), query: msg.query })
          break
        case 'place': {
          // A product's picture on the page, at the size Shopify's CDN serves it for.
          const url = new URL(msg.product.image)
          url.searchParams.set('width', '800')
          const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
          const w = 400, h = msg.product.width && msg.product.height ? Math.round(400 * msg.product.height / msg.product.width) : 400
          const id = await popcraft.createImage({ bytes: Array.from(bytes), mimeType: 'image/jpeg', name: msg.product.title, width: w, height: h })
          await popcraft.setSelection([id])
          break
        }
        case 'link': {
          const bound = await link(msg.product)
          await popcraft.notify(`Shows ${msg.product.title}${bound ? `: ${bound} ${bound === 1 ? 'property follows' : 'properties follow'} it` : ''}`)
          break
        }
        case 'use': {
          const col = await collectionFor('commerce.product')
          if (!col) throw new Error('This design has no products collection: Make it a store first')
          await syncRecords(col, msg.products)
          if (msg.categories && store) {
            const cats = await collectionFor('commerce.collection')
            if (cats) await syncRecords(cats, (await categories(store)).slice(0, 12).map(x => ({ title: x.title, handle: x.handle, url: `/search/${x.handle}`, description: x.description })))
          }
          await popcraft.notify(`The design shows ${msg.products.length} of your store's products`)
          break
        }
        case 'make-store': {
          const made = await makeStore(store)
          await popcraft.notify(made.length ? `Made ${made.join(', ')}` : 'This design already has every store collection')
          say('checklist', { items: await checklist() })
          break
        }
        case 'check':
          say('checklist', { items: await checklist() })
          break
        case 'select':
          await popcraft.setSelection([msg.layer])
          break
        case 'fix': {
          if (msg.item.fix === 'make-store') await makeStore(store)
          if (msg.item.fix === 'field') await popcraft.setSelection([await addHiddenField(msg.item.layer, ...msg.item.field)])
          say('checklist', { items: await checklist() })
          break
        }
      }
    } catch (e) { fail(e, msg.type) }
  }
}

// ─── The exporter: a Shopify theme ───────────────────────────────────────────────────────────────────────────────

async function exportTheme() {
  try {
    const theme = await popcraft.getStorefrontFiles('shopify-theme')
    await popcraft.saveExport({ name: theme.name, mimeType: 'application/zip', bytes: theme.bytes })
    await popcraft.notify(`Shopify theme: ${theme.files} files. Upload it in Online Store › Themes › Add theme`)
  } catch (e) {
    await popcraft.notify(e instanceof Error ? e.message : String(e), { error: true })
  }
  popcraft.closePlugin()
}

;(async () => {
  const request = popcraft.exportRequest || (await popcraft.getExportRequest())
  if (request?.exporterId === 'shopify-theme') return exportTheme()
  return panel()
})()
