import { useState } from 'react'
import { ArrowLeft, Check, ShieldAlert, ShieldCheck, Truck } from 'lucide-react'
import { guardianApi } from '../lib/guardianApi'

export default function VendorPortal() {
  const initialToken = new URLSearchParams(window.location.search).get('token') ?? ''
  const [token, setToken] = useState(initialToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ outcome: string; accepted?: boolean; reason_code?: string; fact_version?: number; obligation_id?: string } | null>(null)

  const submit = async (decision: 'CONFIRM' | 'DECLINE') => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const response = await guardianApi.submitVendorReply(token.trim(), decision)
      setResult(response)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit vendor reply.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="landing-page" style={{ minHeight: '100vh', padding: '40px 24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'grid', gap: '20px' }}>
        <a href="/app" className="button button-quiet" style={{ justifySelf: 'start' }}>
          <ArrowLeft size={15} /> Back to organizer workspace
        </a>
        <section className="panel" style={{ padding: '24px', display: 'grid', gap: '16px' }}>
          <div className="panel-heading">
            <div>
              <div className="panel-kicker">VENDOR CONFIRMATION PORTAL</div>
              <h2>Vendor Confirmation · Reply</h2>
            </div>
            <Truck size={20} className="panel-heading-icon" />
          </div>
          <p style={{ margin: 0 }}>
            Submit a vendor confirmation or decline using the correlation token issued for the current confirmed event facts. Stale or mismatched tokens are automatically routed to owner review.
          </p>
          <label className="reason-field">
            Correlation token
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste the obligation correlation token"
              required
            />
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="button button-primary"
              disabled={busy || !token.trim()}
              onClick={() => void submit('CONFIRM')}
            >
              <Check size={15} /> Confirm current arrangement
            </button>
            <button
              className="button button-danger"
              disabled={busy || !token.trim()}
              onClick={() => void submit('DECLINE')}
            >
              <ShieldAlert size={15} /> Decline arrangement
            </button>
          </div>
          {error && <div className="inline-callout red-callout" role="alert">{error}</div>}
          {result && (
            <div className={`inline-callout ${result.accepted ? '' : 'red-callout'}`} role="status" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {result.accepted ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
              <div>
                <strong>{result.accepted ? 'Confirmation accepted' : `Reply routed to owner (${result.reason_code ?? result.outcome})`}</strong>
                <div>
                  {result.accepted
                    ? `Verified for ${result.obligation_id ?? 'obligation'} at fact version V${result.fact_version ?? '?'}.`
                    : 'The obligation remains open until a valid current-version confirmation is received.'}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
