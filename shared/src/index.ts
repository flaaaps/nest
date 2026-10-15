/**
 * Shared types, defaults and validation helpers used by both the NEST
 * server and the web UI. This package has no runtime dependencies.
 */

export const CONFIG_VERSION = 1 as const;

export type Theme = 'dark' | 'light' | 'system';
export type CardSize = 'compact' | 'comfortable';
export type Columns = 'auto' | 2 | 3 | 4 | 5 | 6;

export const THEMES: readonly Theme[] = ['dark', 'light', 'system'];
export const CARD_SIZES: readonly CardSize[] = ['compact', 'comfortable'];
export const COLUMN_OPTIONS: readonly Columns[] = ['auto', 2, 3, 4, 5, 6];

export interface DashboardSettings {
  /** Shown in the header next to the logo and used as the page title. */
  title: string;
  /** Optional welcome line shown under the header. Empty string hides it. */
  subtitle: string;
  theme: Theme;
  /** Six-digit hex color, e.g. #C6F277. */
  accentColor: string;
  columns: Columns;
  cardSize: CardSize;
  showSearch: boolean;
  showFooter: boolean;
  footerText: string;
  /** Six-digit hex color or empty string for the theme default. */
  backgroundColor: string;
  /** http(s) URL or empty string. Disabled (empty) by default. */
  backgroundImageUrl: string;
  /** Keep groups visible on the dashboard even when they have no services. */
  showEmptyGroups: boolean;
}

export interface Group {
  id: string;
  name: string;
}

export interface Service {
  id: string;
  name: string;
  url: string;
  description: string;
  /** Name of a built-in icon, see ICON_NAMES. */
  icon: IconName;
  /** Optional custom image URL (http/https). Takes precedence over `icon`. */
  iconUrl: string;
  /** Group id or null for the default section. */
  groupId: string | null;
  enabled: boolean;
  openInNewTab: boolean;
}

export interface NestConfig {
  version: typeof CONFIG_VERSION;
  dashboard: DashboardSettings;
  groups: Group[];
  services: Service[];
}

export const LIMITS = {
  title: 60,
  subtitle: 160,
  footerText: 200,
  serviceName: 60,
  serviceDescription: 140,
  groupName: 40,
  url: 2048,
  maxServices: 200,
  maxGroups: 50,
} as const;

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Built-in icons available to services (Lucide icon names). */
export const ICON_NAMES = [
  'Activity',
  'AppWindow',
  'Archive',
  'ChartColumn',
  'Bell',
  'BookOpen',
  'Bot',
  'Box',
  'Bug',
  'Calendar',
  'Camera',
  'ChartLine',
  'Clock',
  'Cloud',
  'Code',
  'Container',
  'Cpu',
  'Database',
  'Download',
  'Fan',
  'FileText',
  'Film',
  'Flame',
  'Folder',
  'Gauge',
  'GitBranch',
  'Globe',
  'HardDrive',
  'House',
  'Image',
  'Key',
  'Lamp',
  'Layers',
  'LayoutGrid',
  'Lightbulb',
  'Link',
  'Lock',
  'Mail',
  'Map',
  'MessageSquare',
  'Monitor',
  'Music',
  'Network',
  'Package',
  'Play',
  'Plug',
  'Power',
  'Printer',
  'Radio',
  'Router',
  'Rss',
  'Server',
  'Settings',
  'Shield',
  'ShoppingCart',
  'Smartphone',
  'Speaker',
  'Terminal',
  'Thermometer',
  'Tv',
  'Upload',
  'Video',
  'Wifi',
  'Workflow',
  'Wrench',
  'Zap',
] as const;

export type IconName = (typeof ICON_NAMES)[number];
export const DEFAULT_ICON: IconName = 'Box';

export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && (ICON_NAMES as readonly string[]).includes(value);
}

/** True for absolute http:// or https:// URLs with a host. */
export function isValidHttpUrl(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0 || value.length > LIMITS.url) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0;
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

export function generateId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback for very old runtimes: not cryptographically strong, but ids only need to be unique.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_ACCENT = '#C6F277';

export function createDefaultDashboardSettings(): DashboardSettings {
  return {
    title: 'NEST',
    subtitle: 'Your homelab, at a glance.',
    theme: 'dark',
    accentColor: DEFAULT_ACCENT,
    columns: 'auto',
    cardSize: 'comfortable',
    showSearch: true,
    showFooter: true,
    footerText: 'NEST · Your homelab, at a glance.',
    backgroundColor: '',
    backgroundImageUrl: '',
    showEmptyGroups: false,
  };
}

