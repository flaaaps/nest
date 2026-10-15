import type { Service } from '@nest/shared';
import { ArrowUpRight } from '../icons.ts';
import { ServiceIcon } from './ServiceIcon.tsx';

interface Props {
  service: Service;
  compact: boolean;
}

export function ServiceCard({ service, compact }: Props) {
  return (
    <a
      className="card"
      href={service.url}
      target={service.openInNewTab ? '_blank' : undefined}
      rel="noopener noreferrer"
    >
      <span className="card-icon">
        <ServiceIcon service={service} size={compact ? 16 : 20} />
      </span>
      <span className="card-body">
        <span className="card-name">{service.name}</span>
        {service.description && <span className="card-desc">{service.description}</span>}
      </span>
      <ArrowUpRight className="card-arrow" size={14} aria-hidden="true" />
      {service.openInNewTab && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}
