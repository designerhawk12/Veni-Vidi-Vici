import { useReducer } from 'react'
import { baseActivity, baseActions, baseEvidence, baseObligations, eventFacts } from '../data/demoData'
import type { ActivityRecord, AgentAction, Approval, EventFacts, EvidenceRecord, Obligation, ReviewDisposition } from '../types/guardian'
import { useGuardianBackend } from './useGuardianBackend'

type Decision = 'pending' | 'approved' | 'rejected'
interface State { facts: EventFacts; actions: AgentAction[]; approval: Approval | null; decision: Decision; evidence: EvidenceRecord[]; activities: ActivityRecord[]; pauseAutomationOn: boolean; rejectionReason: string }
type Event = { type: 'stale' | 'approve' | 'send' | 'reset' } | { type: 'reject'; reason: string } | { type: 'reply'; version: number; venue: string } | { type: 'pause-automation'; enabled: boolean } | { type: 'review-disposition'; disposition: ReviewDisposition; reason: string }
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
  approval: null, decision: 'pending', evidence: baseEvidence.map((record) => ({ ...record })), activities: baseActivity.map((record) => ({ ...record })), pauseAutomationOn: false, rejectionReason: '',
} }
function log(state: State, title: string, detail: string, tone: ActivityRecord['tone'], code?: string): State {
  return { ...state, activities: [...state.activities, { id: id(), title, detail, tone, code, timestamp: now() }] }
}

function reducer(state: State, event: Event): State {
  if (event.type === 'reset') return initialState()
  if (event.type === 'pause-automation') {
    const updated = { ...state, pauseAutomationOn: event.enabled }
    return log(updated, event.enabled ? 'Pause automation engaged' : 'Pause automation released', 'Auto-send state changed in the browser demo; no connector is configured.', event.enabled ? 'blocked' : 'info')
  }
  if (event.type === 'review-disposition') {
    const detail = event.reason.trim() ? `${event.disposition.replaceAll('_', ' ')}. Reason: ${event.reason.trim()}` : event.disposition.replaceAll('_', ' ')
    return log(state, 'Organizer recorded review disposition', `${detail}. Review is for reference and does not authorize an action.`, 'info')
  }
  if (event.type === 'stale') {
    const old = state.actions.find((action) => action.id === 'invitation-old')!
    const attempt = log(state, 'Automation attempted outdated invitation', `Demo automation attempted ${old.parameters?.venue} / V${old.version}.`, 'warning')
    return currentAction(old, state.facts) ? log(attempt, 'Version control allowed current action', 'Version check passed; no connector is configured.', 'info') :
      log(attempt, 'Version control blocked stale invitation', 'Demo connector was not called. The venue dependency is outdated.', 'blocked', `venue_version: ${old.version} ≠ current_version: ${state.facts.version}`)
  }
  if (event.type === 'approve' || event.type === 'reject') {
    const action = invitation(state)
    if (state.decision === 'rejected' || validApproval(state) || !currentAction(action, state.facts) || !action.parameters) return state
    const approved = event.type === 'approve'
    const rejectionReason = event.type === 'reject' ? event.reason.trim() : ''
    if (event.type === 'reject' && !rejectionReason) return state
    const next: State = { ...state, decision: approved ? 'approved' : 'rejected', rejectionReason, approval: { actionId: action.id, state: approved ? 'approved' : 'rejected', boundVersion: state.facts.version, boundParameters: { ...action.parameters }, decidedAt: now() } }
    const detail = `${approved ? 'Approval' : 'Rejection'} applies to ${action.parameters.recipient}, ${action.parameters.venue}, ${action.parameters.date}, V${state.facts.version}.${approved ? '' : ` Reason: ${rejectionReason}`}`
    return log(next, approved ? 'Organizer approved corrected invitation' : 'Organizer rejected corrected invitation', detail, approved ? 'success' : 'warning')
  }
  if (event.type === 'send') {
    const action = invitation(state), approval = state.approval
    if (state.pauseAutomationOn) return log(state, 'Version control blocked guarded send', 'The pause automation is engaged. No demo claim was recorded.', 'blocked', 'PAUSE_AUTOMATION_ON')
    if (state.evidence.some((record) => record.obligationId === 'guest-delivery' && record.kind === 'provider_readback' && record.accepted)) return state
    if (!approval || approval.state !== 'approved' || approval.actionId !== action.id || approval.boundVersion !== state.facts.version || !sameParameters(approval.boundParameters, action.parameters) || !currentAction(action, state.facts))
      return log(state, 'Version control blocked guarded send', 'Approval, action parameters or current fact versions did not match. Demo connector was not called.', 'blocked')
    const next: State = { ...state, evidence: [{ id: id(), obligationId: 'guest-delivery', kind: 'provider_readback', title: 'Provider accepted · Simulated', detail: 'Demo provider acceptance and readback for the exact approved action. Recipient delivery and vendor confirmation remain unproven.', factVersion: state.facts.version, venue: state.facts.venue, timestamp: now(), accepted: true }, ...state.evidence] }
    return log(log(next, 'Demo provider accepted action', 'Guard passed for the approved V2 invitation. No actual email was sent.', 'info'), 'Demo provider readback recorded', 'Transport readback is evidence of provider acceptance only; vendor confirmation remains pending.', 'info')
  }
  if (event.type === 'reply') {
    const obligation = baseObligations.find((item) => item.id === 'catering-confirmation')!
    const current = event.version === state.facts.version && event.version === obligation.requiredVersion && event.venue === state.facts.venue && event.venue === obligation.requiredVenue
    if (state.evidence.some((record) => record.obligationId === obligation.id && record.factVersion === event.version && record.venue === event.venue && record.kind === (current ? 'counterparty_reply' : 'late_reply'))) return state
    const next: State = { ...state, evidence: [{ id: id(), obligationId: obligation.id, kind: current ? 'counterparty_reply' : 'late_reply', title: current ? 'Demo vendor reply verified' : 'Late reply for Venue A · Not applied', detail: current ? `Reply matches ${event.venue} / V${event.version}; current catering obligation closed.` : `Reply references ${event.venue} / V${event.version} and cannot close ${state.facts.venue} / V${state.facts.version}.`, factVersion: event.version, venue: event.venue, timestamp: now(), accepted: current }, ...state.evidence] }
    const recorded = log(next, current ? 'Vendor confirmation received · Demo' : 'Late vendor reply rejected', current ? `Demo reply references ${event.venue} / V${event.version}.` : `Reply for ${event.venue} / V${event.version} does not match current facts.`, current ? 'success' : 'blocked', current ? undefined : `reply_version: ${event.version} ≠ required_version: ${obligation.requiredVersion}`)
    return current ? log(recorded, 'Current catering evidence verified', `Version and venue match ${state.facts.venue} / V${state.facts.version}; obligation closed.`, 'success') : recorded
  }
  return state
}

