import { useRef, useEffect, useState } from 'react'
import { Bot, ChevronDown, Loader2, Send, Sparkles } from 'lucide-react'
import type { ChatMessage } from '../../hooks/useAdvisor'

interface Props {
  messages: ChatMessage[]
  loading: boolean
  onSend: (text: string) => void
}

export default function ChatPanel({ messages, loading, onSend }: Props) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  function submit() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    onSend(text)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div className={`chat-panel${open ? ' chat-open' : ''}`}>
      {/* Toggle button */}
      <button className="chat-toggle" onClick={() => setOpen((v) => !v)} aria-label="Toggle AI assistant">
        {open ? <ChevronDown size={16} /> : <Sparkles size={16} />}
        <span>{open ? 'Close assistant' : 'Ask AI'}</span>
        {!open && messages.length > 0 && <span className="chat-badge">{messages.length}</span>}
      </button>

      {open && (
        <div className="chat-body">
          {/* Header */}
          <div className="chat-head">
            <Bot size={15} />
            <span>Event Guardian AI</span>
            <span className="chat-model">Gemini</span>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                Ask anything about the current event: readiness, obligations, evidence, risks.
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
                <span className="chat-msg-text">{msg.text}</span>
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg-assistant chat-msg-loading">
                <Loader2 size={12} className="chat-spinner" />
                <span>Thinking…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              rows={1}
              placeholder="e.g. What's blocking readiness?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
            />
            <button className="chat-send" onClick={submit} disabled={!input.trim() || loading} aria-label="Send">
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
