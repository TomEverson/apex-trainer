/**
 * Optional user footstep samples (SPEC-005). Drop files in public/samples
 * named {surface}-{1..8}.{wav|ogg}; probing stops at the first missing index,
 * and an empty result means the synthesized steps are used.
 */
import type { Surface } from '../types'

const MAX_SAMPLES = 8
const EXTENSIONS = ['wav', 'ogg']

async function tryLoad(ctx: BaseAudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url)
    // The app answers unknown paths with an HTML page, so check the type too.
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return null
    return await ctx.decodeAudioData(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function loadUserSamples(ctx: BaseAudioContext, surface: Surface): Promise<AudioBuffer[]> {
  const out: AudioBuffer[] = []
  for (let i = 1; i <= MAX_SAMPLES; i++) {
    let buf: AudioBuffer | null = null
    for (const ext of EXTENSIONS) {
      buf = await tryLoad(ctx, `/samples/${surface}-${i}.${ext}`)
      if (buf) break
    }
    if (!buf) break
    out.push(buf)
  }
  return out
}
