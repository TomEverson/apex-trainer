import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { SCENARIOS } from '../domain/trainer'
import { HistoryPage, listSessionsFn } from '../domain/sessions'
import { buildReport } from '../domain/analysis'

export const Route = createFileRoute('/_menu/history')({
  loader: async () => ({ sessions: await listSessionsFn() }),
  component: HistoryRoute,
})

function HistoryRoute() {
  const { sessions } = Route.useLoaderData()
  const [copied, setCopied] = useState<string | null>(null)

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(buildReport(sessions))
      setCopied('Copied — paste it into Claude.')
    } catch (err) {
      setCopied(`Could not copy: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <>
      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-ink-2">Every run is saved to D1. The trend shows on-target accuracy per run.</p>
        <div className="flex items-center gap-3">
          {copied && <span className="text-sm text-muted">{copied}</span>}
          <button onClick={copyReport} disabled={!sessions.length}
            className="rounded-lg border border-line bg-surface-2 px-4 py-2.5 font-semibold disabled:opacity-50">
            Copy LLM analysis prompt
          </button>
        </div>
      </div>
      <HistoryPage sessions={sessions} order={SCENARIOS.map((s) => s.id)} />
    </>
  )
}
