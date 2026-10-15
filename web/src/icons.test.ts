import { ICON_NAMES } from '@nest/shared';
import { describe, expect, it } from 'vitest';
import { SERVICE_ICONS } from './icons.ts';

describe('icon map', () => {
  it('provides a component for every configurable icon name', () => {
    for (const name of ICON_NAMES) {
      expect(SERVICE_ICONS[name], name).toBeTypeOf('object');
    }
  });
});
