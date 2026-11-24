import { Menu, RotateCcw } from 'lucide-react'
import type { PageId } from '../../types/guardian'

const pageTitles: Record<PageId, string> = {
  overview: 'Overview',
  actions: 'Actions & Approvals',
  obligations: 'Obligations & Evidence',
  activity: 'Activity Log',
}

interface TopbarProps {
  page: PageId
  ready: boolean
  onReset: () => void
  onMenu: () => void
}

export default function Topbar({ page, ready, onReset, onMenu }: TopbarProps) {
  return <header className="topbar">
    <div className="topbar-left">
      <button className="menu-toggle" onClick={onMenu} aria-label="Open navigation"><Menu size={19} /></button>
      <div className="topbar-title">{pageTitles[page]}</div>
      <div className="topbar-separator" />
      <span className="event-select"><span className="event-select-icon"><span /></span><span>TechMeet 2026</span></span>
      <span className={`event-state ${ready ? 'state-ready' : ''}`}><span />{ready ? 'READY' : 'ACTION REQUIRED'}</span>
    </div>
    <div className="topbar-right">
      <span className="demo-pill"><span className="demo-dot" /> DEMO MODE</span>
      <button className="reset-button" onClick={onReset} aria-label="Reset Demo"><RotateCcw size={14} /><span>Reset Demo</span></button>
      <div className="top-avatar" title="Demo owner">RP</div>
    </div>
  </header>
}
