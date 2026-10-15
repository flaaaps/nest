import { isValidHttpUrl, type DashboardSettings } from '@nest/shared';
import { accentContrast, resolveTheme } from './lib/dashboard.ts';

/** Applies dashboard appearance settings to the document root. */
export function applyAppearance(settings: DashboardSettings, prefersDark: boolean): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(settings.theme, prefersDark);
  root.style.setProperty('--accent', settings.accentColor);
  root.style.setProperty('--accent-contrast', accentContrast(settings.accentColor));

  if (settings.backgroundColor) root.style.setProperty('--bg', settings.backgroundColor);
  else root.style.removeProperty('--bg');

  if (settings.backgroundImageUrl && isValidHttpUrl(settings.backgroundImageUrl)) {
    // URL parsing percent-encodes quotes, so the value is safe inside url("...").
    root.style.setProperty('--bg-image', `url("${new URL(settings.backgroundImageUrl).href}")`);
    root.dataset.bgImage = 'true';
  } else {
    root.style.removeProperty('--bg-image');
    delete root.dataset.bgImage;
  }

  document.title = settings.title || 'NEST';
}
