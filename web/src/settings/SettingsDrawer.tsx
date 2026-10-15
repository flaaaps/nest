import type { DashboardSettings, NestConfig } from '@nest/shared';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { X } from '../icons.ts';
import { GeneralTab } from './GeneralTab.tsx';
import { GroupsTab } from './GroupsTab.tsx';
import { SERVICE_FORM_ID } from './ServiceForm.tsx';
import { ServicesTab, type EditingService } from './ServicesTab.tsx';

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
  const pointerOnBackdrop = useRef(false);
  const [tab, setTab] = useState<Tab>('general');
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);
  const [editing, setEditing] = useState<EditingService | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setTab('general');
      setStatus(null);
      setEditing(null);
      setConfirmDiscard(false);
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

  // Leaving the "Discard?" prompt alone once the draft is clean again.
  useEffect(() => {
    if (!dirty) setConfirmDiscard(false);
  }, [dirty]);

  const requestClose = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const selectTab = (next: Tab) => {
    setTab(next);
    setEditing(null);
  };

  const save = async () => {
    setBusy('save');
    setStatus({ tone: 'info', text: 'Saving…' });
    const result = await onSave();
    setBusy(null);
    setStatus(result.ok ? { tone: 'success', text: 'Saved.' } : { tone: 'error', text: result.message });
  };

  const reset = async () => {
    setBusy('reset');
    setStatus({ tone: 'info', text: 'Resetting…' });
    const result = await onReset();
    setBusy(null);
    setStatus(result.ok ? { tone: 'success', text: 'Defaults restored.' } : { tone: 'error', text: result.message });
  };

  const updateDashboard = (patch: Partial<DashboardSettings>) => {
    if (draft) handleChange({ ...draft, dashboard: { ...draft.dashboard, ...patch } });
  };

  const handleChange = (next: NestConfig) => {
    if (status?.tone !== 'error') setStatus(null);
    onChange(next);
  };

  // A click on the translucent backdrop (outside the panel) closes the drawer.
  // Both pointer-down and click must land on the backdrop so that selecting
  // text inside the panel and releasing outside does not close it.
  const onPointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    pointerOnBackdrop.current = event.target === dialogRef.current;
  };
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    const onBackdrop = pointerOnBackdrop.current && event.target === dialogRef.current;
    pointerOnBackdrop.current = false;
    if (onBackdrop) requestClose();
  };

  const renderFooter = () => {
    if (confirmDiscard) {
      return (
        <>
          <p className="drawer-status" data-tone="error" aria-live="polite">
            Discard unsaved changes?
          </p>
          <button type="button" className="btn" autoFocus onClick={() => setConfirmDiscard(false)}>
            Keep editing
          </button>
          <button type="button" className="btn btn-danger-solid" onClick={onClose}>
            Discard
          </button>
        </>
      );
    }
    if (editing) {
      return (
        <>
          <p className="drawer-status">{editing.isNew ? 'New service' : `Editing “${editing.service.name}”`}</p>
          <button type="button" className="btn" onClick={() => setEditing(null)}>
            Cancel
          </button>
          <button type="submit" form={SERVICE_FORM_ID} className="btn btn-primary">
            {editing.isNew ? 'Add service' : 'Apply'}
          </button>
        </>
      );
    }
    return (
      <>
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
      </>
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className="drawer"
      aria-labelledby="settings-title"
      onPointerDown={onPointerDown}
      onClick={onBackdropClick}
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
                onClick={() => selectTab(item.id)}
                onKeyDown={(event) => {
                  const index = TABS.findIndex((t) => t.id === tab);
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault();
                    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
                    selectTab(next.id);
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
              <GeneralTab dashboard={draft.dashboard} onChange={updateDashboard} onReset={reset} resetting={busy === 'reset'} />
            )}
            {tab === 'services' && (
              <ServicesTab
                config={draft}
                onChange={handleChange}
                editing={editing}
                onEdit={setEditing}
                onFinishEditing={() => setEditing(null)}
              />
            )}
            {tab === 'groups' && <GroupsTab config={draft} onChange={handleChange} />}
          </div>

          <div className="drawer-footer">{renderFooter()}</div>
        </div>
      )}
    </dialog>
  );
}
