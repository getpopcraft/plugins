# Ecommerce

A store for a storefront design. Everything about Shopify lives in this plugin, none of it in the editor:

- **Store** (a tab on the side of the editor): connect a Shopify store by its `.myshopify.com` address and the public
  Storefront access token (Shopify admin › Sales channels › Headless › your storefront › Storefront API). It is kept
  with the file, and set as the site environment (`SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`) that
  **Publish › Store** deploys a Next.js Commerce store with.
- **Catalogue**: the store's products as pictures, by category, a product's handle or a search, sorted and limited.
  Click a picture to place it on the page; **Use in the design** fills the design's products (and categories) with
  them, so the canvas shows what the store sells.
- **Make it a store**: the collections a store needs (products, categories, cart, cart lines, menu), with samples,
  or the store's own products when one is connected.
- **Checklist**: what the design still needs to sell, the layer to look at, and **Fix** where the plugin can do it
  (a store form's hidden field: add to cart sends `{{item.variant_id}}`, a cart line's form `{{item.merchandise_id}}`).
- **Export › Shopify theme (.zip)**: an Online Store 2.0 theme of the design, to upload in Online Store › Themes.

## How it is built

- `contributes.panels` docks the UI (`ui.html`) as the Store tab; `contributes.exporters` adds the theme to Export.
- The catalogue is read straight from the store's Storefront API (it answers any origin), with the `network`
  permission. Nothing goes through PopCraft's servers.
- The design is changed with the editor's own commands: `editCollection`, `editRecords`, `getRecords`, `setControl`,
  `createNode`, `createImage`, `setSiteEnvironment`; its settings are kept with `setFileData`.
- The theme is the editor's own Shopify theme target (`getStorefrontFiles('shopify-theme')`), saved with `saveExport`.
