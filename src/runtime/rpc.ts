// Port handshake + RPC client, shared by both iframe kinds. The editor hands the sandbox exactly one
// MessagePort, once, at load; everything else travels over it.

export interface RpcMessage {
  kind: string
  [key: string]: unknown
}

type Pending = { resolve: (value: any) => void; reject: (error: Error) => void }

export interface RpcClient {
  call<T = unknown>(method: string, params?: unknown): Promise<T>
  send(msg: RpcMessage): void
  on(event: string, cb: (data: any) => void): void
  off(event: string, cb: (data: any) => void): void
}

export function createRpcClient(): RpcClient {
  let port: MessagePort | null = null
  const queue: RpcMessage[] = []
  const pending: Record<number, Pending> = {}
  const listeners: Record<string, ((data: any) => void)[]> = {}
  let nextId = 1

  function send(msg: RpcMessage): void {
    if (port) port.postMessage(msg)
    else queue.push(msg)
  }

  function call<T>(method: string, params?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = nextId++
      pending[id] = { resolve, reject }
      send({ kind: 'rpc', id, method, params })
    })
  }

  function emit(event: string, data: unknown): void {
    for (const cb of (listeners[event] || []).slice()) {
      try { cb(data) } catch (e) { console.error(e) }
    }
  }

  window.addEventListener('message', (e: MessageEvent) => {
    const data = e.data as { type?: string } | null
    if (e.source !== window.parent || !data || data.type !== 'popcraft-plugin-port' || port) return
    port = e.ports[0]
    port.onmessage = (ev: MessageEvent) => {
      const m = (ev.data || {}) as { kind?: string; id?: number; error?: string; result?: unknown; event?: string; data?: unknown }
      if (m.kind === 'result' && m.id !== undefined && pending[m.id]) {
        const p = pending[m.id]
        delete pending[m.id]
        if (m.error) p.reject(new Error(m.error))
        else p.resolve(m.result)
      } else if (m.kind === 'event' && m.event) {
        emit(m.event, m.data)
      }
    }
    for (const msg of queue.splice(0)) port.postMessage(msg)
  })

  return {
    call,
    send,
    on(event, cb) { (listeners[event] = listeners[event] || []).push(cb) },
    off(event, cb) { listeners[event] = (listeners[event] || []).filter(x => x !== cb) },
  }
}
