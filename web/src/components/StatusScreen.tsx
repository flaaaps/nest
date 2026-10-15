import type { ReactNode } from 'react';
import { Logo } from './Logo.tsx';

interface Props {
  title: string;
  message?: string;
  detail?: string;
  actions?: ReactNode;
}

export function StatusScreen({ title, message, detail, actions }: Props) {
  return (
    <div className="status-screen">
      <div className="status-card" role="alert">
        <Logo className="brand-logo" />
        <h1 style={{ marginTop: 14 }}>{title}</h1>
        {message && <p>{message}</p>}
        {detail && <pre>{detail}</pre>}
        {actions && <div className="status-actions">{actions}</div>}
      </div>
    </div>
  );
}
