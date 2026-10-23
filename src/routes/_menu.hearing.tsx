import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { HearingPage, saveTrialFn, type SaveTrialInput } from '../domain/hearing'

export const Route = createFileRoute('/_menu/hearing')({
  ssr: false, // Web Audio + localStorage settings are browser-only
  component: HearingRoute,
})

function HearingRoute() {
  const onTrial = useCallback(async (trial: SaveTrialInput) => {
    await saveTrialFn({ data: trial })
  }, [])
  return <HearingPage onTrial={onTrial} />
}
