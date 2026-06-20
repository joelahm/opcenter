declare global {
  // eslint-disable-next-line no-var
  var realtimeEmit: ((event: string, payload: any) => void) | undefined
}

export function emitRealtime(event: string, payload: any) {
  globalThis.realtimeEmit?.(event, payload)
}
