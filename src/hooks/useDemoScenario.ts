import { useReducer } from 'react'
import { baseActivity, baseActions, baseEvidence, baseObligations, eventFacts } from '../data/demoData'
import type { ActivityRecord, AgentAction, Approval, EventFacts, EvidenceRecord, Obligation } from '../types/guardian'

type Decision = 'pending' | 'approved' | 'rejected'
interface State { facts: EventFacts; actions: AgentAction[]; approval: Approval | null; decision: Decision; evidence: EvidenceRecord[]; activities: ActivityRecord[] }
type Event = { type: 'stale' | 'approve' | 'reject' | 'send' | 'reset' } | { type: 'reply'; version: 1 | 2; venue: string }
const now = () => new Date().toISOString()
const id = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`
const invitation = (state: State) => state.actions.find((action) => action.id === 'invitation-current')!
const sameParameters = (a: AgentAction['parameters'], b: AgentAction['parameters']) => Boolean(a && b && a.recipient === b.recipient && a.venue === b.venue && a.date === b.date && a.factVersion === b.factVersion && a.channel === b.channel)

function currentAction(action: AgentAction, facts: EventFacts) {
  if (!action.parameters || action.parameters.factVersion !== facts.version || action.parameters.venue !== facts.venue || action.parameters.date !== facts.date) return false
  return action.dependencies.every((dep) => dep.version === facts.version && (dep.fact === 'venue' ? dep.value === facts.venue : dep.fact === 'event_date' ? dep.value === facts.date : dep.fact === 'attendee_list' ? dep.value === action.parameters?.recipient : true))
}

function validApproval(state: State) {
  const action = invitation(state), approval = state.approval
  return Boolean(approval?.state === 'approved' && approval.actionId === action.id && approval.boundVersion === state.facts.version && sameParameters(approval.boundParameters, action.parameters) && currentAction(action, state.facts))
}

function matchingEvidence(obligation: Obligation, evidence: EvidenceRecord[]) {
  return evidence.some((record) => record.obligationId === obligation.id && record.accepted &&
    (!obligation.requiredVersion || record.factVersion === obligation.requiredVersion) &&
    (!obligation.requiredVenue || record.venue === obligation.requiredVenue) &&
    (obligation.id !== 'catering-confirmation' || record.kind === 'counterparty_reply') &&
    (obligation.id !== 'sponsor-receipt-obligation' || record.kind === 'receipt'))
}

function initialState(): State { return {
  facts: { ...eventFacts }, actions: baseActions.map((action) => ({ ...action, dependencies: action.dependencies.map((dep) => ({ ...dep })), parameters: action.parameters && { ...action.parameters } })),
  approval: null, decision: 'pending', evidence: baseEvidence.map((record) => ({ ...record })), activities: baseActivity.map((record) => ({ ...record })),
} }
function log(state: State, title: string, detail: string, tone: ActivityRecord['tone'], code?: string): State {
  return { ...state, activities: [...state.activities, { id: id(), title, detail, tone, code, timestamp: now() }] }
}

function reducer(state: State, event: Event): State {
  if (event.type === 'reset') return initialState()
  if (event.type === 'stale') {
    const old = state.actions.find((action) => action.id === 'invitation-old')!
    const attempt = log(state, 'Fresh agent attempted outdated invitation', `Synthetic agent attempted ${old.parameters?.venue} / V${old.version}.`, 'warning')
    return currentAction(old, state.facts) ? log(attempt, 'Guardian allowed current action', 'Version check passed; no connector is configured.', 'info') :
      log(attempt, 'Guardian blocked stale invitation', 'Simulated connector was not called. The venue dependency is outdated.', 'blocked', `venue_version: ${old.version} ≠ current_version: ${state.facts.version}`)
  }
  if (event.type === 'approve' || event.type === 'reject') {
    const action = invitation(state)
    if (state.decision === 'rejected' || validApproval(state) || !currentAction(action, state.facts) || !action.parameters) return state
    const approved = event.type === 'approve'
    const next: State = { ...state, decision: approved ? 'approved' : 'rejected', approval: { actionId: action.id, state: approved ? 'approved' : 'rejected', boundVersion: state.facts.version, boundParameters: { ...action.parameters }, decidedAt: now() } }
    return log(next, approved ? 'Owner approved corrected invitation' : 'Owner rejected corrected invitation', `${approved ? 'Approval' : 'Rejection'} applies to ${action.parameters.recipient}, ${action.parameters.venue}, ${action.parameters.date}, V${state.facts.version}.`, approved ? 'success' : 'warning')
  }
  if (event.type === 'send') {
    const action = invitation(state), approval = state.approval
    if (state.evidence.some((record) => record.obligationId === 'guest-delivery' && record.kind === 'provider_readback' && record.accepted)) return state
    if (!approval || approval.state !== 'approved' || approval.actionId !== action.id || approval.boundVersion !== state.facts.version || !sameParameters(approval.boundParameters, action.parameters) || !currentAction(action, state.facts))
      return log(state, 'Guardian blocked guarded send', 'Approval, action parameters or current fact versions did not match. Simulated connector was not called.', 'blocked')
    const next: State = { ...state, evidence: [{ id: id(), obligationId: 'guest-delivery', kind: 'provider_readback', title: 'Provider accepted · Simulated', detail: 'Synthetic provider acceptance and readback for the exact approved action. Recipient delivery and vendor confirmation remain unproven.', factVersion: state.facts.version, venue: state.facts.venue, timestamp: now(), accepted: true }, ...state.evidence] }
    return log(log(next, 'Simulated provider accepted action', 'Guard passed for the approved V2 invitation. No real email was sent.', 'info'), 'Simulated provider readback recorded', 'Transport readback is evidence of provider acceptance only; vendor confirmation remains pending.', 'info')
  }
  if (event.type === 'reply') {
    const obligation = baseObligations.find((item) => item.id === 'catering-confirmation')!
    const current = event.version === state.facts.version && event.version === obligation.requiredVersion && event.venue === state.facts.venue && event.venue === obligation.requiredVenue
    if (state.evidence.some((record) => record.obligationId === obligation.id && record.factVersion === event.version && record.venue === event.venue && record.kind === (current ? 'counterparty_reply' : 'late_reply'))) return state
    const next: State = { ...state, evidence: [{ id: id(), obligationId: obligation.id, kind: current ? 'counterparty_reply' : 'late_reply', title: current ? 'Synthetic vendor reply verified' : 'Late reply for Venue A · Not applied', detail: current ? `Reply matches ${event.venue} / V${event.version}; current catering obligation closed.` : `Reply references ${event.venue} / V${event.version} and cannot close ${state.facts.venue} / V${state.facts.version}.`, factVersion: event.version, venue: event.venue, timestamp: now(), accepted: current }, ...state.evidence] }
    const recorded = log(next, current ? 'Vendor confirmation received · Simulated' : 'Late vendor reply rejected', current ? `Synthetic reply references ${event.venue} / V${event.version}.` : `Reply for ${event.venue} / V${event.version} does not match current facts.`, current ? 'success' : 'blocked', current ? undefined : `reply_version: ${event.version} ≠ required_version: ${obligation.requiredVersion}`)
    return current ? log(recorded, 'Current catering evidence verified', `Version and venue match ${state.facts.venue} / V${state.facts.version}; obligation closed.`, 'success') : recorded
  }
  return state
}

export function useDemoScenario() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const vendorConfirmed = matchingEvidence(baseObligations.find((item) => item.id === 'catering-confirmation')!, state.evidence)
  const providerAccepted = state.evidence.some((record) => record.obligationId === 'guest-delivery' && record.kind === 'provider_readback' && record.accepted && record.venue === state.facts.venue && record.factVersion === state.facts.version)
  const lateReplyAdded = state.evidence.some((record) => record.kind === 'late_reply')
  const decision: Decision = state.decision === 'approved' && !validApproval(state) ? 'pending' : state.decision
  const actions = state.actions.map((action): AgentAction => {
    if (action.id === 'invitation-current') return { ...action, status: providerAccepted ? 'provider_accepted' : decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'awaiting_approval', approvalState: decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'awaiting_owner', reason: providerAccepted ? 'Guarded send passed; simulated provider acceptance and readback are recorded. Recipient delivery is not confirmed.' : decision === 'approved' ? 'Owner approved the exact current-version proposal; guarded simulation is available.' : decision === 'rejected' ? 'Owner rejected the corrected proposal; guarded simulation is unavailable.' : action.reason }
    if (action.id === 'catering' && vendorConfirmed) return { ...action, status: 'confirmed', version: state.facts.version, dependencies: [{ fact: 'venue', version: state.facts.version, value: state.facts.venue }], reason: 'Synthetic vendor confirmation matches Venue B / V2 and the current obligation is closed.' }
    return action
  })
  const obligations = baseObligations.map((obligation): Obligation => ({ ...obligation, status: obligation.id === 'guest-delivery' ? providerAccepted ? 'provider_accepted' : 'pending' : matchingEvidence(obligation, state.evidence) ? obligation.id === 'sponsor-receipt-obligation' ? 'verified' : 'confirmed' : obligation.id === 'catering-confirmation' ? 'awaiting_confirmation' : 'pending' }))
  const mandatory = obligations.filter((item) => item.mandatoryForReadiness)
  const openObligations = mandatory.filter((item) => !matchingEvidence(item, state.evidence)).length
  return { facts: state.facts, actions, approval: state.approval && decision !== 'pending' ? state.approval : { actionId: invitation(state).id, state: 'awaiting_owner' as const, boundVersion: state.facts.version, boundParameters: { ...invitation(state).parameters! } }, obligations, evidence: state.evidence, activities: state.activities, decision, providerAccepted, vendorConfirmed, lateReplyAdded, readinessReady: mandatory.length > 0 && openObligations === 0, openObligations,
    affectedActions: actions.filter((action) => action.status === 'stale' || action.status === 'reconfirmation_required' || action.id === 'catering' && action.status === 'confirmed').length,
    unaffectedActions: actions.filter((action) => action.status === 'valid').length,
    simulateStaleAttempt: () => dispatch({ type: 'stale' }), approveInvitation: () => dispatch({ type: 'approve' }), rejectInvitation: () => dispatch({ type: 'reject' }), simulateGuardedSend: () => dispatch({ type: 'send' }),
    simulateCurrentVendorReply: () => dispatch({ type: 'reply', version: state.facts.version, venue: state.facts.venue }), simulateLateVendorReply: () => dispatch({ type: 'reply', version: state.facts.previousVersion, venue: state.facts.previousVenue }), resetDemo: () => dispatch({ type: 'reset' }) }
}