export function useDemoScenario() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const backend = useGuardianBackend()
  const vendorConfirmed = matchingEvidence(baseObligations.find((item) => item.id === 'catering-confirmation')!, state.evidence)
  const providerAccepted = state.evidence.some((record) => record.obligationId === 'guest-delivery' && record.kind === 'provider_readback' && record.accepted && record.venue === state.facts.venue && record.factVersion === state.facts.version)
  const lateReplyAdded = state.evidence.some((record) => record.kind === 'late_reply')
  const decision: Decision = state.decision === 'approved' && !validApproval(state) ? 'pending' : state.decision
  const actions = state.actions.map((action): AgentAction => {
    if (action.id === 'invitation-current') return { ...action, status: providerAccepted ? 'provider_accepted' : decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'awaiting_approval', approvalState: decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'awaiting_organizer', reason: providerAccepted ? 'Guarded send passed; demo provider acceptance and readback are recorded. Recipient delivery is not confirmed.' : decision === 'approved' ? 'Organizer approved the exact current-version proposal; guarded demo is available.' : decision === 'rejected' ? `Organizer rejected the corrected proposal. Reason: ${state.rejectionReason}` : action.reason }
    if (action.id === 'catering' && vendorConfirmed) return { ...action, status: 'confirmed', version: state.facts.version, dependencies: [{ fact: 'venue', version: state.facts.version, value: state.facts.venue }], reason: 'Demo vendor confirmation matches Venue B / V2 and the current obligation is closed.' }
    return action
  })
  const obligations = baseObligations.map((obligation): Obligation => ({ ...obligation, status: obligation.id === 'guest-delivery' ? providerAccepted ? 'provider_accepted' : 'pending' : matchingEvidence(obligation, state.evidence) ? obligation.id === 'sponsor-receipt-obligation' ? 'verified' : 'confirmed' : obligation.id === 'catering-confirmation' ? 'awaiting_confirmation' : 'pending' }))
  const mandatory = obligations.filter((item) => item.mandatoryForReadiness)
  const openObligations = mandatory.filter((item) => !matchingEvidence(item, state.evidence)).length
  const localScenario = { facts: state.facts, actions, approval: state.approval && decision !== 'pending' ? state.approval : { actionId: invitation(state).id, state: 'awaiting_organizer' as const, boundVersion: state.facts.version, boundParameters: { ...invitation(state).parameters! } }, obligations, evidence: state.evidence, activities: state.activities, decision, providerAccepted, vendorConfirmed, lateReplyAdded, readinessReady: mandatory.length > 0 && openObligations === 0, openObligations, pauseAutomationOn: state.pauseAutomationOn, rejectionReason: state.rejectionReason,
    affectedActions: actions.filter((action) => action.status === 'stale' || action.status === 'reconfirmation_required').length,
    unaffectedActions: actions.filter((action) => action.status === 'valid').length,
    simulateStaleAttempt: () => dispatch({ type: 'stale' }), approveInvitation: () => dispatch({ type: 'approve' }), rejectInvitation: (reason: string) => dispatch({ type: 'reject', reason }), simulateGuardedSend: () => dispatch({ type: 'send' }), setPauseAutomation: (enabled: boolean) => dispatch({ type: 'pause-automation', enabled }),
    simulateCurrentVendorReply: () => dispatch({ type: 'reply', version: state.facts.version, venue: state.facts.venue }), simulateLateVendorReply: () => dispatch({ type: 'reply', version: state.facts.previousVersion, venue: state.facts.previousVenue }), recordReviewDisposition: (disposition: ReviewDisposition, reason: string) => dispatch({ type: 'review-disposition', disposition, reason }), resetDemo: () => dispatch({ type: 'reset' }) }
  if (!backend.enabled) return {
    ...localScenario,
    apiMode: false as const,
    apiReady: false,
    apiLoading: false,
    apiBusy: false,
    apiError: '',
    claimRecorded: false,
    isWorkspaceEmpty: false,
    rawFacts: [] as { id: string; version: number; value: unknown }[],
    ownerReviewTasks: [] as { id: string; obligation_id: string | null; reason_code: string; created_at: string }[],
    openCorrelationToken: null as string | null,
    reviewDispositions: [] as { id: string; disposition: ReviewDisposition; reason: string; recorded_by: string; created_at: string }[],
    reviewData: null as import('../lib/guardianApi').ApiReview | null,
    factProposals: [] as import('../lib/guardianApi').ApiFactProposal[],
    outboundMessages: [] as import('../lib/guardianApi').ApiOutboundMessage[],
    changeFact: async (_factId: string, _value: unknown) => undefined,
    changeVenue: async (_venue: string) => undefined,
    createAction: async (_type: string, _params: Record<string, unknown>, _required?: boolean, _role?: 'invitations' | 'catering') => undefined,
    approveAction: async (_actionId: string, _revision: number) => undefined,
    rejectAction: async (_actionId: string, _revision: number, _reason: string) => undefined,
    claimAction: async (_actionId: string, _revision: number, _role?: 'invitations' | 'catering') => undefined,
    resolveReviewTask: async (_taskId: string) => undefined,
    setupWorkspace: async (_payload: {
      name: string
      venue: string
      event_start: string
      headcount: number
      budget_cap: number
      vendor_name?: string
    }) => undefined,
    clearWorkspace: async () => undefined,
    renameWorkspace: async (_name: string) => undefined,
    createFact: async (_id: string, _value: unknown) => undefined,
    createObligation: async (_payload: { name: string; fact_id: string; vendor_name: string; vendor_email: string }) => undefined,
    resolveFactProposal: async (_proposalId: string, _accept: boolean) => undefined,
    dispatchAction: async (_actionId: string, _revision: number, _simulateTimeout?: boolean) => undefined,
    reconcileOutbound: async (_messageId: string, _found: boolean) => undefined,
  }

  const backendFacts = backend.facts ?? state.facts
  const backendActions = backend.facts ? backend.actions : localScenario.actions
  const backendEvidence = backend.facts ? backend.evidence : localScenario.evidence
  const backendObligations = backend.facts ? backend.obligations : localScenario.obligations
  const backendDecision = backend.facts ? backend.decision : localScenario.decision
  const backendVendorConfirmed = backend.facts ? backend.vendorConfirmed : localScenario.vendorConfirmed
  const backendActivities = backend.facts ? backend.activities : localScenario.activities
  const backendApprovalAction = backendActions.find((action) => action.id === 'invitation-current')
  const backendApproval: Approval = backendApprovalAction && (backendApprovalAction.status === 'approved' || backendApprovalAction.status === 'claimed')
    ? {
      actionId: backendApprovalAction.id,
      state: 'approved',
      boundVersion: backendApprovalAction.parameters?.factVersion ?? backendFacts.version,
      boundParameters: backendApprovalAction.parameters!,
    }
    : {
      actionId: backendApprovalAction?.id ?? 'invitation-current',
      state: backendDecision === 'rejected' ? 'rejected' : 'awaiting_organizer',
      boundVersion: backendFacts.version,
      boundParameters: backendApprovalAction?.parameters ?? { recipient: 'guest@example.test', venue: backendFacts.venue, date: backendFacts.date, factVersion: backendFacts.version, channel: 'No connector configured' },
    }
  const claimInvitation = backend.claimInvitation
  return {
    ...localScenario,
    facts: backendFacts,
    actions: backendActions,
    approval: backendApproval,
    obligations: backendObligations,
    evidence: backendEvidence,
    activities: backendActivities,
    decision: backendDecision,
    providerAccepted: false,
    vendorConfirmed: backendVendorConfirmed,
    lateReplyAdded: backendEvidence.some((record) => record.kind === 'late_reply'),
    readinessReady: backend.readinessReady,
    openObligations: backend.openObligations,
    pauseAutomationOn: backend.pauseAutomationOn,
    affectedActions: backend.affectedActions,
    unaffectedActions: backend.unaffectedActions,
    rejectionReason: backendApprovalAction?.reason ?? '',
    simulateStaleAttempt: () => undefined,
    approveInvitation: backend.approveInvitation,
    rejectInvitation: backend.rejectInvitation,
    simulateGuardedSend: claimInvitation,
    setPauseAutomation: backend.setPauseAutomation,
    simulateCurrentVendorReply: () => undefined,
    simulateLateVendorReply: () => undefined,
    recordReviewDisposition: backend.recordReviewDisposition,
    resetDemo: backend.refresh,
    apiMode: true as const,
    apiReady: backend.facts !== null,
    apiLoading: backend.loading,
    apiBusy: backend.busy,
    apiError: backend.error,
    claimRecorded: backend.claimRecorded,
    isWorkspaceEmpty: backend.isWorkspaceEmpty,
    rawFacts: backend.rawFacts,
    ownerReviewTasks: backend.ownerReviewTasks,
    openCorrelationToken: backend.openCorrelationToken,
    reviewDispositions: backend.reviewDispositions,
    reviewData: backend.reviewData,
    factProposals: backend.factProposals,
    outboundMessages: backend.outboundMessages,
    changeFact: backend.changeFact,
    changeVenue: backend.changeVenue,
    createAction: backend.createAction,
    approveAction: backend.approveAction,
    rejectAction: backend.rejectAction,
    claimAction: backend.claimAction,
    resolveReviewTask: backend.resolveReviewTask,
    setupWorkspace: backend.setupWorkspace,
    clearWorkspace: backend.clearWorkspace,
    renameWorkspace: backend.renameWorkspace,
    createFact: backend.createFact,
    createObligation: backend.createObligation,
    resolveFactProposal: backend.resolveFactProposal,
    dispatchAction: backend.dispatchAction,
    reconcileOutbound: backend.reconcileOutbound,
  }
}
