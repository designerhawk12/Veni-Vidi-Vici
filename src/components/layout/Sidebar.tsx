import { Activity, ArrowUpRight, ClipboardCheck, Compass, ShieldCheck, WalletCards, X } from 'lucide-react'
import type { PageId } from '../../types/guardian'

const items: { id: PageId; label: string; icon: typeof Compass }[] = [
  { id: 'goals', label: 'Goals & Facts', icon: Compass },
  { id: 'decisions', label: 'Decisions', icon: ClipboardCheck },
  { id: 'actions', label: 'Actions', icon: ShieldCheck },
  { id: 'readiness', label: 'Readiness & Evidence', icon: WalletCards },
  { id: 'history', label: 'History', icon: Activity },
]

interface SidebarProps {
  page: PageId
  workspaceName?: string
  onNavigate: (page: PageId) => void
  open: boolean
  onClose: () => void
}

export default function Sidebar({ page, workspaceName = 'New Workspace', onNavigate, open, onClose }: SidebarProps) {
  return <>
    <div className={`sidebar-scrim ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup">
        <div className="brand-mark"><ShieldCheck size={22} strokeWidth={2.3} /></div>
        <div><div className="brand-name">Event Guardian</div></div>
        <button className="mobile-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {items.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => { onNavigate(id); onClose() }}>
          <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{page === id && <span className="nav-current" />}
        </button>)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="workspace-card">
        <div className="workspace-icon"><span className="workspace-dot" />DG</div>
        <div className="workspace-copy"><strong>Workspace</strong><span>{workspaceName}</span></div>
        <span className="workspace-menu">···</span>
      </div>
      
      <a className="sidebar-home-link" href="/">Product home <ArrowUpRight size={13} /></a>
      <div className="sidebar-foot">EVENT GUARDIAN <span>·</span> V0.9.4</div>
    </aside>
  </>
}
