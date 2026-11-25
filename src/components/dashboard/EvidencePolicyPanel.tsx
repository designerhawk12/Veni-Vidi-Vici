// src/components/dashboard/EvidencePolicyPanel.tsx
import type { ReturnTypeUseDemoScenario } from '../../pages/pageTypes'

export default function EvidencePolicyPanel({ scenario }: { scenario: ReturnTypeUseDemoScenario }) {
  return (
    <div className="panel evidence-legend">
      <div className="panel-kicker">EVIDENCE POLICY</div>
      <h3>Version-aware by design</h3>
      <p>
        A reply for an earlier fact version cannot close an obligation for the current fact version.
      </p>
      <div className="legend-row"><span className="legend-dot legend-ok" />Accepted for current facts</div>
      <div className="legend-row"><span className="legend-dot legend-no" />Rejected as stale evidence</div>
      <div className="prototype-note">
        {scenario.apiMode
          ? 'Readiness is persistent; no inbound vendor email connector is enabled.'
          : 'This is recorded demo evidence only, not a guarantee of actual event execution.'}
      </div>
    </div>
  )
}
