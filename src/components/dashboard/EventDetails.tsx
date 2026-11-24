import { CalendarDays, MapPin, UsersRound, Wallet } from 'lucide-react'
import type { EventFacts } from '../../types/guardian'

export default function EventDetails({ facts }: { facts: EventFacts }) {
  const details = [
    { icon: UsersRound, label: 'Attendees', value: `${facts.attendees} registered` },
    { icon: CalendarDays, label: 'Event date', value: facts.date },
    { icon: Wallet, label: 'Budget cap', value: `₹${new Intl.NumberFormat('en-IN').format(facts.budgetCap)}` },
    { icon: MapPin, label: 'Current venue', value: facts.venue },
  ]
  return <div className="event-details">
    {details.map(({ icon: Icon, label, value }) => <div className="event-detail" key={label}><span className="detail-icon"><Icon size={15} /></span><span className="detail-copy"><span>{label}</span><strong>{value}</strong></span></div>)}
    <div className="facts-version"><span className="version-pulse" /><span>Event facts</span><strong>V{facts.version}</strong></div>
  </div>
}
