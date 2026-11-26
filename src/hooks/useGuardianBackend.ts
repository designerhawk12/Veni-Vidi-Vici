import { useCallback, useEffect, useMemo, useState } from 'react'
import { guardianApi, type ApiAction, type ApiAuditItem, type ApiReadiness, type ApiReview, type ApiState } from '../lib/guardianApi'
import type { ActivityRecord, AgentAction, EventFacts, EvidenceRecord, Obligation, ReviewDisposition } from '../types/guardian'

interface Snapshot {
  state: ApiState
  readiness: ApiReadiness
  audit: ApiAuditItem[]
  review: ApiReview
}

const asString = (value: unknown, fallback: string) => typeof value === 'string' ? value : fallback
const asNumber = (value: unknown, fallback: number) => typeof value === 'number' ? value : fallback

function displayDate(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function historyFact(snapshot: Snapshot, id: string, version: number) {
  return snapshot.state.fact_history.find((fact) => fact.id === id && fact.version === version)
}

function toEventFacts(snapshot: Snapshot): EventFacts {
  const venue = snapshot.state.facts.find((fact) => fact.id === 'venue.address')
  const start = snapshot.state.facts.find((fact) => fact.id === 'event.start')
  const headcount = snapshot.state.facts.find((fact) => fact.id === 'headcount')
  const sponsor = snapshot.state.facts.find((fact) => fact.id === 'sponsor.amount')
  const venueHistory = snapshot.state.fact_history
    .filter((fact) => fact.id === 'venue.address' && fact.version < (venue?.version ?? 1))
    .sort((a, b) => b.version - a.version)
  const previous = venueHistory[0]
  return {
    name: snapshot.state.workspace_name || (snapshot.state.facts.length === 0 ? 'New Workspace' : 'Event Workspace'),
    date: displayDate(start?.value, ''),
    attendees: asNumber(headcount?.value, 0),
    budgetCap: asNumber(sponsor?.value, 0),
    venue: asString(venue?.value, ''),
    version: venue?.version ?? 1,
    previousVenue: asString(previous?.value, asString(venue?.value, '')),
    previousVersion: previous?.version ?? (venue?.version ?? 1),
  }
}

function mapStatus(action: ApiAction): AgentAction['status'] {
  if (action.claim_status === 'claimed') return 'claimed'
  switch (action.status) {
    case 'stale': return 'stale'
    case 'approved': return 'approved'
    case 'rejected': return 'rejected'
    case 'provider_accepted': return 'provider_accepted'
    case 'confirmed': return 'confirmed'
    default: return 'awaiting_approval'
  }
}

function hasCurrentDependencies(action: ApiAction, state: ApiState) {
  return action.dependencies.every((dependency) => {
    const currentVersion = state.facts.find((item) => item.id === dependency.fact)?.version
    return currentVersion === dependency.version
  })
}

function mapAction(action: ApiAction, snapshot: Snapshot, facts: EventFacts, isInvitation: boolean): AgentAction {
  const parameters = action.parameters
  const venueDependency = action.dependencies.find((dependency) => dependency.fact === 'venue.address')
  const venueVersion = venueDependency?.version ?? facts.version
  const venueFact = historyFact(snapshot, 'venue.address', venueVersion)
  const rawRecipient = parameters.recipient
  const recipients = parameters.recipients
  const recipient = asString(
    rawRecipient,
    Array.isArray(recipients) && recipients.length > 0
      ? asString(recipients[0], 'Allowlisted test recipient')
      : 'Allowlisted test recipient',
  )
  const rawDate = parameters.event_date ?? parameters.event_start
  const dependencies = action.dependencies.map((dependency) => {
    const fact = historyFact(snapshot, dependency.fact, dependency.version)
    const value = dependency.fact === 'venue.address'
      ? asString(fact?.value, facts.venue)
      : dependency.fact === 'event.start'
        ? displayDate(fact?.value, facts.date)
        : dependency.fact === 'guest_list.version'
          ? `${facts.attendees} registered attendees`
          : String(fact?.value ?? `version ${dependency.version}`)
    const factName = dependency.fact === 'venue.address' ? 'venue' : dependency.fact === 'event.start' ? 'event_date' : dependency.fact
    const currentVersion = snapshot.state.facts.find((item) => item.id === dependency.fact)?.version
    return { fact: factName, version: dependency.version, value, current: currentVersion === dependency.version }
  })
  const status = mapStatus(action)
  const approvalState = status === 'approved' || status === 'claimed'
    ? 'approved'
    : status === 'rejected'
      ? 'rejected'
      : status === 'stale'
        ? 'invalidated'
        : 'awaiting_organizer'
  return {
    id: isInvitation ? 'invitation-current' : action.id,
    backendActionId: action.id,
    revision: action.revision,
    name: isInvitation ? `Guest Invitation · ${asString(parameters.venue, facts.venue)}` : action.type.replaceAll('_', ' '),
    agent: action.proposed_by === 'invitations-agent' ? 'Invitation Service' : 'Catering Coordination Service',
    status,
    dependencies,
    version: venueVersion,
    approvalState,
    reason: action.stale_reason ?? (status === 'claimed'
      ? 'Authorization was recorded by the backend; no connector is configured and nothing was sent.'
      : status === 'rejected'
        ? 'The organizer rejected this exact revision.'
        : status === 'approved'
          ? 'The organizer approved this exact revision against its recorded fact dependencies.'
          : 'Persisted action from the Guardian API.'),
    parameters: {
      recipient,
      venue: asString(parameters.venue, asString(venueFact?.value, facts.venue)),
      date: displayDate(rawDate, facts.date),
      factVersion: venueVersion,
      channel: 'No connector configured',
    },
  }
}

function mapEvidence(snapshot: Snapshot): EvidenceRecord[] {
  return snapshot.readiness.evidence.map((evidence) => {
    const obligation = snapshot.readiness.obligations.find((item) => item.id === evidence.obligation_id)
    const fact = historyFact(snapshot, obligation?.required_fact.id ?? 'venue.address', evidence.fact_version)
    return {
      id: evidence.id,
      obligationId: evidence.obligation_id,
      kind: evidence.reason_code === 'STALE_CORRELATION_TOKEN' ? 'late_reply' : 'counterparty_reply',
      title: evidence.accepted ? 'Vendor confirmation verified' : 'Vendor reply not accepted',
      detail: evidence.accepted
        ? `Expected vendor confirmed current event facts V${evidence.fact_version}.`
        : `Reply did not close the obligation${evidence.reason_code ? ` (${evidence.reason_code})` : ''}.`,
      factVersion: evidence.fact_version,
      venue: asString(fact?.value, ''),
      timestamp: evidence.received_at,
      accepted: evidence.accepted,
    }
  })
}

function mapActivities(items: ApiAuditItem[]): ActivityRecord[] {
  return items.map((item) => {
    const title = item.event.replaceAll('_', ' ')
    const tone: ActivityRecord['tone'] =
      item.event.includes('denial') || item.event.includes('rejected') || item.event.includes('routed')
        ? 'warning'
        : item.event === 'approval' || item.event === 'vendor_reply_recorded'
          ? 'success'
          : item.event === 'fact_change'
            ? 'warning'
            : 'info'
    return {
      id: String(item.seq),
      title: title.charAt(0).toUpperCase() + title.slice(1),
      detail: Object.entries(item.payload)
        .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join(' · ') || 'Recorded event',
      timestamp: item.timestamp,
      tone,
      code: item.actor,
    }
  })
}

export function useGuardianBackend() {
  const enabled = __GUARDIAN_API_ENABLED__
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!enabled) return
    setError('')
    const [state, readiness, audit, review] = await Promise.all([
      guardianApi.state(),
      guardianApi.readiness(),
      guardianApi.audit(),
      guardianApi.review(),
    ])
    setSnapshot({ state, readiness, audit: audit.items, review })
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    let active = true
    setLoading(true)
    void Promise.all([guardianApi.state(), guardianApi.readiness(), guardianApi.audit(), guardianApi.review()])
      .then(([state, readiness, audit, review]) => {
        if (active) setSnapshot({ state, readiness, audit: audit.items, review })
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to connect to the Guardian API.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const events = new EventSource('/api/events?since=0')
    const handleStateChange = () => {
      void refresh()
    }
    events.addEventListener('state-change', handleStateChange)
    events.onerror = () => {
      // The dashboard remains usable through explicit refresh and API mutations.
    }
    return () => events.close()
  }, [enabled, refresh])

  const mutate = useCallback(async (operation: () => Promise<unknown>) => {
    if (!enabled) return false
    setBusy(true)
    setError('')
    try {
      await operation()
      await refresh()
      return true
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Guardian API operation failed.'
      try {
        await refresh()
      } catch (refreshCause) {
        const refreshMessage = refreshCause instanceof Error ? refreshCause.message : 'The backend state could not be refreshed.'
        setError(`${message} ${refreshMessage}`)
        return false
      }
      setError(message)
      return false
    } finally {
      setBusy(false)
    }
  }, [enabled, refresh])

  const facts = useMemo(() => snapshot ? toEventFacts(snapshot) : null, [snapshot])
  const actions = useMemo(() => {
    if (!snapshot || !facts) return []
    const mapped = snapshot.state.actions.map((action) => {
      const currentDeps = hasCurrentDependencies(action, snapshot.state)
      const isCurrentInvitation = action.type === 'send_invitation_batch' && action.status !== 'stale' && currentDeps
      const item = mapAction(action, snapshot, facts, isCurrentInvitation)
      if (!currentDeps && item.status !== 'stale') {
        return { ...item, status: 'stale' as const, approvalState: 'invalidated' as const, reason: 'Bound fact version is no longer current.' }
      }
      return item
    })
    return mapped
  }, [facts, snapshot])
  const evidence = useMemo(() => snapshot ? mapEvidence(snapshot) : [], [snapshot])
  const obligations = useMemo<Obligation[]>(() => snapshot
    ? snapshot.readiness.obligations.map((obligation) => ({
      id: obligation.id,
      name: obligation.name,
      status: obligation.status === 'confirmed' ? 'confirmed' : 'awaiting_confirmation',
      requiredVersion: obligation.required_fact.version,
      requiredVenue: asString(obligation.required_fact.value, ''),
      mandatoryForReadiness: obligation.required,
      description: `Confirmation from ${obligation.vendor.name} must match ${asString(obligation.required_fact.value, 'the current event fact')} / V${obligation.required_fact.version}.`,
    }))
    : [], [snapshot])
  const activities = useMemo(() => snapshot ? mapActivities(snapshot.audit) : [], [snapshot])
  const invitationAction = actions.find((action) => action.id === 'invitation-current')
  const apiAction = invitationAction?.backendActionId
    ? snapshot?.state.actions.find((action) => action.id === invitationAction.backendActionId)
    : undefined
  const vendorConfirmed = obligations.some((obligation) => obligation.id === 'catering-confirmation' && obligation.status === 'confirmed')
  const openObligations = (snapshot?.readiness.open_obligations.length ?? 0) + (snapshot?.readiness.pending_required_actions.length ?? 0)
  const decision: 'pending' | 'approved' | 'rejected' = invitationAction?.status === 'approved' || invitationAction?.status === 'claimed'
    ? 'approved'
    : invitationAction?.status === 'rejected'
      ? 'rejected'
      : 'pending'

  const ensureInvitation = async () => {
    if (!snapshot || !facts) throw new Error('Guardian API data is not loaded yet.')
    let current = snapshot.state.actions.find((action) => action.type === 'send_invitation_batch')
    if (!current) current = await guardianApi.createInvitation(facts.venue, facts.date)
    else if (current.status !== 'drafted' || !hasCurrentDependencies(current, snapshot.state)) {
      current = await guardianApi.reviseInvitation(current.id, facts.venue, facts.date)
    }
    return current
  }

  return {
    enabled,
    loading,
    busy,
    error,
    isWorkspaceEmpty: snapshot !== null && snapshot.state.facts.length === 0,
    facts,
    rawFacts: snapshot?.state.facts ?? [],
    actions,
    evidence,
    obligations,
    ownerReviewTasks: snapshot?.readiness.owner_review_tasks ?? [],
    openCorrelationToken: snapshot?.readiness.open_obligations[0]?.correlation_token ?? null,
    reviewDispositions: snapshot?.state.review_dispositions ?? [],
    reviewData: snapshot?.review ?? null,
    factProposals: snapshot?.state.fact_proposals ?? [],
    outboundMessages: snapshot?.state.outbound_messages ?? [],
    context: (role: 'invitations' | 'catering') => guardianApi.context(role),
    priorities: (role: 'invitations' | 'catering') => guardianApi.priorities(role),
    activities,
    decision,
    vendorConfirmed,
    readinessReady: snapshot?.readiness.ready ?? false,
    openObligations,
    pauseAutomationOn: snapshot?.state.kill_switch ?? false,
    affectedActions: actions.filter((action) => action.status === 'stale' || action.status === 'reconfirmation_required').length,
    unaffectedActions: actions.filter((action) => action.status === 'valid').length,
    claimRecorded: apiAction?.claim_status === 'claimed',
    changeFact: (factId: string, value: unknown) => mutate(() => guardianApi.changeFact(factId, value)),
    changeVenue: (venue: string) => mutate(() => guardianApi.changeVenue(venue)),
    createAction: (type: string, params: Record<string, unknown>, required = false, role: 'invitations' | 'catering' = 'invitations') =>
      mutate(() => guardianApi.createAction(type, params, required, role)),
    approveAction: (actionId: string, revision: number) => mutate(() => guardianApi.approve(actionId, revision)),
    rejectAction: (actionId: string, revision: number, reason: string) => mutate(() => guardianApi.reject(actionId, revision, reason)),
    revokeApproval: (actionId: string, revision: number, reason = '') =>
      mutate(() => guardianApi.revoke(actionId, revision, reason)),
    verifyAudit: () => guardianApi.verifyAudit(),
    claimAction: (actionId: string, revision: number, role: 'invitations' | 'catering' = 'invitations') =>
      mutate(() => guardianApi.claim(actionId, revision, role)),
    approveInvitation: () => mutate(async () => {
      const action = await ensureInvitation()
      await guardianApi.approve(action.id, action.revision)
    }),
    rejectInvitation: (reason: string) => mutate(async () => {
      const action = await ensureInvitation()
      await guardianApi.reject(action.id, action.revision, reason)
    }),
    claimInvitation: () => mutate(async () => {
      if (!apiAction || !invitationAction?.revision) throw new Error('Create and approve an invitation before requesting a claim.')
      await guardianApi.claim(apiAction.id, invitationAction.revision)
    }),
    setPauseAutomation: (enabled: boolean) => mutate(() => guardianApi.setKillSwitch(enabled)),
    recordReviewDisposition: (disposition: ReviewDisposition, reason: string) =>
      mutate(() => guardianApi.recordReviewDisposition(disposition, reason)),
    resolveReviewTask: (taskId: string) => mutate(() => guardianApi.resolveReviewTask(taskId)),
    setupWorkspace: (payload: {
      name: string
      venue: string
      event_start: string
      headcount: number
      budget_cap: number
      vendor_name?: string
    }) => mutate(() => guardianApi.setupWorkspace(payload)),
    clearWorkspace: () => mutate(() => guardianApi.clearWorkspace()),
    renameWorkspace: (name: string) => mutate(() => guardianApi.renameWorkspace(name)),
    createFact: (id: string, value: unknown) => mutate(() => guardianApi.createFact(id, value)),
    createObligation: (payload: { name: string; fact_id: string; vendor_name: string; vendor_email: string }) =>
      mutate(() => guardianApi.createObligation(payload)),
    resolveFactProposal: (proposalId: string, accept: boolean) =>
      mutate(() => guardianApi.resolveFactProposal(proposalId, accept)),
    dispatchAction: (actionId: string, revision: number, simulateTimeout = false) =>
      mutate(() => guardianApi.dispatchAction(actionId, revision, simulateTimeout)),
    reconcileOutbound: (messageId: string, found: boolean) =>
      mutate(() => guardianApi.reconcileOutbound(messageId, found)),
    refresh: () => mutate(async () => refresh()),
  }
}
