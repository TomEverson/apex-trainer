import { useCallback, useEffect, useState } from 'react'
import type { HearingSettings } from '../types'
import { DEFAULT_HEARING_SETTINGS, loadHearingSettings, saveHearingSettings } from '../services/settings'

/** localStorage-backed; `ready` is false until the stored value has been read on the client. */
export function useHearingSettings() {
  const [settings, setSettings] = useState<HearingSettings>(DEFAULT_HEARING_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setSettings(loadHearingSettings())
    setReady(true)
  }, [])

  const update = useCallback((patch: Partial<HearingSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveHearingSettings(next)
      return next
    })
  }, [])

  return { settings, ready, update }
}
