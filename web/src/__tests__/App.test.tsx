import { createDefaultConfig, type NestConfig } from '@nest/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App.tsx';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

interface MockOptions {
  config?: NestConfig;
  getResponse?: () => Response | Promise<Response>;
  putResponse?: (body: NestConfig) => Response;
}

function mockApi({ config = createDefaultConfig(), getResponse, putResponse }: MockOptions = {}): FetchMock {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/config' && (!init?.method || init.method === 'GET')) {
      return getResponse ? getResponse() : jsonResponse(config);
    }
    if (url === '/api/config' && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as NestConfig;
      return putResponse ? putResponse(body) : jsonResponse(body);
    }
    return jsonResponse({ error: 'not_found', message: 'Not found.' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function putBodies(fetchMock: FetchMock): NestConfig[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as NestConfig);
}

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
});

describe('dashboard rendering', () => {
  it('shows groups and service cards from the configuration', async () => {
    const config = createDefaultConfig();
    config.services[1]!.openInNewTab = true;
    config.services[2]!.enabled = false;
    mockApi({ config });
    render(<App />);

    expect(await screen.findByRole('heading', { name: /smart home/i })).toBeInTheDocument();
    const homeAssistant = screen.getByRole('link', { name: /home assistant/i });
    expect(homeAssistant).toHaveAttribute('href', 'http://homeassistant.local:8123');
    expect(homeAssistant).not.toHaveAttribute('target');

    const nodeRed = screen.getByRole('link', { name: /node-red/i });
    expect(nodeRed).toHaveAttribute('target', '_blank');
    expect(nodeRed).toHaveAccessibleName(/opens in a new tab/i);

    expect(screen.queryByRole('link', { name: /glances/i })).not.toBeInTheDocument();
    expect(screen.getByText('NEST · Your homelab, at a glance.')).toBeInTheDocument();
    expect(document.title).toBe('NEST');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#C6F277');
  });

  it('shows an empty state with a route to settings when nothing is configured', async () => {
    const config = createDefaultConfig();
    config.services = [];
    mockApi({ config });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: /no services yet/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add a service/i }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('applies the light theme and hides optional elements', async () => {
    const config = createDefaultConfig();
    config.dashboard.theme = 'light';
    config.dashboard.showSearch = false;
    config.dashboard.showFooter = false;
    config.dashboard.subtitle = '';
    mockApi({ config });
    render(<App />);

    await screen.findByRole('link', { name: /grafana/i });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/your homelab/i)).not.toBeInTheDocument();
  });
});

describe('error handling', () => {
  it('explains an unreadable configuration and offers to replace it', async () => {
    let calls = 0;
    const fetchMock = mockApi({
      getResponse: () => {
        calls += 1;
        return calls === 1
          ? jsonResponse({ error: 'invalid_config', message: '/data/config.json is not valid JSON' }, 500)
          : jsonResponse(createDefaultConfig());
      },
    });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: /configuration could not be read/i })).toBeInTheDocument();
    expect(screen.getByText(/is not valid JSON/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /replace with defaults/i }));
    expect(await screen.findByRole('link', { name: /grafana/i })).toBeInTheDocument();
    expect(putBodies(fetchMock)).toEqual([createDefaultConfig()]);
  });

  it('shows a retry screen when the server is unreachable', async () => {
    const fetchMock = vi.fn<() => Promise<Response>>(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: /not reachable/i })).toBeInTheDocument();
    fetchMock.mockImplementation(async () => jsonResponse(createDefaultConfig()));
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('link', { name: /grafana/i })).toBeInTheDocument();
  });
});

describe('search', () => {
  it('filters cards instantly, shows an empty result state and clears with Escape', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    const search = await screen.findByRole('searchbox', { name: /search services/i });

    await user.type(search, 'graf');
    expect(screen.getByRole('link', { name: /grafana/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /pi-hole/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /smart home/i })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'infra');
    expect(screen.getByRole('link', { name: /portainer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pi-hole/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /grafana/i })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByRole('heading', { name: /no results for/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(search).toHaveValue('');
    expect(screen.getAllByRole('link')).toHaveLength(6);

    await user.type(search, 'pi');
    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
  });

  it('focuses the search field with the "/" shortcut', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    const search = await screen.findByRole('searchbox', { name: /search services/i });
    await user.keyboard('/');
    expect(search).toHaveFocus();
    expect(search).toHaveValue('');
  });
});

describe('keyboard accessibility', () => {
  it('lets the keyboard reach the settings button, search and cards in order', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('link', { name: /home assistant/i });

    await user.tab();
    expect(screen.getByRole('button', { name: /open settings/i })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('searchbox')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: /home assistant/i })).toHaveFocus();

    // Opening the settings via keyboard and closing it returns focus to the trigger.
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole('tab', { name: 'General', selected: true })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /close settings/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: /open settings/i })).toHaveFocus());
  });
});

