import type { Group, NestConfig, Service, Theme } from '@nest/shared';

export const UNGROUPED_NAME = 'Other';

export interface Section {
  /** Group id, or null for the default section holding ungrouped services. */
  id: string | null;
  name: string;
  services: Service[];
}

/**
 * Groups services into dashboard sections, preserving group order and the
 * global service order within each group. Services without a (valid) group
 * land in the default section at the end.
 */
export function buildSections(
  config: Pick<NestConfig, 'groups' | 'services'>,
  options: { includeDisabled?: boolean; showEmptyGroups?: boolean } = {},
): Section[] {
  const { includeDisabled = false, showEmptyGroups = false } = options;
  const groupIds = new Set(config.groups.map((g) => g.id));
  const byGroup = new Map<string | null, Service[]>();
  for (const service of config.services) {
    if (!includeDisabled && !service.enabled) continue;
    const key = service.groupId !== null && groupIds.has(service.groupId) ? service.groupId : null;
    const list = byGroup.get(key) ?? [];
    list.push(service);
    byGroup.set(key, list);
  }

  const sections: Section[] = [];
  for (const group of config.groups) {
    const services = byGroup.get(group.id) ?? [];
    if (services.length > 0 || showEmptyGroups) sections.push({ id: group.id, name: group.name, services });
  }
  const ungrouped = byGroup.get(null) ?? [];
  if (ungrouped.length > 0) {
    sections.push({ id: null, name: config.groups.length > 0 ? UNGROUPED_NAME : '', services: ungrouped });
  }
  return sections;
}

export function matchesQuery(service: Service, groupName: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    service.name.toLowerCase().includes(q) ||
    service.description.toLowerCase().includes(q) ||
    groupName.toLowerCase().includes(q)
  );
}

/** Filters sections by a search query; sections without matches are dropped. */
export function filterSections(sections: Section[], query: string): Section[] {
  if (!query.trim()) return sections;
  return sections
    .map((section) => ({ ...section, services: section.services.filter((s) => matchesQuery(s, section.name, query)) }))
    .filter((section) => section.services.length > 0);
}

/** Moves a service one step up or down among the services of its own group. */
export function moveServiceWithinGroup(services: Service[], id: string, direction: -1 | 1): Service[] {
  const index = services.findIndex((s) => s.id === id);
  if (index === -1) return services;
  const current = services[index]!;
  let neighbour = -1;
  if (direction === -1) {
    for (let i = index - 1; i >= 0; i -= 1) {
      if (services[i]!.groupId === current.groupId) {
        neighbour = i;
        break;
      }
    }
  } else {
    for (let i = index + 1; i < services.length; i += 1) {
      if (services[i]!.groupId === current.groupId) {
        neighbour = i;
        break;
      }
    }
  }
  if (neighbour === -1) return services;
  const next = services.slice();
  next[index] = services[neighbour]!;
  next[neighbour] = current;
  return next;
}

/**
 * Drops the service `id` directly before `targetId`, adopting the target's
 * group. Used by drag and drop.
 */
export function moveServiceBefore(services: Service[], id: string, targetId: string): Service[] {
  if (id === targetId) return services;
  const moving = services.find((s) => s.id === id);
  const target = services.find((s) => s.id === targetId);
  if (!moving || !target) return services;
  const without = services.filter((s) => s.id !== id);
  const targetIndex = without.findIndex((s) => s.id === targetId);
  const next = without.slice();
  next.splice(targetIndex, 0, { ...moving, groupId: target.groupId });
  return next;
}

export function moveItem<T extends { id: string }>(items: T[], id: string, direction: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= items.length) return items;
  const next = items.slice();
  next[index] = items[target]!;
  next[target] = items[index]!;
  return next;
}

/** Removes a group and detaches its services so they fall back to the default section. */
export function removeGroup(config: NestConfig, groupId: string): NestConfig {
  return {
    ...config,
    groups: config.groups.filter((g) => g.id !== groupId),
    services: config.services.map((s) => (s.groupId === groupId ? { ...s, groupId: null } : s)),
  };
}

export function groupName(groups: Group[], groupId: string | null): string {
  if (groupId === null) return UNGROUPED_NAME;
  return groups.find((g) => g.id === groupId)?.name ?? UNGROUPED_NAME;
}

export function resolveTheme(theme: Theme, prefersDark: boolean): 'dark' | 'light' {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return prefersDark ? 'dark' : 'light';
}

/** Picks a text color that stays readable on the given accent color. */
export function accentContrast(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return '#101310';
  const value = Number.parseInt(match[1]!, 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255);
  return luminance > 0.4 ? '#101310' : '#F0F2EC';
}

export function configsEqual(a: NestConfig | null, b: NestConfig | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
