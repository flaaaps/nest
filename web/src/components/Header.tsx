import type { RefObject } from 'react';
import { SettingsIcon } from '../icons.ts';
import { Logo } from './Logo.tsx';

interface Props {
  title: string;
  onOpenSettings: () => void;
  settingsButtonRef: RefObject<HTMLButtonElement | null>;
}

export function Header({ title, onOpenSettings, settingsButtonRef }: Props) {
  return (
    <header className="header">
      <div className="brand">
        <Logo className="brand-logo" />
        <span className="brand-name">{title}</span>
      </div>
      <div className="header-actions">
        <button
          ref={settingsButtonRef}
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="Open settings"
          title="Settings"
          onClick={onOpenSettings}
        >
          <SettingsIcon size={19} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