describe('settings', () => {
  it('adds a service, previews it live and persists it on save', async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /open settings/i }));
    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('tab', { name: 'Services' }));
    await user.click(within(dialog).getByRole('button', { name: /add service/i }));
    await user.type(within(dialog).getByLabelText('Name'), '  Jellyfin ');
    await user.type(within(dialog).getByLabelText('URL'), 'media.local');
    await user.click(within(dialog).getByRole('button', { name: /add service/i }));
    expect(within(dialog).getByText(/full URL starting with http/i)).toBeInTheDocument();
    expect(putBodies(fetchMock)).toHaveLength(0);

    await user.clear(within(dialog).getByLabelText('URL'));
    await user.type(within(dialog).getByLabelText('URL'), 'http://media.local:8096');
    await user.selectOptions(within(dialog).getByLabelText('Group'), 'Monitoring');
    await user.click(within(dialog).getByRole('radio', { name: 'Play' }));
    await user.click(within(dialog).getByRole('switch', { name: /open in a new tab/i }));
    await user.click(within(dialog).getByRole('button', { name: /add service/i }));

    // Live preview: the dashboard behind the drawer already shows the new card.
    expect(screen.getByRole('link', { name: /jellyfin/i })).toHaveAttribute('href', 'http://media.local:8096');
    expect(within(dialog).getByText('Unsaved changes')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));
    expect(await within(dialog).findByText('Saved.')).toBeInTheDocument();

    const [saved] = putBodies(fetchMock);
    const jellyfin = saved!.services.find((s) => s.name === 'Jellyfin');
    expect(jellyfin).toMatchObject({
      url: 'http://media.local:8096',
      groupId: 'monitoring',
      icon: 'Play',
      openInNewTab: true,
      enabled: true,
    });
    expect(saved!.services).toHaveLength(7);
  });

  it('edits, reorders, disables and deletes services', async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /open settings/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('tab', { name: 'Services' }));

    await user.click(within(dialog).getByRole('button', { name: 'Edit Grafana' }));
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Metrics');
    await user.click(within(dialog).getByRole('switch', { name: /enabled/i }));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(within(dialog).getByText('Metrics')).toBeInTheDocument();
    expect(within(dialog).getByText('Disabled')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /metrics/i })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Move Metrics up' }));
    await user.click(within(dialog).getByRole('button', { name: 'Delete Pi-hole' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Pi-hole'));

    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));
    await within(dialog).findByText('Saved.');
    const [saved] = putBodies(fetchMock);
    expect(saved!.services.map((s) => s.id)).toEqual(['home-assistant', 'node-red', 'grafana', 'glances', 'portainer']);
    expect(saved!.services.find((s) => s.id === 'grafana')).toMatchObject({ name: 'Metrics', enabled: false });
  });

  it('creates, renames, reorders and deletes groups', async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /open settings/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('tab', { name: 'Groups' }));

    await user.type(within(dialog).getByLabelText('New group name'), 'Media');
    await user.click(within(dialog).getByRole('button', { name: /add group/i }));
    await user.click(within(dialog).getByRole('button', { name: 'Move Media up' }));

    const inputs = within(dialog).getAllByLabelText('Group name');
    await user.clear(inputs[0]!);
    await user.type(inputs[0]!, 'Home');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Monitoring' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('2 services will move'));

    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));
    await within(dialog).findByText('Saved.');
    const [saved] = putBodies(fetchMock);
    expect(saved!.groups.map((g) => g.name)).toEqual(['Home', 'Media', 'Infrastructure']);
    expect(saved!.services.find((s) => s.id === 'grafana')!.groupId).toBeNull();
    expect(screen.getByRole('heading', { name: /other/i })).toBeInTheDocument();
  });

  it('updates general settings with a live preview and reports server errors', async () => {
    mockApi({ putResponse: () => jsonResponse({ error: 'invalid_config', message: 'dashboard.title: is required' }, 400) });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /open settings/i }));
    const dialog = screen.getByRole('dialog');

    const title = within(dialog).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Lab');
    expect(screen.getByText('Lab', { selector: '.brand-name' })).toBeInTheDocument();
    expect(document.title).toBe('Lab');

    await user.selectOptions(within(dialog).getByLabelText('Theme'), 'light');
    expect(document.documentElement.dataset.theme).toBe('light');

    const accent = within(dialog).getByLabelText('Accent color');
    await user.clear(accent);
    await user.type(accent, '#1D4ED8');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#1D4ED8');

    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));
    expect(await within(dialog).findByText('dashboard.title: is required')).toBeInTheDocument();
  });

  it('asks before discarding unsaved changes and resets to defaults after confirmation', async () => {
    const config = createDefaultConfig();
    config.dashboard.title = 'Custom';
    const fetchMock = mockApi({ config });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /open settings/i }));
    const dialog = screen.getByRole('dialog');

    await user.type(within(dialog).getByLabelText('Subtitle'), '!');
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(within(dialog).getByRole('button', { name: /close settings/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(within(dialog).getByRole('button', { name: /reset to defaults/i }));
    expect(putBodies(fetchMock)).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: /reset to defaults/i }));
    expect(await within(dialog).findByText('Defaults restored.')).toBeInTheDocument();
    expect(putBodies(fetchMock)).toEqual([createDefaultConfig()]);
    expect(screen.getByText('NEST', { selector: '.brand-name' })).toBeInTheDocument();
  });
});
