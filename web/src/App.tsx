import {
  createDefaultConfig,
  validateDashboardInput,
  validateGroupName,
  validateServiceInput,
  type NestConfig,
} from '@nest/shared';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api, ApiError } from './api.ts';
import { Dashboard } from './components/Dashboard.tsx';
import { Header } from './components/Header.tsx';
import { SearchField } from './components/SearchField.tsx';
import { StatusScreen } from './components/StatusScreen.tsx';
import { SettingsDrawer, type SaveResult } from './settings/SettingsDrawer.tsx';
import { applyAppearance } from './theme.ts';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'invalid'; message: string }
  | { status: 'unreachable'; message: string };

const darkQuery = '(prefers-color-scheme: dark)';
function subscribeToScheme(callback: () => void) {
  const media = window.matchMedia(darkQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribeToScheme, () => window.matchMedia(darkQuery).matches);
}

/** Returns the first human-readable validation problem in a draft, if any. */
export function findDraftProblem(draft: NestConfig): string | null {
  const dashboardErrors = validateDashboardInput(draft.dashboard);
  const firstDashboard = Object.values(dashboardErrors)[0];
  if (firstDashboard) return `General: ${firstDashboard}`;
  for (const group of draft.groups) {
    const error = validateGroupName(group.name);
    if (error) return `Groups: ${error}`;
  }
  for (const service of draft.services) {
    const first = Object.values(validateServiceInput(service))[0];
    if (first) return `${service.name.trim() || 'Service'}: ${first}`;
  }
  return null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [saved, setSaved] = useState<NestConfig | null>(null);
  const [draft, setDraft] = useState<NestConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const prefersDark = usePrefersDark();
  const searchRef = useRef<HTMLInputElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const view = draft ?? saved;

  const loadConfig = useCallback(async () => {
    setLoad({ status: 'loading' });
    try {
      const config = await api.getConfig();
      setSaved(config);
      setLoad({ status: 'ready' });
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('Unexpected error.', 0, 'error');
      if (apiError.code === 'invalid_config') setLoad({ status: 'invalid', message: apiError.message });
      else setLoad({ status: 'unreachable', message: apiError.message });
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (view) applyAppearance(view.dashboard, prefersDark);
  }, [view, prefersDark]);

  // "/" focuses the search field, like many developer tools.
  useEffect(() => {
    if (!view?.dashboard.showSearch || settingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditableTarget(event.target)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view?.dashboard.showSearch, settingsOpen]);

  const dirty = settingsOpen && draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const openSettings = () => {
    if (!saved) return;
    setDraft(structuredClone(saved));
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    setDraft(null);
    // Return focus to where the user came from.
    requestAnimationFrame(() => settingsButtonRef.current?.focus());
  };

  const persist = async (config: NestConfig): Promise<SaveResult> => {
    try {
      const result = await api.saveConfig(config);
      setSaved(result);
      setDraft(result);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Saving failed.' };
    }
  };

  const saveDraft = async (): Promise<SaveResult> => {
    if (!draft) return { ok: false, message: 'Nothing to save.' };
    const problem = findDraftProblem(draft);
    if (problem) return { ok: false, message: problem };
    return persist(draft);
  };

  const resetToDefaults = () => persist(createDefaultConfig());

  const replaceInvalidConfig = async () => {
    setConfirmReplace(false);
    const result = await persist(createDefaultConfig());
    if (result.ok) setLoad({ status: 'ready' });
    else setReplaceError(result.message);
  };

  if (load.status === 'loading') {
    return (
      <div className="status-screen">
        <p className="status-loading" role="status">
          Loading NEST…
        </p>
      </div>
    );
  }

  if (load.status === 'invalid') {
    return (
      <StatusScreen
        title="Configuration could not be read"
        message="NEST refused to start with this configuration and left the file untouched. Fix it by hand, or replace it with the defaults."
        detail={replaceError ? `${load.message}\n\n${replaceError}` : load.message}
        actions={
          confirmReplace ? (
            <>
              <span className="status-note">The old file is kept as a backup.</span>
              <button type="button" className="btn" autoFocus onClick={() => setConfirmReplace(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger-solid" onClick={() => void replaceInvalidConfig()}>
                Yes, replace
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={() => void loadConfig()}>
                Reload
              </button>
              <button type="button" className="btn" onClick={() => setConfirmReplace(true)}>
                Replace with defaults
              </button>
            </>
          )
        }
      />
    );
  }

  if (load.status === 'unreachable' || !view) {
    return (
      <StatusScreen
        title="NEST is not reachable"
        message={load.status === 'unreachable' ? load.message : 'The configuration could not be loaded.'}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => void loadConfig()}>
            Try again
          </button>
        }
      />
    );
  }

  const { dashboard } = view;

  return (
    <div className="app">
      <div className="container">
        <Header title={dashboard.title} onOpenSettings={openSettings} settingsButtonRef={settingsButtonRef} />
      </div>
      <main className="main container">
        {(dashboard.subtitle || dashboard.showSearch) && (
          <div className="intro">
            {dashboard.subtitle ? <p className="subtitle">{dashboard.subtitle}</p> : <span />}
            {dashboard.showSearch && <SearchField value={query} onChange={setQuery} inputRef={searchRef} />}
          </div>
        )}
        <Dashboard
          config={view}
          query={dashboard.showSearch ? query : ''}
          onClearSearch={() => {
            setQuery('');
            searchRef.current?.focus();
          }}
          onOpenSettings={openSettings}
        />
      </main>
      {dashboard.showFooter && dashboard.footerText && (
        <footer className="footer">
          <div className="container">{dashboard.footerText}</div>
        </footer>
      )}
      <SettingsDrawer
        open={settingsOpen}
        draft={draft}
        dirty={dirty}
        onChange={setDraft}
        onClose={closeSettings}
        onSave={saveDraft}
        onReset={resetToDefaults}
      />
    </div>
  );
}
