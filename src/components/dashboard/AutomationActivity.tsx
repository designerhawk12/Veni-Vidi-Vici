import { Activity, Zap, CircleAlert, ShieldAlert } from 'lucide-react'
import type { ActivityRecord } from '../../types/guardian'
import StatusBadge from './StatusBadge'

export default function AutomationActivity({ activities, onSimulate }: { activities: ActivityRecord[]; onSimulate: () => void }) {
  const latestBlock = [...activities].reverse().find((item) => item.tone === 'blocked' && item.code?.includes('venue_version'))
  return <section className="panel agent-panel">
    <div className="panel-heading"><div><div className="panel-kicker">VERSION CONTROL</div><h2>Automation activity</h2></div><div className="agent-icon"><Activity size={17} /></div></div>
    <div className="agent-name-row"><span className="agent-avatar"><Zap size={16} /></span><div><strong>Fresh Invitation Service</strong><span>Session · Demo</span></div><span className="live-indicator"><span /> monitored</span></div>
    <div className="agent-flow">
      <div className="agent-flow-step"><span className="flow-mark flow-warn"><CircleAlert size={14} /></span><span>A new automation session attempted to send an invitation using Venue A.</span></div>
      <div className="agent-flow-step"><span className="flow-mark flow-blue"><Zap size={14} /></span><span>Version control checked the current event facts.</span></div>
      <div className="agent-flow-step"><span className="flow-mark flow-red"><ShieldAlert size={14} /></span><span>The action was blocked because its venue version was outdated.</span></div>
    </div>
    <div className="blocked-proof"><div className="blocked-proof-head"><StatusBadge status="blocked_by_version_control" compact /><span>NO EXECUTION</span></div><code>{latestBlock?.code ?? 'venue_version: 1 ≠ current_version: 2'}</code><small>{latestBlock ? 'Latest version control result' : 'Current event facts are V2'}</small></div>
    <button className="button button-outline button-full" onClick={onSimulate}><Zap size={14} />Simulate Outdated Action Attempt</button>
    <div className="sim-note">demo only · no automation or external service is connected</div>
  </section>
}
