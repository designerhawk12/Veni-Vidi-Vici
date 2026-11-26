export interface ApiFact {
  id: string
  version: number
  value: unknown
  status?: 'owner_confirmed' | 'superseded'
  changed_at?: string
}

export interface ApiAction {
  id: string
  type: string
  revision: number
  proposed_by: string
  required: boolean
  status: string
  stale_reason: string | null
  claim_status: string | null
  dependencies: { fact: string; version: number }[]
  parameters: Record<string, unknown>
  params_hash: string
}

export interface ApiReviewDisposition {
  id: string
  disposition: 'accepted_recommendation' | 'accepted_tradeoff' | 'dismissed' | 'clarification_requested'
  reason: string
  recorded_by: string
  created_at: string
}

export interface ApiFactProposal {
  id: string
  fact_id: string
  value: unknown
  proposed_by: string
  reason: string
  status: string
  created_at: string
}

export interface ApiOutboundMessage {
  id: string
  action_id: string
  revision: number
  correlation_token: string | null
  recipient: string
  status: 'sent' | 'unknown' | 'provider_accepted' | 'failed'
  created_at: string
}

export interface ApiReview {
  status: string
  budget: {
    cap: number
    committed: number
    available: number
    essential_forecast: number
    headroom: number
    optional_proposal: number
    shortfall: number
  }
  findings: { code: string; verdict: string; title: string; detail: string; suggestion: string }[]
}

export interface ApiState {
  workspace_id: string
  workspace_name?: string
  kill_switch: boolean
  facts: ApiFact[]
  fact_history: ApiFact[]
  actions: ApiAction[]
  review_dispositions?: ApiReviewDisposition[]
  fact_proposals?: ApiFactProposal[]
  outbound_messages?: ApiOutboundMessage[]
}

export interface ApiEvidence {
  id: string
  obligation_id: string
  decision: 'CONFIRM' | 'DECLINE'
  fact_version: number
  accepted: boolean
  reason_code: string | null
  received_at: string
}

export interface ApiReadiness {
  ready: boolean
  requirements_initialized: boolean
  fact_version: number
  label: string
  open_obligations: ApiObligation[]
  obligations: ApiObligation[]
  pending_required_actions: { id: string; type: string; revision: number; status: string; reason: string | null }[]
  owner_review_tasks: { id: string; obligation_id: string | null; reason_code: string; created_at: string }[]
  evidence: ApiEvidence[]
}

export interface ApiObligation {
  id: string
  name: string
  status: 'confirmed' | 'open'
  required: boolean
  vendor: { id: string; name: string; email: string }
  required_fact: { id: string; version: number; value: unknown }
  correlation_token: string | null
}

export interface ApiAuditItem {
  seq: number
  timestamp: string
  actor: string
  event: string
  payload: Record<string, unknown>
  prev_hash?: string
  entry_hash?: string
}

export class GuardianApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'GuardianApiError'
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  })

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new GuardianApiError('INVALID_RESPONSE', 'The Guardian API returned an unreadable response.', response.status)
  }

  if (!response.ok) {
    const error = payload as { error?: unknown; message?: unknown }
    throw new GuardianApiError(
      typeof error.error === 'string' ? error.error : 'REQUEST_FAILED',
      typeof error.message === 'string' ? error.message : `Guardian API request failed (${response.status}).`,
      response.status,
    )
  }

  return payload as T
}

