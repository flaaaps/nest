import type { DashboardSettings, NestConfig } from '@nest/shared';
import { useEffect, useRef, useState } from 'react';
import { X } from '../icons.ts';
import { GeneralTab } from './GeneralTab.tsx';
import { GroupsTab } from './GroupsTab.tsx';
import { ServicesTab } from './ServicesTab.tsx';

export type SaveResult = { ok: true } | { ok: false; message: string };

interface Props {
  open: boolean;
  draft: NestConfig | null;
  dirty: boolean;
  onChange: (next: NestConfig) => void;
  onClose: () => void;
  onSave: () => Promise<SaveResult>;
  onReset: () => Promise<SaveResult>;
}

type Tab = 'general' | 'services' | 'groups';
const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'services', label: 'Services' },
  { id: 'groups', label: 'Groups' },
];

type Status = { tone: 'info' | 'success' | 'error'; text: string } | null;

export function SettingsDrawer({ open, draft, dirty, onChange, onClose, onSave, onReset }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>('general');
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setTab('general');
      setStatus(null);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const requestClose = () => {
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    onClose();
  };

  const save = async () => {
    setBusy('save');
    setStatus({ tone: 'info', text: 'Saving…' });
    const result = await onSave();
    setBusy(null);
    setStatus(result.ok ? { tone: 'success', text: 'Saved.' } : { tone: 'error', text: result.message });
  };

  const reset = async () => {
    if (!window.confirm('Reset all settings, services and groups to the defaults? This is saved immediately.')) return;
    setBusy('reset');
    setStatus({ tone: 'info', text: 'Resetting…' });
    const result = await onReset();
    setBusy(null);
    setStatus(result.ok ? { tone: 'success', text: 'Defaults restored.' } : { tone: 'error', text: result.message });
  };

  const updateDashboard = (patch: Partial<DashboardSettings>) => {
    if (draft) onChange({ ...draft, dashboard: { ...draft.dashboard, ...patch } });
  };

  const handleChange = (next: NestConfig) => {
    if (status?.tone !== 'error') setStatus(null);
    onChange(next);
  };

  return (
    <dialog
      ref={dialogRef}
      className="drawer"
      aria-labelledby="settings-title"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      {open && draft && (
        <div className="drawer-inner">
          <div className="drawer-header">
            <h2 className="drawer-title" id="settings-title">
              Settings
            </h2>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Close settings" onClick={requestClose}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="tabs" role="tablist" aria-label="Settings sections">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                className="tab"
                aria-selected={tab === item.id}
                aria-controls={`panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => {
                  const index = TABS.findIndex((t) => t.id === tab);
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault();
                    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
                    setTab(next.id);
                    document.getElementById(`tab-${next.id}`)?.focus();
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="drawer-body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'general' && (
              <GeneralTab dashboard={draft.dashboard} onChange={(patch) => { if (status?.tone !== 'error') setStatus(null); updateDashboard(patch); }} onReset={reset} resetting={busy === 'reset'} />
            )}
            {tab === 'services' && <ServicesTab config={draft} onChange={handleChange} />}
            {tab === 'groups' && <GroupsTab config={draft} onChange={handleChange} />}
          </div>

          <div className="drawer-footer">
            <p className="drawer-status" data-tone={status?.tone} aria-live="polite">
              {status?.text ?? (dirty ? 'Unsaved changes' : '')}
            </p>
            {dirty && (
              <button type="button" className="btn" onClick={requestClose} disabled={busy !== null}>
                Discard
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!dirty || busy !== null}>
              {busy === 'save' ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
