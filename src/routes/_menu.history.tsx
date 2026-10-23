import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { SCENARIOS, WEAPONS } from '../domain/trainer'
import { HistoryPage, listRecoilSessionsFn, listSessionsFn, RecoilHistory } from '../domain/sessions'
import { buildRecoilReport, buildReport } from '../domain/analysis'

export const Route = createFileRoute('/_menu/history')({
  loader: async () => {
    const [sessions, recoil] = await Promise.all([listSessionsFn(), listRecoilSessionsFn()])
    return { sessions, recoil }
  },
  component: HistoryRoute,
})

type View = 'aim' | 'recoil'

function HistoryRoute() {
  const { sessions, recoil } = Route.useLoaderData()
  const [view, setView] = useState<View>('aim')
  const [copied, setCopied] = useState<string | null>(null)
  const empty = view === 'aim' ? !sessions.length : !recoil.length

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(view === 'aim' ? buildReport(sessions) : buildRecoilReport(recoil))
      setCopied('Copied — paste it into Claude.')
    } catch (err) {
      setCopied(`Could not copy: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <>
      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 rounded-[10px] bg-surface p-1">
          {([['aim', `Pure Aim (${sessions.length})`], ['recoil', `Recoil Control (${recoil.length})`]] as const).map(([v, label]) => (
            <button key={v} onClick={() => { setView(v); setCopied(null) }}
              className={`rounded-md px-3.5 py-2 ${view === v ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {copied && <span className="text-sm text-muted">{copied}</span>}
          <button onClick={copyReport} disabled={empty}
            className="rounded-lg border border-line bg-surface-2 px-4 py-2.5 font-semibold disabled:opacity-50">
            Copy LLM analysis prompt
          </button>
        </div>
      </div>
      <p className="mb-4 text-ink-2">
        Every run is saved to D1. {view === 'aim' ? 'The trend shows on-target accuracy per run.' : 'The trend shows hit rate per run, one section per weapon, range, optic and attachments.'}
      </p>
      {view === 'aim'
        ? <HistoryPage sessions={sessions} order={SCENARIOS.map((s) => s.id)} />
        : <RecoilHistory sessions={recoil} order={WEAPONS.map((w) => w.id)} />}
    </>
  )
}