export const guardianApi = {
  state: () => request<ApiState>('/api/state'),
  readiness: () => request<ApiReadiness>('/api/readiness'),
  context: (role: 'invitations' | 'catering') =>
    request<{
      workspace_name?: string
      kill_switch: boolean
      facts: ApiFact[]
      actions: ApiAction[]
      open_obligations: ApiObligation[]
      token_count: number
    }>(`/api/context?role=${encodeURIComponent(role)}`),
  priorities: (role: 'invitations' | 'catering') =>
    request<{
      recommendation: { priority: string; items: string[] }[]
      findings: ApiReview['findings']
      authority: 'advisory'
    }>(`/api/priorities?role=${encodeURIComponent(role)}`),
  audit: () => request<{ items: ApiAuditItem[] }>('/api/audit?since=0'),
  verifyAudit: () => request<{ valid: boolean; verified_through: number; entries?: number; broken_at?: number }>('/api/audit/verify'),
  review: () => request<ApiReview>('/api/review'),
  changeFact: (factId: string, value: unknown) => request(`/api/facts/${encodeURIComponent(factId)}`, { method: 'POST', body: JSON.stringify({ value }) }),
  changeVenue: (venue: string) => request('/api/facts/venue.address', { method: 'POST', body: JSON.stringify({ value: venue }) }),
  createAction: (type: string, params: Record<string, unknown>, required = false, role: 'invitations' | 'catering' = 'invitations') =>
    request<ApiAction>('/api/actions', {
      method: 'POST',
      headers: { 'X-Guardian-Role': role },
      body: JSON.stringify({ type, required, params }),
    }),
  createInvitation: (venue: string, date: string) => request<ApiAction>('/api/actions', {
    method: 'POST',
    body: JSON.stringify({
      type: 'send_invitation_batch',
      required: false,
      params: {
        recipient: 'guest@example.test',
        venue,
        event_date: date,
        recipient_count: 120,
      },
    }),
  }),
  reviseAction: (actionId: string, params: Record<string, unknown>, role: 'invitations' | 'catering' = 'invitations') =>
    request<ApiAction>(`/api/actions/${actionId}/revisions`, {
      method: 'POST',
      headers: { 'X-Guardian-Role': role },
      body: JSON.stringify({ params }),
    }),
  reviseInvitation: (actionId: string, venue: string, date: string) => request<ApiAction>(`/api/actions/${actionId}/revisions`, {
    method: 'POST',
    body: JSON.stringify({
      params: {
        recipient: 'guest@example.test',
        venue,
        event_date: date,
        recipient_count: 120,
      },
    }),
  }),
  approve: (actionId: string, revision: number) => request(`/api/actions/${actionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ revision }),
  }),
  reject: (actionId: string, revision: number, reason: string) => request(`/api/actions/${actionId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ revision, reason }),
  }),
  revoke: (actionId: string, revision: number, reason = '') => request(`/api/actions/${actionId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ revision, reason }),
  }),
  claim: async (actionId: string, revision: number, role: 'invitations' | 'catering' = 'invitations') => {
    const result = await request<{
      status?: string
      dispatch_configured?: boolean
      outcome?: string
      code?: string
      message?: string
    }>(`/api/actions/${actionId}/claim`, {
      method: 'POST',
      headers: { 'X-Guardian-Role': role },
      body: JSON.stringify({ revision }),
    })
    if (result.outcome === 'DENY') {
      throw new GuardianApiError(
        result.code ?? 'CLAIM_DENIED',
        result.message ?? 'The Guardian execution gateway denied this claim.',
        409,
      )
    }
    return result
  },
  setKillSwitch: (enabled: boolean) => request('/api/killswitch', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  }),
  submitVendorReply: (token: string, decision: 'CONFIRM' | 'DECLINE') =>
    request<{ outcome: string; accepted?: boolean; reason_code?: string; fact_version?: number; obligation_id?: string }>('/api/evidence/replies', {
      method: 'POST',
      body: JSON.stringify({ token, decision }),
    }),
  recordReviewDisposition: (disposition: string, reason: string) =>
    request<ApiReviewDisposition>('/api/review/dispositions', {
      method: 'POST',
      body: JSON.stringify({ disposition, reason }),
    }),
  resolveReviewTask: (taskId: string) =>
    request<{ id: string; status: string }>(`/api/review/tasks/${taskId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  setupWorkspace: (payload: {
    name: string
    venue: string
    event_start: string
    headcount: number
    budget_cap: number
    vendor_name?: string
  }) =>
    request<{ workspace_id: string; workspace_name: string; empty: boolean }>('/api/workspace/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  clearWorkspace: () =>
    request<{ workspace_id: string; workspace_name: string; empty: boolean }>('/api/workspace/clear', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  renameWorkspace: (name: string) =>
    request<{ workspace_id: string; workspace_name: string }>('/api/workspace/rename', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  createFact: (id: string, value: unknown) =>
    request<{ id: string; version: number; value: unknown }>('/api/facts', {
      method: 'POST',
      body: JSON.stringify({ id, value }),
    }),
  createObligation: (payload: { name: string; fact_id: string; vendor_name: string; vendor_email: string }) =>
    request<{ id: string; name: string; correlation_token: string }>('/api/obligations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resolveFactProposal: (proposalId: string, accept: boolean) =>
    request<{ id: string; status: string }>(`/api/facts/proposals/${proposalId}/${accept ? 'accept' : 'reject'}`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  dispatchAction: (actionId: string, revision: number, simulateTimeout = false) =>
    request<{ message_id: string; status: string; correlation_token: string; recipient: string }>(`/api/actions/${actionId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ revision, simulate_timeout: simulateTimeout }),
    }),
  reconcileOutbound: (messageId: string, found: boolean) =>
    request<{ message_id: string; status: string }>(`/api/outbound/${messageId}/reconcile`, {
      method: 'POST',
      body: JSON.stringify({ found }),
    }),
}
