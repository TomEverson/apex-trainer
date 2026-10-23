import { useCallback, useEffect, useState } from 'react'
import type { Settings } from '../../../common/lib/tracking'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../services/sensitivity'

/**
 * Settings live in localStorage, which doesn't exist during SSR. `ready` is
 * false until the stored value has been read on the client, so the trainer
 * never starts a run with defaults by accident.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setSettings(loadSettings())
    setReady(true)
  }, [])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, ready, update }
}
