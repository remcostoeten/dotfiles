export function makeId(prefix: string): string {
  const random = crypto.getRandomValues(new Uint32Array(2))
  return `${prefix}-${random[0]!.toString(36)}${random[1]!.toString(36)}`
}
