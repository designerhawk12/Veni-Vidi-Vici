import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, eyebrow, children, width = 'medium' }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode; width?: 'medium' | 'wide' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className={`modal-panel modal-${width}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-header"><div>{eyebrow && <div className="modal-eyebrow">{eyebrow}</div>}<h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
      <div className="modal-body">{children}</div>
    </section>
  </div>
}
