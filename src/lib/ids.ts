export function uid() {
  return crypto.randomUUID()
}

export function now() {
  return new Date().toISOString()
}
