import { Activity, ClipboardCheck, LayoutDashboard, ShieldCheck, WalletCards, X } from 'lucide-react'
import type { PageId } from '../../types/guardian'

const items: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'actions', label: 'Actions & Approvals', icon: ClipboardCheck },
  { id: 'obligations', label: 'Obligations & Evidence', icon: WalletCards },
  { id: 'activity', label: 'Activity Log', icon: Activity },
]

interface SidebarProps {
  page: PageId
  onNavigate: (page: PageId) => void
  open: boolean
  onClose: () => void
}

export default function Sidebar({ page, onNavigate, open, onClose }: SidebarProps) {
  return <>
    <div className={`sidebar-scrim ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup">
        <div className="brand-mark"><ShieldCheck size={22} strokeWidth={2.3} /></div>
        <div><div className="brand-name">Event Guardian</div><div className="brand-subtitle">Powered by Goal Guardian</div></div>
        <button className="mobile-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {items.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => { onNavigate(id); onClose() }}>
          <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{page === id && <span className="nav-current" />}
        </button>)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="workspace-card">
        <div className="workspace-icon"><span className="workspace-dot" />DG</div>
        <div className="workspace-copy"><strong>Demo Workspace</strong><span>TechMeet 2026</span></div>
        <span className="workspace-menu">···</span>
      </div>
      <div className="prototype-label"><span className="prototype-dot" /> Prototype environment</div>
      <div className="sidebar-foot">EVENT GUARDIAN <span>·</span> V0.9.4</div>
    </aside>
  </>
}
