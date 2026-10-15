import { validateServiceInput, type Group, type Service } from '@nest/shared';
import { useId, useState, type FormEvent } from 'react';
import { ServiceIcon } from '../components/ServiceIcon.tsx';
import { Field, Switch, describedBy } from './fields.tsx';
import { IconPicker } from './IconPicker.tsx';

/** The drawer footer submits this form from outside via the `form` attribute. */
export const SERVICE_FORM_ID = 'service-form';

interface Props {
  service: Service;
  groups: Group[];
  isNew: boolean;
  onSave: (service: Service) => void;
}

export function ServiceForm({ service, groups, isNew, onSave }: Props) {
  const [form, setForm] = useState<Service>(service);
  const [submitted, setSubmitted] = useState(false);
  const id = useId();
  const errors = submitted ? validateServiceInput(form) : {};
  const update = (patch: Partial<Service>) => setForm((current) => ({ ...current, ...patch }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const problems = validateServiceInput(form);
    if (Object.keys(problems).length > 0) {
      document.querySelector<HTMLElement>(`#${CSS.escape(id)}-${Object.keys(problems)[0]}`)?.focus();
      return;
    }
    onSave({
      ...form,
      name: form.name.trim(),
      url: form.url.trim(),
      description: form.description.trim(),
      iconUrl: form.iconUrl.trim(),
    });
  };

  return (
    <form id={SERVICE_FORM_ID} onSubmit={submit} noValidate>
      <div className="form-header">
        <h3>{isNew ? 'Add service' : 'Edit service'}</h3>
      </div>

      <Field id={`${id}-name`} label="Name" error={errors.name}>
        <input
          id={`${id}-name`}
          className="input"
          value={form.name}
          onChange={(event) => update({ name: event.target.value })}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy(`${id}-name`, Boolean(errors.name), false)}
          autoFocus
          required
        />
      </Field>

      <Field id={`${id}-url`} label="URL" hint="Full address, e.g. http://raspberrypi.local:8123" error={errors.url}>
        <input
          id={`${id}-url`}
          className="input"
          type="url"
          inputMode="url"
          placeholder="http://"
          value={form.url}
          onChange={(event) => update({ url: event.target.value })}
          aria-invalid={Boolean(errors.url)}
          aria-describedby={describedBy(`${id}-url`, Boolean(errors.url), true)}
          required
        />
      </Field>

      <Field id={`${id}-description`} label="Description" hint="Optional, one short line." error={errors.description}>
        <input
          id={`${id}-description`}
          className="input"
          value={form.description}
          onChange={(event) => update({ description: event.target.value })}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={describedBy(`${id}-description`, Boolean(errors.description), true)}
        />
      </Field>

      <Field id={`${id}-group`} label="Group">
        <select
          id={`${id}-group`}
          className="select"
          value={form.groupId ?? ''}
          onChange={(event) => update({ groupId: event.target.value === '' ? null : event.target.value })}
        >
          <option value="">No group</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </Field>

      <IconPicker value={form.icon} onChange={(icon) => update({ icon })} />

      <Field
        id={`${id}-iconUrl`}
        label="Custom icon URL"
        hint="Optional image or SVG (http/https). Replaces the built-in icon; falls back if it cannot load."
        error={errors.iconUrl}
      >
        <div className="field-row">
          <span className="item-icon" aria-hidden="true">
            <ServiceIcon service={form} size={16} />
          </span>
          <input
            id={`${id}-iconUrl`}
            className="input"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={form.iconUrl}
            onChange={(event) => update({ iconUrl: event.target.value })}
            aria-invalid={Boolean(errors.iconUrl)}
            aria-describedby={describedBy(`${id}-iconUrl`, Boolean(errors.iconUrl), true)}
          />
        </div>
      </Field>

      <Switch label="Enabled" hint="Disabled services stay configured but are hidden." checked={form.enabled} onChange={(enabled) => update({ enabled })} />
      <Switch label="Open in a new tab" checked={form.openInNewTab} onChange={(openInNewTab) => update({ openInNewTab })} />
    </form>
  );
}
