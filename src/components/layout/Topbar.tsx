import { useState } from 'react'
import { AlertTriangle, Menu, Power, RotateCcw } from 'lucide-react'
import type { PageId } from '../../types/guardian'
import Modal from '../shared/Modal'

const pageTitles: Record<PageId, string> = {
  goals: 'Goals & Facts',
  decisions: 'Decisions',
  actions: 'Actions',
  readiness: 'Readiness & Evidence',
  history: 'History',
}

interface TopbarProps {
  page: PageId
  ready: boolean
  openObligations: number
  killSwitchOn: boolean
  onKillSwitchChange: (enabled: boolean) => void
  onReset: () => void
  onMenu: () => void
}

export default function Topbar({ page, ready, openObligations, killSwitchOn, onKillSwitchChange, onReset, onMenu }: TopbarProps) {
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  const updateSwitch = () => {
    onKillSwitchChange(!killSwitchOn)
    setConfirmSwitch(false)
  }
  return <>
    <header className="topbar">
    <div className="topbar-left">
      <button className="menu-toggle" onClick={onMenu} aria-label="Open navigation"><Menu size={19} /></button>
      <div className="topbar-title">{pageTitles[page]}</div>
      <div className="topbar-separator" />
      <span className="event-select"><span className="event-select-icon"><span /></span><span>TechMeet 2026</span></span>
      <span className={`event-state ${ready ? 'state-ready' : ''}`} aria-live="polite"><span />{ready ? 'Recorded arrangements ready · V2' : `Not ready · ${openObligations} open`}</span>
    </div>
    <div className="topbar-right">
      <span className="connector-chip"><span className="connector-dot" /> Email · simulated</span>
      <button className={`kill-switch-control ${killSwitchOn ? 'kill-switch-on' : ''}`} onClick={() => setConfirmSwitch(true)} aria-label={killSwitchOn ? 'Re-enable simulated dispatch' : 'Engage kill switch'} aria-pressed={killSwitchOn}>
        <Power size={15} />{killSwitchOn ? 'Dispatch disabled' : 'Kill switch'}
      </button>
      <span className="demo-pill"><span className="demo-dot" /> DEMO</span>
      <button className="reset-button" onClick={onReset} aria-label="Reset Demo"><RotateCcw size={14} /><span>Reset Demo</span></button>
      <div className="top-avatar" title="Demo owner">RP</div>
    </div>
    </header>
    <Modal open={confirmSwitch} onClose={() => setConfirmSwitch(false)} eyebrow="DEMO CONTROL" title={killSwitchOn ? 'Re-enable simulated dispatch?' : 'Engage kill switch?'}>
      <div className="switch-confirmation"><AlertTriangle size={20} /><p>{killSwitchOn ? 'This restores simulated action claims. No external connector is configured.' : 'This will block all simulated action claims in this browser demo. It cannot recall actions already recorded.'}</p></div>
      <div className="modal-action-footer"><button className="button button-outline" onClick={() => setConfirmSwitch(false)}>Cancel</button><button className={`button ${killSwitchOn ? 'button-primary' : 'button-danger'}`} onClick={updateSwitch}>{killSwitchOn ? 'Re-enable demo dispatch' : 'Engage kill switch'}</button></div>
    </Modal>
  </>
}
