import { DEFAULT_ICON, LIMITS, generateId, type NestConfig, type Service } from '@nest/shared';
import { useState, type DragEvent } from 'react';
import { ServiceIcon } from '../components/ServiceIcon.tsx';
import { ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Trash } from '../icons.ts';
import { buildSections, moveServiceBefore, moveServiceWithinGroup } from '../lib/dashboard.ts';
import { ServiceForm } from './ServiceForm.tsx';

interface Props {
  config: NestConfig;
  onChange: (next: NestConfig) => void;
}

type View = { mode: 'list' } | { mode: 'edit'; service: Service; isNew: boolean };

function newService(): Service {
  return {
    id: generateId(),
    name: '',
    url: '',
    description: '',
    icon: DEFAULT_ICON,
    iconUrl: '',
    groupId: null,
    enabled: true,
    openInNewTab: false,
  };
}

export function ServicesTab({ config, onChange }: Props) {
  const [view, setView] = useState<View>({ mode: 'list' });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const setServices = (services: Service[]) => onChange({ ...config, services });

  if (view.mode === 'edit') {
    const { service, isNew } = view;
    return (
      <ServiceForm
        service={service}
        groups={config.groups}
        isNew={isNew}
        onCancel={() => setView({ mode: 'list' })}
        onSave={(updated) => {
          setServices(isNew ? [...config.services, updated] : config.services.map((s) => (s.id === updated.id ? updated : s)));
          setView({ mode: 'list' });
        }}
      />
    );
  }

  const sections = buildSections(config, { includeDisabled: true, showEmptyGroups: true });
  const atLimit = config.services.length >= LIMITS.maxServices;

  const remove = (service: Service) => {
    if (!window.confirm(`Delete “${service.name}”? This cannot be undone once you save.`)) return;
    setServices(config.services.filter((s) => s.id !== service.id));
  };

  const dragHandlers = (service: Service) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLLIElement>) => {
      setDragId(service.id);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', service.id);
    },
    onDragOver: (event: DragEvent<HTMLLIElement>) => {
      if (!dragId || dragId === service.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (overId !== service.id) setOverId(service.id);
    },
    onDragLeave: () => {
      if (overId === service.id) setOverId(null);
    },
    onDrop: (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      const source = dragId ?? event.dataTransfer.getData('text/plain');
      if (source) setServices(moveServiceBefore(config.services, source, service.id));
      setDragId(null);
      setOverId(null);
    },
    onDragEnd: () => {
      setDragId(null);
      setOverId(null);
    },
  });

  return (
    <div>
      <div className="list-toolbar">
        <p>
          {config.services.length} {config.services.length === 1 ? 'service' : 'services'}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={atLimit}
          title={atLimit ? `Maximum of ${LIMITS.maxServices} services reached` : undefined}
          onClick={() => setView({ mode: 'edit', service: newService(), isNew: true })}
        >
          <Plus size={15} aria-hidden="true" /> Add service
        </button>
      </div>

      {config.services.length === 0 && <p className="list-empty">No services yet. Add your first one above.</p>}

      {sections.map((section) => {
        if (section.services.length === 0 && section.id !== null && config.services.length === 0) return null;
        return (
          <div key={section.id ?? '__other'} className="list-group">
            {section.name && <h3 className="list-group-title">{section.name}</h3>}
            {section.services.length === 0 ? (
              <p className="group-empty">Empty group</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {section.services.map((service, index) => (
                  <li
                    key={service.id}
                    className="item"
                    data-disabled={!service.enabled}
                    data-dragging={dragId === service.id}
                    data-dragover={overId === service.id}
                    {...dragHandlers(service)}
                  >
                    <span className="item-handle" aria-hidden="true" title="Drag to reorder">
                      <GripVertical size={16} />
                    </span>
                    <span className="item-icon" aria-hidden="true">
                      <ServiceIcon service={service} size={15} />
                    </span>
                    <span className="item-text">
                      <span className="item-name">
                        {service.name}
                        {!service.enabled && <span className="badge">Disabled</span>}
                      </span>
                      <span className="item-meta">{service.url}</span>
                    </span>
                    <span className="item-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label={`Move ${service.name} up`}
                        disabled={index === 0}
                        onClick={() => setServices(moveServiceWithinGroup(config.services, service.id, -1))}
                      >
                        <ChevronUp size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label={`Move ${service.name} down`}
                        disabled={index === section.services.length - 1}
                        onClick={() => setServices(moveServiceWithinGroup(config.services, service.id, 1))}
                      >
                        <ChevronDown size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label={`Edit ${service.name}`}
                        onClick={() => setView({ mode: 'edit', service, isNew: false })}
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-icon btn-sm"
                        aria-label={`Delete ${service.name}`}
                        onClick={() => remove(service)}
                      >
                        <Trash size={15} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
