import { ICON_NAMES, type IconName } from '@nest/shared';
import { useId } from 'react';
import { SERVICE_ICONS } from '../icons.ts';

interface Props {
  value: IconName;
  onChange: (icon: IconName) => void;
}

/** A radio group rendered as an icon grid; arrow keys move between icons. */
export function IconPicker({ value, onChange }: Props) {
  const name = useId();
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
      <legend className="field-label">Icon</legend>
      <div className="icon-grid">
        {ICON_NAMES.map((iconName) => {
          const Icon = SERVICE_ICONS[iconName];
          return (
            <label key={iconName} className="icon-option" title={iconName}>
              <input
                type="radio"
                name={name}
                value={iconName}
                checked={value === iconName}
                onChange={() => onChange(iconName)}
                aria-label={iconName}
              />
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