/**
 * The configuration NEST ships with. The example services are illustrative
 * only: hostnames, ports and paths must be adapted to the user's network.
 */
export function createDefaultConfig(): NestConfig {
  const service = (
    id: string,
    name: string,
    url: string,
    description: string,
    icon: IconName,
    groupId: string,
  ): Service => ({
    id,
    name,
    url,
    description,
    icon,
    iconUrl: '',
    groupId,
    enabled: true,
    openInNewTab: false,
  });

  return {
    version: CONFIG_VERSION,
    dashboard: createDefaultDashboardSettings(),
    groups: [
      { id: 'smart-home', name: 'Smart Home' },
      { id: 'monitoring', name: 'Monitoring' },
      { id: 'infrastructure', name: 'Infrastructure' },
    ],
    services: [
      service('home-assistant', 'Home Assistant', 'http://homeassistant.local:8123', 'Home automation hub', 'House', 'smart-home'),
      service('node-red', 'Node-RED', 'http://nodered.local:1880', 'Flow-based automation', 'Workflow', 'smart-home'),
      service('glances', 'Glances', 'http://raspberrypi.local:61208', 'System resource overview', 'Gauge', 'monitoring'),
      service('grafana', 'Grafana', 'http://raspberrypi.local:3000', 'Metrics and dashboards', 'ChartLine', 'monitoring'),
      service('portainer', 'Portainer', 'http://raspberrypi.local:9000', 'Container management', 'Container', 'infrastructure'),
      service('pi-hole', 'Pi-hole', 'http://pi.hole/admin', 'Network-wide ad blocking', 'Shield', 'infrastructure'),
    ],
  };
}

export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

/** Client-side validation for the service form. Mirrors the server schema. */
export function validateServiceInput(input: {
  name: string;
  url: string;
  description: string;
  iconUrl: string;
}): FieldErrors<'name' | 'url' | 'description' | 'iconUrl'> {
  const errors: FieldErrors<'name' | 'url' | 'description' | 'iconUrl'> = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Name is required.';
  else if (name.length > LIMITS.serviceName) errors.name = `Name must be ${LIMITS.serviceName} characters or fewer.`;

  const url = input.url.trim();
  if (!url) errors.url = 'URL is required.';
  else if (!isValidHttpUrl(url)) errors.url = 'Enter a full URL starting with http:// or https://.';

  if (input.description.trim().length > LIMITS.serviceDescription) {
    errors.description = `Description must be ${LIMITS.serviceDescription} characters or fewer.`;
  }

  const iconUrl = input.iconUrl.trim();
  if (iconUrl && !isValidHttpUrl(iconUrl)) errors.iconUrl = 'Icon URL must start with http:// or https://.';

  return errors;
}

export function validateGroupName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return 'Group name is required.';
  if (trimmed.length > LIMITS.groupName) return `Group name must be ${LIMITS.groupName} characters or fewer.`;
  return undefined;
}

export function validateDashboardInput(
  d: DashboardSettings,
): FieldErrors<'title' | 'subtitle' | 'footerText' | 'accentColor' | 'backgroundColor' | 'backgroundImageUrl'> {
  const errors: ReturnType<typeof validateDashboardInput> = {};
  if (!d.title.trim()) errors.title = 'Title is required.';
  else if (d.title.length > LIMITS.title) errors.title = `Title must be ${LIMITS.title} characters or fewer.`;
  if (d.subtitle.length > LIMITS.subtitle) errors.subtitle = `Subtitle must be ${LIMITS.subtitle} characters or fewer.`;
  if (d.footerText.length > LIMITS.footerText) errors.footerText = `Footer must be ${LIMITS.footerText} characters or fewer.`;
  if (!isHexColor(d.accentColor)) errors.accentColor = 'Use a six-digit hex color like #C6F277.';
  if (d.backgroundColor && !isHexColor(d.backgroundColor)) errors.backgroundColor = 'Use a six-digit hex color or leave empty.';
  if (d.backgroundImageUrl && !isValidHttpUrl(d.backgroundImageUrl)) {
    errors.backgroundImageUrl = 'Background image must be an http:// or https:// URL.';
  }
  return errors;
}
