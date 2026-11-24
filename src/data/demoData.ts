import type { ActivityRecord, AgentAction, EventFacts, EvidenceRecord, Obligation, ReviewerFinding } from '../types/guardian'

export const eventFacts: EventFacts = {
  name: 'TechMeet 2026',
  date: '29 November 2026',
  attendees: 120,
  budgetCap: 100000,
  venue: 'Venue B',
  version: 2,
  previousVenue: 'Venue A',
  previousVersion: 1,
}

export const baseActions: AgentAction[] = [
  {
    id: 'invitation-old',
    name: 'Guest Invitation · Venue A',
    agent: 'Fresh Invitation Agent',
    status: 'stale',
    dependencies: [{ fact: 'venue', version: 1, value: 'Venue A' }],
    version: 1,
    approvalState: 'invalidated',
    reason: 'Depends on the old venue version. A new owner approval is required before any action.',
    parameters: { recipient: '120 registered attendees (synthetic)', venue: 'Venue A', date: '29 November 2026', factVersion: 1, channel: 'Email invitation (simulated)' },
  },
  {
    id: 'invitation-current',
    name: 'Updated Guest Invitation · Venue B',
    agent: 'Fresh Invitation Agent',
    status: 'awaiting_approval',
    dependencies: [
      { fact: 'venue', version: 2, value: 'Venue B' },
      { fact: 'event_date', version: 2, value: '29 November 2026' },
      { fact: 'attendee_list', version: 2, value: '120 registered attendees (synthetic)' },
    ],
    version: 2,
    approvalState: 'awaiting_owner',
    reason: 'Corrected proposal uses the current event facts and waits for owner approval.',
    parameters: { recipient: '120 registered attendees (synthetic)', venue: 'Venue B', date: '29 November 2026', factVersion: 2, channel: 'Email invitation (simulated)' },
  },
  {
    id: 'catering',
    name: 'Catering Vendor Confirmation',
    agent: 'Catering Coordination Agent',
    status: 'reconfirmation_required',
    dependencies: [{ fact: 'venue', version: 1, value: 'Venue A' }],
    version: 1,
    approvalState: 'not_required',
    reason: 'Vendor confirmation is tied to the previous venue; an updated confirmation is pending for Venue B.',
  },
  {
    id: 'sponsor-receipt',
    name: 'Sponsor Receipt',
    agent: 'Finance Records Agent',
    status: 'valid',
    dependencies: [{ fact: 'sponsor_payment', version: 1, value: 'Receipt recorded' }],
    version: 1,
    approvalState: 'not_required',
    reason: 'This record does not depend on the venue. No intervention is required.',
  },
]

export const baseObligations: Obligation[] = [
  {
    id: 'guest-delivery',
    name: 'Guest Invitation Delivery',
    status: 'pending',
    requiredVersion: 2,
    requiredVenue: 'Venue B',
    mandatoryForReadiness: false,
    description: 'A provider readback can be recorded after the guarded test send. This is not proof recipients received or confirmed the invitation.',
  },
  {
    id: 'catering-confirmation',
    name: 'Catering Vendor Confirmation',
    status: 'awaiting_confirmation',
    requiredVersion: 2,
    requiredVenue: 'Venue B',
    mandatoryForReadiness: true,
    description: 'Current counterparty confirmation must reference Venue B and event-facts version V2.',
  },
  {
    id: 'sponsor-receipt-obligation',
    name: 'Sponsor Receipt',
    status: 'verified',
    requiredVersion: 1,
    mandatoryForReadiness: true,
    description: 'Verified record is venue-independent and remains valid after the venue change.',
  },
]

export const baseEvidence: EvidenceRecord[] = [
  {
    id: 'sponsor-evidence',
    obligationId: 'sponsor-receipt-obligation',
    kind: 'receipt',
    title: 'Sponsor payment receipt verified',
    detail: 'Receipt record retained; venue is not a dependency.',
    factVersion: 1,
    timestamp: '2026-11-24T09:00:00+05:30',
    accepted: true,
  },
]

export const baseActivity: ActivityRecord[] = [
  { id: 'a1', title: 'Event created', detail: 'TechMeet 2026 workspace initialized for the demo.', timestamp: '2026-11-24T09:00:00+05:30', tone: 'neutral' },
  { id: 'a2', title: 'Owner confirmed initial event details', detail: 'Venue A · 29 November 2026 · 120 attendees · V1.', timestamp: '2026-11-24T09:08:00+05:30', tone: 'info' },
  { id: 'a3', title: 'Initial invitation approved for Venue A', detail: 'Approval applied to the exact V1 invitation parameters.', timestamp: '2026-11-24T09:16:00+05:30', tone: 'success' },
  { id: 'a4', title: 'Venue changed from A to B', detail: 'Current event facts advanced from V1 to V2.', timestamp: '2026-11-24T09:32:00+05:30', tone: 'warning' },
  { id: 'a5', title: 'Invitation marked stale', detail: 'Venue A invitation blocked because it depends on V1.', timestamp: '2026-11-24T09:33:00+05:30', tone: 'blocked', code: 'venue_version: 1 ≠ current_version: 2' },
  { id: 'a6', title: 'Catering confirmation reopened', detail: 'A fresh vendor confirmation is required for Venue B / V2.', timestamp: '2026-11-24T09:35:00+05:30', tone: 'warning' },
  { id: 'a7', title: 'Sponsor receipt retained as valid', detail: 'The venue-independent record was not reset.', timestamp: '2026-11-24T09:36:00+05:30', tone: 'success' },
  { id: 'a8', title: 'Fresh agent attempted outdated invitation', detail: 'The agent proposal still referenced Venue A / V1.', timestamp: '2026-11-24T09:40:00+05:30', tone: 'warning' },
  { id: 'a9', title: 'Guardian blocked the attempt', detail: 'The stale invitation could not proceed against current V2 facts.', timestamp: '2026-11-24T09:40:02+05:30', tone: 'blocked', code: 'venue_version: 1 ≠ current_version: 2' },
  { id: 'a10', title: 'Corrected invitation prepared for V2', detail: 'Updated parameters are ready for owner review; no action has been sent.', timestamp: '2026-11-24T09:44:00+05:30', tone: 'info' },
]

export const reviewerFinding: ReviewerFinding = {
  title: 'Potential Budget Conflict',
  explanation: 'Although the optional upgrade fits within the overall budget cap, it competes with the forecast allocation for essential event requirements.',
  alternative: 'Consider reducing the upgrade or deferring the decision until essential requirements are secured.',
  totalBudget: 100000,
  committed: 65000,
  essentialForecast: 25000,
  optionalUpgrade: 20000,
}
