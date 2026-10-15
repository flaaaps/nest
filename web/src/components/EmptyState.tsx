import type { ReactNode } from 'react';
import { LayoutGrid } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="empty" role="status">
      <LayoutGrid className="empty-icon" size={28} strokeWidth={1.5} aria-hidden="true" />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
