import { createDefaultConfig, type Service } from '@nest/shared';
import { describe, expect, it } from 'vitest';
import {
  accentContrast,
  buildSections,
  filterSections,
  moveItem,
  moveServiceBefore,
  moveServiceWithinGroup,
  removeGroup,
  resolveTheme,
} from './dashboard.ts';

const service = (id: string, groupId: string | null, enabled = true): Service => ({
  id,
  name: id,
  url: `http://${id}.local`,
  description: '',
  icon: 'Box',
  iconUrl: '',
  groupId,
  enabled,
  openInNewTab: false,
});

describe('buildSections', () => {
  it('groups enabled services in group order and appends ungrouped ones', () => {
    const sections = buildSections({
      groups: [
        { id: 'b', name: 'B' },
        { id: 'a', name: 'A' },
      ],
      services: [service('s1', 'a'), service('s2', null), service('s3', 'b'), service('s4', 'a', false), service('s5', 'ghost')],
    });
    expect(sections.map((s) => [s.name, s.services.map((x) => x.id)])).toEqual([
      ['B', ['s3']],
      ['A', ['s1']],
      ['Other', ['s2', 's5']],
    ]);
  });

  it('hides empty groups unless asked to show them', () => {
    const config = { groups: [{ id: 'empty', name: 'Empty' }], services: [service('s1', null)] };
    expect(buildSections(config).map((s) => s.name)).toEqual(['Other']);
    expect(buildSections(config, { showEmptyGroups: true }).map((s) => s.name)).toEqual(['Empty', 'Other']);
  });

  it('uses no heading when there are no groups at all', () => {
    const sections = buildSections({ groups: [], services: [service('s1', null)] });
    expect(sections).toHaveLength(1);
    expect(sections[0]!.name).toBe('');
  });

  it('can include disabled services for the settings list', () => {
    const sections = buildSections({ groups: [], services: [service('s1', null, false)] }, { includeDisabled: true });
    expect(sections[0]!.services).toHaveLength(1);
  });
});

describe('filterSections', () => {
  const sections = buildSections(createDefaultConfig());

  it('matches name, description and group name case-insensitively', () => {
    expect(filterSections(sections, 'GRAFANA').flatMap((s) => s.services.map((x) => x.name))).toEqual(['Grafana']);
    expect(filterSections(sections, 'ad blocking').flatMap((s) => s.services.map((x) => x.name))).toEqual(['Pi-hole']);
    expect(filterSections(sections, 'smart').map((s) => s.name)).toEqual(['Smart Home']);
  });

  it('returns everything for a blank query and nothing for a miss', () => {
    expect(filterSections(sections, '   ')).toBe(sections);
    expect(filterSections(sections, 'nothing-here')).toEqual([]);
  });
});

describe('reordering', () => {
  const services = [service('a1', 'a'), service('b1', 'b'), service('a2', 'a'), service('a3', 'a')];

  it('moves within a group, skipping other groups', () => {
    expect(moveServiceWithinGroup(services, 'a2', -1).map((s) => s.id)).toEqual(['a2', 'b1', 'a1', 'a3']);
    expect(moveServiceWithinGroup(services, 'a1', 1).map((s) => s.id)).toEqual(['a2', 'b1', 'a1', 'a3']);
    expect(moveServiceWithinGroup(services, 'a1', -1)).toBe(services);
    expect(moveServiceWithinGroup(services, 'b1', 1)).toBe(services);
  });

  it('drops a service before a target and adopts its group', () => {
    const next = moveServiceBefore(services, 'a3', 'b1');
    expect(next.map((s) => s.id)).toEqual(['a1', 'a3', 'b1', 'a2']);
    expect(next[1]!.groupId).toBe('b');
    expect(moveServiceBefore(services, 'a1', 'a1')).toBe(services);
  });

  it('moves groups up and down within bounds', () => {
    const groups = [
      { id: 'x', name: 'X' },
      { id: 'y', name: 'Y' },
    ];
    expect(moveItem(groups, 'y', -1).map((g) => g.id)).toEqual(['y', 'x']);
    expect(moveItem(groups, 'x', -1)).toBe(groups);
  });
});

describe('removeGroup', () => {
  it('detaches services from a deleted group', () => {
    const config = createDefaultConfig();
    const next = removeGroup(config, 'monitoring');
    expect(next.groups.map((g) => g.id)).toEqual(['smart-home', 'infrastructure']);
    expect(next.services.find((s) => s.id === 'grafana')!.groupId).toBeNull();
    expect(next.services.find((s) => s.id === 'portainer')!.groupId).toBe('infrastructure');
  });
});

describe('theme helpers', () => {
  it('resolves the system theme from the media query', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('chooses dark text on light accents and light text on dark accents', () => {
    expect(accentContrast('#C6F277')).toBe('#101310');
    expect(accentContrast('#1d4ed8')).toBe('#F0F2EC');
    expect(accentContrast('nonsense')).toBe('#101310');
  });
});
