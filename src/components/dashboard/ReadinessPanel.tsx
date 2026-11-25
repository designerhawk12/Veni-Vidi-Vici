// src/components/dashboard/ReadinessPanel.tsx
import { Check, Circle } from 'lucide-react'
import StatusBadge from './StatusBadge'
import type { ReturnTypeUseDemoScenario } from '../../pages/pageTypes'

export default function ReadinessPanel({ scenario }: { scenario: ReturnTypeUseDemoScenario }) {
  const { readinessReady, providerAccepted, vendorConfirmed, openObligations, apiMode, claimRecorded, facts } = scenario

  const items = [
    {
      title: apiMode ? 'Execution claim recorded' : 'Action attempted',
      done: apiMode ? claimRecorded : true,
      detail: apiMode ? (claimRecorded ? 'Authorization persisted.' : 'No claim recorded.') : 'Guarded action reviewed.',
    },
    {
      title: 'Provider accepted',
      done: providerAccepted,
      detail: providerAccepted ? 'Demo provider readback recorded.' : 'No provider readback.',
    },
    {
      title: 'Counterparty confirmed',
      done: vendorConfirmed,
      detail: vendorConfirmed ? `Vendor reply matches V${facts.version}.` : 'Vendor confirmation pending.',
    },
    {
      title: 'Current evidence verified',
      done: vendorConfirmed,
      detail: vendorConfirmed ? `Evidence matches V${facts.version}.` : 'Waiting for current‑version evidence.',
    },
  ]

  return (
    <section className="panel readiness-panel">
      <div className="panel-heading">
        <div>
          <div className="panel-kicker">EVENT READINESS</div>
          <h2>
            {readinessReady ? `Ready — V${facts.version}` : `Not ready (${openObligations} open)`}
          </h2>
        </div>
        <StatusBadge
          status={readinessReady ? 'ready' : 'not_ready'}
          label={readinessReady ? 'Ready' : 'Not ready'}
        />
      </div>
      <ul className="readiness-checklist">
        {items.map((it) => (
          <li key={it.title} className={`readiness-check-item ${it.done ? 'check-done' : 'check-pending'}`}>
            <span className="check-icon">
              {it.done ? <Check size={12} /> : <Circle size={10} />}
            </span>
            <span className="check-body">
              <strong>{it.title}</strong>
              <span className="check-detail">{it.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {!readinessReady && (
        <div className="readiness-disclaimer">
          {apiMode
            ? 'Readiness is computed from persisted evidence.'
            : 'Demo evidence only; not a guarantee of actual execution.'}
        </div>
      )}
    </section>
  )
}
