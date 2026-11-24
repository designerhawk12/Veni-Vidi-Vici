import type { LucideIcon } from 'lucide-react'

export default function MetricCard({ label, value, detail, icon: Icon, tone = 'blue' }: { label: string; value: string | number; detail: string; icon: LucideIcon; tone?: 'blue' | 'amber' | 'green' | 'slate' }) {
  return <article className="metric-card">
    <div className={`metric-icon metric-${tone}`}><Icon size={17} strokeWidth={1.9} /></div>
    <div className="metric-content"><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></div>
  </article>
}
