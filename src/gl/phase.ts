/**
 * Stable pseudo-random value in [0, 1) derived from a string key.
 *
 * Render must be pure, so per-object variation (idle bob phase, particle
 * seeds) is hashed from something the object already owns instead of coming
 * from Math.random(). Same key, same value, on every render.
 */
export function hash01(key: string): number {
  // FNV-1a, then folded into [0, 1)
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 0x100000000
}
