import { createFileRoute } from '@tanstack/react-router'
import { InputCalibration, SettingsForm, useSettings } from '../domain/settings'

export const Route = createFileRoute('/_menu/settings')({
  component: SettingsRoute,
})

function SettingsRoute() {
  const { settings, ready, update } = useSettings()
  if (!ready) return null
  return (
    <>
      <SettingsForm settings={settings} onChange={update} />
      <InputCalibration settings={settings} onChange={update} />
    </>
  )
}
