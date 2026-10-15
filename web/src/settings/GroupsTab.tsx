import { LIMITS, generateId, validateGroupName, type Group, type NestConfig } from '@nest/shared';
import { useId, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash } from '../icons.ts';
import { moveItem, removeGroup } from '../lib/dashboard.ts';

interface Props {
  config: NestConfig;
  onChange: (next: NestConfig) => void;
}

export function GroupsTab({ config, onChange }: Props) {
  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState<string | undefined>();
  const id = useId();
  const atLimit = config.groups.length >= LIMITS.maxGroups;

  const setGroups = (groups: Group[]) => onChange({ ...config, groups });

  const add = (event: FormEvent) => {
    event.preventDefault();
    const error = validateGroupName(newName);
    if (error) {
      setNewError(error);
      return;
    }
    setGroups([...config.groups, { id: generateId(), name: newName.trim() }]);
    setNewName('');
    setNewError(undefined);
  };

  const remove = (group: Group) => {
    const count = config.services.filter((s) => s.groupId === group.id).length;
    const note = count > 0 ? ` ${count} ${count === 1 ? 'service' : 'services'} will move to “Other”.` : '';
    if (!window.confirm(`Delete group “${group.name}”?${note}`)) return;
    onChange(removeGroup(config, group.id));
  };

  return (
    <div>
      <div className="list-toolbar">
        <p>Groups organise services into sections. Services without a group appear under “Other”.</p>
      </div>

      {config.groups.length === 0 ? (
        <p className="list-empty">No groups yet. Services are shown in a single list.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {config.groups.map((group, index) => {
            const error = validateGroupName(group.name);
            const count = config.services.filter((s) => s.groupId === group.id).length;
            return (
              <li key={group.id} className="item">
                <span className="item-text">
                  <label className="sr-only" htmlFor={`${id}-${group.id}`}>
                    Group name
                  </label>
                  <input
                    id={`${id}-${group.id}`}
                    className="input"
                    value={group.name}
                    maxLength={LIMITS.groupName}
                    aria-invalid={Boolean(error)}
                    onChange={(event) =>
                      setGroups(config.groups.map((g) => (g.id === group.id ? { ...g, name: event.target.value } : g)))
                    }
                  />
                  {error ? (
                    <span className="field-error">{error}</span>
                  ) : (
                    <span className="item-meta">
                      {count} {count === 1 ? 'service' : 'services'}
                    </span>
                  )}
                </span>
                <span className="item-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    aria-label={`Move ${group.name} up`}
                    disabled={index === 0}
                    onClick={() => setGroups(moveItem(config.groups, group.id, -1))}
                  >
                    <ChevronUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    aria-label={`Move ${group.name} down`}
                    disabled={index === config.groups.length - 1}
                    onClick={() => setGroups(moveItem(config.groups, group.id, 1))}
                  >
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-icon btn-sm"
                    aria-label={`Delete ${group.name}`}
                    onClick={() => remove(group)}
                  >
                    <Trash size={15} aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form className="inline-form" onSubmit={add} noValidate>
        <label className="sr-only" htmlFor={`${id}-new`}>
          New group name
        </label>
        <input
          id={`${id}-new`}
          className="input"
          placeholder="New group name"
          value={newName}
          maxLength={LIMITS.groupName}
          disabled={atLimit}
          aria-invalid={Boolean(newError)}
          aria-describedby={newError ? `${id}-new-error` : undefined}
          onChange={(event) => {
            setNewName(event.target.value);
            setNewError(undefined);
          }}
        />
        <button type="submit" className="btn" disabled={atLimit}>
          <Plus size={15} aria-hidden="true" /> Add group
        </button>
      </form>
      {newError && (
        <p className="field-error" id={`${id}-new-error`} role="alert" style={{ marginTop: 6 }}>
          {newError}
        </p>
      )}
    </div>
  );
}
