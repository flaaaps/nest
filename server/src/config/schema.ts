import { z } from 'zod';
import {
  CONFIG_VERSION,
  HEX_COLOR_PATTERN,
  ICON_NAMES,
  ID_PATTERN,
  LIMITS,
  isValidHttpUrl,
  type NestConfig,
} from '@nest/shared';

const id = z.string().regex(ID_PATTERN, 'must be 1-64 characters of letters, digits, "-" or "_"');
const hexColor = z.string().regex(HEX_COLOR_PATTERN, 'must be a six-digit hex color like #C6F277');
const httpUrl = (max = LIMITS.url) =>
  z
    .string()
    .max(max)
    .refine(isValidHttpUrl, { message: 'must be an absolute http:// or https:// URL' });
const optionalHttpUrl = z.union([z.literal(''), httpUrl()]);

export const dashboardSchema = z.strictObject({
  title: z.string().trim().min(1, 'is required').max(LIMITS.title),
  subtitle: z.string().max(LIMITS.subtitle),
  theme: z.enum(['dark', 'light', 'system']),
  accentColor: hexColor,
  columns: z.union([z.literal('auto'), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  cardSize: z.enum(['compact', 'comfortable']),
  showSearch: z.boolean(),
  showFooter: z.boolean(),
  footerText: z.string().max(LIMITS.footerText),
  backgroundColor: z.union([z.literal(''), hexColor]),
  backgroundImageUrl: optionalHttpUrl,
  showEmptyGroups: z.boolean(),
});

export const groupSchema = z.strictObject({
  id,
  name: z.string().trim().min(1, 'is required').max(LIMITS.groupName),
});

export const serviceSchema = z.strictObject({
  id,
  name: z.string().trim().min(1, 'is required').max(LIMITS.serviceName),
  url: httpUrl(),
  description: z.string().max(LIMITS.serviceDescription),
  icon: z.enum(ICON_NAMES),
  iconUrl: optionalHttpUrl,
  groupId: z.union([id, z.null()]),
  enabled: z.boolean(),
  openInNewTab: z.boolean(),
});

export const configSchema = z
  .strictObject({
    version: z.literal(CONFIG_VERSION),
    dashboard: dashboardSchema,
    groups: z.array(groupSchema).max(LIMITS.maxGroups),
    services: z.array(serviceSchema).max(LIMITS.maxServices),
  })
  .superRefine((config, ctx) => {
    const groupIds = new Set<string>();
    config.groups.forEach((group, index) => {
      if (groupIds.has(group.id)) {
        ctx.addIssue({ code: 'custom', path: ['groups', index, 'id'], message: `duplicate group id "${group.id}"` });
      }
      groupIds.add(group.id);
    });

    const serviceIds = new Set<string>();
    config.services.forEach((service, index) => {
      if (serviceIds.has(service.id)) {
        ctx.addIssue({ code: 'custom', path: ['services', index, 'id'], message: `duplicate service id "${service.id}"` });
      }
      serviceIds.add(service.id);
      if (service.groupId !== null && !groupIds.has(service.groupId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['services', index, 'groupId'],
          message: `unknown group "${service.groupId}"`,
        });
      }
    });
  });

export type ValidationResult = { ok: true; config: NestConfig } | { ok: false; message: string };

/** Validates an arbitrary value against the configuration schema. */
export function validateConfig(value: unknown): ValidationResult {
  const result = configSchema.safeParse(value);
  if (result.success) return { ok: true, config: result.data as NestConfig };
  const details = result.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.length ? issue.path.join('.') : 'config'}: ${issue.message}`)
    .join('; ');
  return { ok: false, message: details || 'invalid configuration' };
}
