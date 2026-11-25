/**
 * useAdvisor – fetches AI insight cards and exposes a chat function.
 *
 * In demo mode (no backend), falls back to static placeholder cards.
 * In API mode, calls /api/insights and /api/chat on the backend.
 */
import { useCallback, useEffect, useState } from 'react'
import type { ReturnTypeUseDemoScenario } from '../pages/pageTypes'

export type InsightLevel = 'ok' | 'warning' | 'critical'

export interface InsightCard {
  level: InsightLevel
  title: string
  detail: string
  obligation_id: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

function demoInsights(scenario: ReturnTypeUseDemoScenario): InsightCard[] {
  const cards: InsightCard[] = []
  if (scenario.readinessReady) {
    cards.push({
      level: 'ok',
      title: 'Event is ready',
      detail: `All obligations are fulfilled and evidence is version-matched for V${scenario.facts.version}.`,
      obligation_id: null,
    })
  } else {
    if (!scenario.vendorConfirmed) {
      cards.push({
        level: 'critical',
        title: 'Catering confirmation missing',
        detail: `No vendor reply recorded for V${scenario.facts.version}. This obligation blocks readiness.`,
        obligation_id: 'catering-confirmation',
      })
    }
    if (!scenario.providerAccepted) {
      cards.push({
        level: 'warning',
        title: 'Provider acceptance pending',
        detail: 'No transport readback has been recorded yet for the guest-delivery obligation.',
        obligation_id: 'guest-delivery',
      })
    }
    const staleCount = scenario.evidence.filter((e) => !e.accepted).length
    if (staleCount > 0) {
      cards.push({
        level: 'warning',
        title: `${staleCount} stale evidence record${staleCount > 1 ? 's' : ''}`,
        detail: 'Some evidence references an older fact version and cannot close current obligations.',
        obligation_id: null,
      })
    }
  }
  cards.push({
    level: 'warning',
    title: 'AI insights unavailable',
    detail: 'Set GEMINI_API_KEY and use API mode to enable live risk analysis.',
    obligation_id: null,
  })
  return cards
}

export function useAdvisor(scenario: ReturnTypeUseDemoScenario) {
  const [insights, setInsights] = useState<InsightCard[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  // Load insights whenever key state changes
  useEffect(() => {
    if (!scenario.apiMode) {
      setInsights(demoInsights(scenario))
      return
    }
    setInsightsLoading(true)
    fetch('/api/insights', { headers: { 'x-guardian-role': 'owner' } })
      .then((r) => r.json())
      .then((data: InsightCard[]) => setInsights(Array.isArray(data) ? data : []))
      .catch(() => setInsights(demoInsights(scenario)))
      .finally(() => setInsightsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.readinessReady, scenario.vendorConfirmed, scenario.providerAccepted, scenario.apiMode])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      const userMsg: ChatMessage = { role: 'user', text: text.trim() }
      setChatMessages((prev) => [...prev, userMsg])
      setChatLoading(true)

      if (!scenario.apiMode) {
        // Demo mode: answer a few static questions, otherwise deflect
        const q = text.toLowerCase()
        let answer = "I'm running in demo mode. Enable API mode and set GEMINI_API_KEY for live answers."
        if (q.includes('ready') || q.includes('readiness')) {
          answer = scenario.readinessReady
            ? `The event is ready. All obligations are fulfilled for V${scenario.facts.version}.`
            : `The event is not ready. ${scenario.openObligations} obligation(s) remain open.`
        } else if (q.includes('block') || q.includes('missing')) {
          const issues = []
          if (!scenario.vendorConfirmed) issues.push('catering confirmation')
          if (!scenario.providerAccepted) issues.push('provider acceptance')
          answer = issues.length
            ? `The following are blocking readiness: ${issues.join(', ')}.`
            : 'Nothing is currently blocking readiness.'
        } else if (q.includes('evidence')) {
          const accepted = scenario.evidence.filter((e) => e.accepted).length
          const total = scenario.evidence.length
          answer = `There are ${total} evidence records; ${accepted} accepted and ${total - accepted} stale.`
        }
        setTimeout(() => {
          setChatMessages((prev) => [...prev, { role: 'assistant', text: answer }])
          setChatLoading(false)
        }, 400)
        return
      }

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guardian-role': 'owner' },
          body: JSON.stringify({ message: text.trim() }),
        })
        const data = (await res.json()) as { reply: string }
        setChatMessages((prev) => [...prev, { role: 'assistant', text: data.reply ?? 'No response.' }])
      } catch {
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', text: 'Could not reach the AI service. Check that the backend is running.' },
        ])
      } finally {
        setChatLoading(false)
      }
    },
    [scenario],
  )

  return { insights, insightsLoading, chatMessages, chatLoading, sendMessage }
}
