// Sandboxed iframe documents for plugins. Both the main (headless) context and the UI context get an
// opaque origin (`sandbox="allow-scripts"`, no allow-same-origin) and talk to the editor ONLY over a
// MessagePort handed to them once at load. A CSP blocks all network access unless the plugin was
// granted `network`.
//
// The runtime injected here is compiled from ./runtime — the same source the published types are
// generated from, so what a plugin is typed against is exactly what runs.

import { MAIN_RUNTIME, UI_RUNTIME } from './generated/runtime.js'

const escapeScript = (code: string) => code.replace(/<\/script/gi, '<\\/script')

export function csp(network: boolean): string {
  const connect = network ? "connect-src * data: blob:;" : "connect-src 'none';"
  const img = network ? "img-src * data: blob:;" : "img-src data: blob:;"
  const font = network ? "font-src * data:;" : "font-src data:;"
  // form-action/base-uri 'none': a form post or <base> rewrite would otherwise leak document data to any
  // origin, network permission or not.
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; ${img} ${font} ${connect}">`
}

export function buildMainDocument(mainCode: string, network: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8">${csp(network)}<script>${MAIN_RUNTIME}</script></head><body><script>
(function waitForInit() {
  var started = false;
  window.__popcraftRpc.on('init', function () {
    if (started) return; started = true;
    try {
${escapeScript(mainCode)}
    } catch (e) { window.__popcraftRpc.send({ kind: 'error', message: String(e && e.message || e) }); }
  });
})();
</script></body></html>`
}

export function buildUIDocument(uiHtml: string, network: boolean): string {
  const head = `<meta charset="utf-8">${csp(network)}<script>${UI_RUNTIME}</script>`
  // Inject the shim at the start of <head> (or prepend when the author wrote a fragment).
  if (/<head[^>]*>/i.test(uiHtml)) return uiHtml.replace(/<head[^>]*>/i, m => m + head)
  return `<!doctype html><html><head>${head}</head><body>${uiHtml}</body></html>`
}
