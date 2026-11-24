import { Activity, Bot, CircleAlert, ShieldAlert, Zap } from 'lucide-react'
import type { ActivityRecord } from '../../types/guardian'
import StatusBadge from './StatusBadge'

export default function AgentActivity({ activities, onSimulate }: { activities: ActivityRecord[]; onSimulate: () => void }) {
  const latestBlock = [...activities].reverse().find((item) => item.tone === 'blocked' && item.code?.includes('venue_version'))
  return <section className="panel agent-panel">
    <div className="panel-heading"><div><div className="panel-kicker">GUARDIAN CONTROL</div><h2>Agent activity</h2></div><div className="agent-icon"><Activity size={17} /></div></div>
    <div className="agent-name-row"><span className="agent-avatar"><Bot size={16} /></span><div><strong>Fresh Invitation Agent</strong><span>Session · Synthetic</span></div><span className="live-indicator"><span /> monitored</span></div>
    <div className="agent-flow">
      <div className="agent-flow-step"><span className="flow-mark flow-warn"><CircleAlert size={14} /></span><span>A new agent session attempted to send an invitation using Venue A.</span></div>
      <div className="agent-flow-step"><span className="flow-mark flow-blue"><Zap size={14} /></span><span>Guardian checked the current event facts.</span></div>
      <div className="agent-flow-step"><span className="flow-mark flow-red"><ShieldAlert size={14} /></span><span>The action was blocked because its venue version was outdated.</span></div>
    </div>
    <div className="blocked-proof"><div className="blocked-proof-head"><StatusBadge status="blocked_by_guardian" compact /><span>NO EXECUTION</span></div><code>{latestBlock?.code ?? 'venue_version: 1 ≠ current_version: 2'}</code><small>{latestBlock ? 'Latest simulated control result' : 'Current event facts are V2'}</small></div>
    <button className="button button-outline button-full" onClick={onSimulate}><Zap size={14} />Simulate Stale Action Attempt</button>
    <div className="sim-note">Simulation only · no agent or external service is connected</div>
  </section>
}
