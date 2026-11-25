import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { InsightCard } from '../../hooks/useAdvisor'

const levelIcon = {
  ok: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
}

export default function InsightCards({ cards, loading }: { cards: InsightCard[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="insight-loading">
        <span className="insight-loading-dot" />
        <span className="insight-loading-dot" />
        <span className="insight-loading-dot" />
        <span>Analysing event state…</span>
      </div>
    )
  }

  if (!cards.length) return null

  return (
    <div className="insight-cards">
      {cards.map((card, i) => {
        const Icon = levelIcon[card.level]
        return (
          <div key={i} className={`insight-card insight-${card.level}`}>
            <span className="insight-icon"><Icon size={14} /></span>
            <div className="insight-body">
              <strong className="insight-title">{card.title}</strong>
              <span className="insight-detail">{card.detail}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
