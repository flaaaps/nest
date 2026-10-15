import type { NestConfig } from '@nest/shared';
import { useMemo } from 'react';
import { buildSections, filterSections } from '../lib/dashboard.ts';
import { EmptyState } from './EmptyState.tsx';
import { ServiceCard } from './ServiceCard.tsx';

interface Props {
  config: NestConfig;
  query: string;
  onClearSearch: () => void;
  onOpenSettings: () => void;
}

export function Dashboard({ config, query, onClearSearch, onOpenSettings }: Props) {
  const { columns, cardSize, showEmptyGroups } = config.dashboard;
  const sections = useMemo(
    () => buildSections(config, { showEmptyGroups }),
    [config, showEmptyGroups],
  );

  if (config.services.length === 0) {
    return (
      <EmptyState
        title="No services yet"
        description="Add links to the applications running in your homelab and they will show up here."
        action={
          <button type="button" className="btn btn-primary" onClick={onOpenSettings}>
            Add a service
          </button>
        }
      />
    );
  }

  if (config.services.every((s) => !s.enabled)) {
    return (
      <EmptyState
        title="All services are disabled"
        description="Enable at least one service in the settings to show it on the dashboard."
        action={
          <button type="button" className="btn" onClick={onOpenSettings}>
            Open settings
          </button>
        }
      />
    );
  }

  const visible = filterSections(sections, query);
  if (visible.length === 0) {
    return (
      <EmptyState
        title={`No results for “${query.trim()}”`}
        description="Try a different name, description or group."
        action={
          <button type="button" className="btn" onClick={onClearSearch}>
            Clear search
          </button>
        }
      />
    );
  }

  return (
    <>
      {visible.map((section) => {
        const headingId = `group-${section.id ?? 'other'}`;
        return (
          <section key={section.id ?? '__other'} className="group" aria-labelledby={section.name ? headingId : undefined}>
            {section.name && (
              <h2 className="group-title" id={headingId}>
                {section.name}
                <span className="group-count" aria-label={`${section.services.length} services`}>
                  {section.services.length}
                </span>
              </h2>
            )}
            {section.services.length === 0 ? (
              <p className="group-empty">No services in this group yet.</p>
            ) : (
              <div className="grid" data-columns={columns} data-size={cardSize}>
                {section.services.map((service) => (
                  <ServiceCard key={service.id} service={service} compact={cardSize === 'compact'} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
