import { AlertCircle, CheckCircle2, Clock3, Info, ShieldAlert } from 'lucide-react'
import type { ActivityRecord } from '../../types/guardian'

const icons = { neutral: Clock3, info: Info, warning: AlertCircle, blocked: ShieldAlert, success: CheckCircle2 }
const colors = { neutral: 'timeline-slate', info: 'timeline-blue', warning: 'timeline-amber', blocked: 'timeline-red', success: 'timeline-green' }

export function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

export default function Timeline({ items, compact = false }: { items: ActivityRecord[]; compact?: boolean }) {
  return <div className={`timeline ${compact ? 'timeline-compact' : ''}`}>
    {items.map((item, index) => {
      const Icon = icons[item.tone]
      return <div className="timeline-item" key={item.id}>
        <div className={`timeline-marker ${colors[item.tone]}`}><Icon size={compact ? 13 : 14} /></div>
        <div className="timeline-body"><div className="timeline-heading"><strong>{item.title}</strong><time>{formatTimestamp(item.timestamp)}</time></div><p>{item.detail}</p>{item.code && <code className="inline-code">{item.code}</code>}</div>
        {index < items.length - 1 && <span className="timeline-line" />}
      </div>
    })}
  </div>
}
