/** Enter fullscreen on the whole document. Needs a user gesture (click / key). */
export async function enterFullscreen(): Promise<void> {
  if (document.fullscreenElement) return
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
  } catch {
    // No user activation / unsupported — run windowed.
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!document.fullscreenElement) return
  try {
    await document.exitFullscreen()
  } catch {
    // Already exiting.
  }
}

/** Toggle fullscreen on the whole document, so it survives trainer ↔ results. */
export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
  } catch {
    // Not allowed (no user activation / unsupported) — nothing to do.
  }
}
