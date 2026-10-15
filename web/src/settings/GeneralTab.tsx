import {
  COLUMN_OPTIONS,
  LIMITS,
  THEMES,
  validateDashboardInput,
  type CardSize,
  type Columns,
  type DashboardSettings,
  type Theme,
} from '@nest/shared';
import { useId } from 'react';
import { RotateCcw } from '../icons.ts';
import { Field, Switch, describedBy } from './fields.tsx';

interface Props {
  dashboard: DashboardSettings;
  onChange: (patch: Partial<DashboardSettings>) => void;
  onReset: () => void;
  resetting: boolean;
}

const THEME_LABELS: Record<Theme, string> = { dark: 'Dark', light: 'Light', system: 'Match system' };

export function GeneralTab({ dashboard, onChange, onReset, resetting }: Props) {
  const id = useId();
  const errors = validateDashboardInput(dashboard);
  const bgFallback = dashboard.theme === 'light' ? '#f4f5f1' : '#101310';

  return (
    <div>
      <h3 className="section-title">Dashboard</h3>

      <Field id={`${id}-title`} label="Title" error={errors.title}>
        <input
          id={`${id}-title`}
          className="input"
          value={dashboard.title}
          maxLength={LIMITS.title}
          onChange={(event) => onChange({ title: event.target.value })}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={describedBy(`${id}-title`, Boolean(errors.title), false)}
          required
        />
      </Field>

      <Field id={`${id}-subtitle`} label="Subtitle" hint="Shown under the header. Leave empty to hide." error={errors.subtitle}>
        <input
          id={`${id}-subtitle`}
          className="input"
          value={dashboard.subtitle}
          maxLength={LIMITS.subtitle}
          onChange={(event) => onChange({ subtitle: event.target.value })}
          aria-describedby={describedBy(`${id}-subtitle`, Boolean(errors.subtitle), true)}
        />
      </Field>

      <Switch label="Show search" hint="A small search field for filtering services." checked={dashboard.showSearch} onChange={(showSearch) => onChange({ showSearch })} />

      <Switch label="Show footer" checked={dashboard.showFooter} onChange={(showFooter) => onChange({ showFooter })} />
      {dashboard.showFooter && (
        <Field id={`${id}-footer`} label="Footer text" error={errors.footerText}>
          <input
            id={`${id}-footer`}
            className="input"
            value={dashboard.footerText}
            maxLength={LIMITS.footerText}
            onChange={(event) => onChange({ footerText: event.target.value })}
          />
        </Field>
      )}

      <h3 className="section-title">Appearance</h3>

      <Field id={`${id}-theme`} label="Theme">
        <select
          id={`${id}-theme`}
          className="select"
          value={dashboard.theme}
          onChange={(event) => onChange({ theme: event.target.value as Theme })}
        >
          {THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {THEME_LABELS[theme]}
            </option>
          ))}
        </select>
      </Field>

      <Field id={`${id}-accent`} label="Accent color" error={errors.accentColor}>
        <div className="field-row">
          <input
            type="color"
            className="color-swatch"
            aria-label="Pick accent color"
            value={/^#[0-9a-f]{6}$/i.test(dashboard.accentColor) ? dashboard.accentColor : '#c6f277'}
            onChange={(event) => onChange({ accentColor: event.target.value.toUpperCase() })}
          />
          <input
            id={`${id}-accent`}
            className="input"
            value={dashboard.accentColor}
            maxLength={7}
            spellCheck={false}
            onChange={(event) => onChange({ accentColor: event.target.value })}
            aria-invalid={Boolean(errors.accentColor)}
            aria-describedby={describedBy(`${id}-accent`, Boolean(errors.accentColor), false)}
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ accentColor: '#C6F277' })}>
            Default
          </button>
        </div>
      </Field>

      <Field id={`${id}-background`} label="Background color" hint="Leave empty to use the theme background." error={errors.backgroundColor}>
        <div className="field-row">
          <input
            type="color"
            className="color-swatch"
            aria-label="Pick background color"
            value={/^#[0-9a-f]{6}$/i.test(dashboard.backgroundColor) ? dashboard.backgroundColor : bgFallback}
            onChange={(event) => onChange({ backgroundColor: event.target.value.toUpperCase() })}
          />
          <input
            id={`${id}-background`}
            className="input"
            value={dashboard.backgroundColor}
            maxLength={7}
            placeholder="Theme default"
            spellCheck={false}
            onChange={(event) => onChange({ backgroundColor: event.target.value })}
            aria-invalid={Boolean(errors.backgroundColor)}
            aria-describedby={describedBy(`${id}-background`, Boolean(errors.backgroundColor), true)}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!dashboard.backgroundColor}
            onClick={() => onChange({ backgroundColor: '' })}
          >
            Clear
          </button>
        </div>
      </Field>

      <Field
        id={`${id}-bgimage`}
        label="Background image URL"
        hint="Optional. Loaded by the browser from the given http/https address."
        error={errors.backgroundImageUrl}
      >
        <input
          id={`${id}-bgimage`}
          className="input"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={dashboard.backgroundImageUrl}
          onChange={(event) => onChange({ backgroundImageUrl: event.target.value.trim() })}
          aria-invalid={Boolean(errors.backgroundImageUrl)}
          aria-describedby={describedBy(`${id}-bgimage`, Boolean(errors.backgroundImageUrl), true)}
        />
      </Field>

      <h3 className="section-title">Layout</h3>

      <Field id={`${id}-columns`} label="Columns" hint="Automatic fits as many cards as the screen allows. Fixed counts shrink on smaller screens.">
        <select
          id={`${id}-columns`}
          className="select"
          value={String(dashboard.columns)}
          onChange={(event) => {
            const raw = event.target.value;
            onChange({ columns: raw === 'auto' ? 'auto' : (Number(raw) as Columns) });
          }}
        >
          {COLUMN_OPTIONS.map((option) => (
            <option key={option} value={String(option)}>
              {option === 'auto' ? 'Automatic' : `${option} columns`}
            </option>
          ))}
        </select>
      </Field>

      <div className="field">
        <span className="field-label" id={`${id}-size-label`}>
          Card size
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby={`${id}-size-label`}>
          {(['comfortable', 'compact'] as CardSize[]).map((size) => (
            <label key={size}>
              <input
                type="radio"
                name={`${id}-size`}
                value={size}
                checked={dashboard.cardSize === size}
                onChange={() => onChange({ cardSize: size })}
              />
              {size === 'comfortable' ? 'Comfortable' : 'Compact'}
            </label>
          ))}
        </div>
      </div>

      <Switch label="Show empty groups" hint="Keep groups visible even when they have no services." checked={dashboard.showEmptyGroups} onChange={(showEmptyGroups) => onChange({ showEmptyGroups })} />

      <div className="danger-zone">
        <p>Reset everything to the defaults NEST ships with. This removes all services and groups and is saved immediately.</p>
        <button type="button" className="btn btn-danger" style={{ borderColor: 'var(--border-strong)' }} onClick={onReset} disabled={resetting}>
          <RotateCcw size={15} aria-hidden="true" /> {resetting ? 'Resetting…' : 'Reset to defaults'}
        </button>
      </div>
    </div>
  );
}
