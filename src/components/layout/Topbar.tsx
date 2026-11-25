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
  eventName?: string
  ready: boolean
  openObligations: number
  pauseAutomationOn: boolean
  apiMode: boolean
  onPauseAutomationChange: (enabled: boolean) => void
  onReset: () => void
  onMenu: () => void
}

export default function Topbar({ page, eventName = 'New Workspace', ready, openObligations, pauseAutomationOn, apiMode, onPauseAutomationChange, onReset, onMenu }: TopbarProps) {
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  const updateSwitch = () => {
    onPauseAutomationChange(!pauseAutomationOn)
    setConfirmSwitch(false)
  }
  return <>
    <header className="topbar">
    <div className="topbar-left">
      <button className="menu-toggle" onClick={onMenu} aria-label="Open navigation"><Menu size={19} /></button>
      <div className="topbar-title">{pageTitles[page]}</div>
      <div className="topbar-separator" />
      <span className="event-select"><span className="event-select-icon"><span /></span><span>{eventName}</span></span>
      <span className={`event-state ${ready ? 'state-ready' : ''}`} aria-live="polite"><span />{ready ? 'Recorded arrangements ready' : `Not ready · ${openObligations} open`}</span>
    </div>
    <div className="topbar-right">
      <span className="connector-chip"><span className="connector-dot" /> {apiMode ? 'Email · disconnected' : 'Email · demo'}</span>
      <button className={`pause-automation-control ${pauseAutomationOn ? 'pause-automation-on' : ''}`} onClick={() => setConfirmSwitch(true)} aria-label={pauseAutomationOn ? 'Re-enable auto-send' : 'Engage pause automation'} aria-pressed={pauseAutomationOn}>
        <Power size={15} />{pauseAutomationOn ? 'Auto-send paused' : 'Pause automation'}
      </button>
      
      <button className="reset-button" onClick={onReset} aria-label={apiMode ? 'Refresh backend data' : 'Reset demo'}><RotateCcw size={14} /><span>{apiMode ? 'Refresh' : 'Reset'}</span></button>
      <div className="top-avatar" title="Organizer">RP</div>
    </div>
    </header>
    <Modal open={confirmSwitch} onClose={() => setConfirmSwitch(false)} eyebrow="AUTOMATION CONTROL" title={pauseAutomationOn ? 'Re-enable execution claims?' : 'Pause execution claims?'}>
      <div className="switch-confirmation"><AlertTriangle size={20} /><p>{pauseAutomationOn ? 'This restores authorization claims through the Guardian API. There is still no configured external connector.' : `This will block new execution claims ${apiMode ? 'in the Guardian API' : 'in this browser demo'}. It cannot recall actions already recorded.`}</p></div>
      <div className="modal-action-footer"><button className="button button-outline" onClick={() => setConfirmSwitch(false)}>Cancel</button><button className={`button ${pauseAutomationOn ? 'button-primary' : 'button-danger'}`} onClick={updateSwitch}>{pauseAutomationOn ? 'Re-enable auto-send' : 'Engage pause automation'}</button></div>
    </Modal>
  </>
}
