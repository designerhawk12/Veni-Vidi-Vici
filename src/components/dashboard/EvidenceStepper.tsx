// src/components/dashboard/EvidenceStepper.tsx
import { Check, CircleDashed } from 'lucide-react'

interface StepProps {
  number: string
  title: string
  description: string
  done: boolean
}

function Step({ number, title, description, done }: StepProps) {
  return (
    <div className={`signal-stage${done ? ' signal-done' : ''}`}>
      <span className="signal-number">{number}</span>
      <strong>{title}</strong>
      <span className="signal-desc">{description}</span>
      <span className="signal-status-icon">
        {done ? <Check size={11} /> : <CircleDashed size={11} />}
      </span>
    </div>
  )
}

export default function EvidenceStepper({
  actionAttempted,
  providerAccepted,
  vendorConfirmed,
  evidenceVerified,
}: {
  actionAttempted: boolean
  providerAccepted: boolean
  vendorConfirmed: boolean
  evidenceVerified: boolean
}) {
  return (
    <>
      <Step number="01" title="Action attempted" description="Service proposal" done={actionAttempted} />
      <i />
      <Step number="02" title="Provider accepted" description="Transport readback" done={providerAccepted} />
      <i />
      <Step number="03" title="Counterparty confirmed" description="Vendor reply" done={vendorConfirmed} />
      <i />
      <Step number="04" title="Current evidence verified" description="Version-matched record" done={evidenceVerified} />
    </>
  )
}
