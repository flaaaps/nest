import { DEFAULT_ICON, type Service } from '@nest/shared';
import { useEffect, useState } from 'react';
import { SERVICE_ICONS } from '../icons.ts';

interface Props {
  service: Pick<Service, 'icon' | 'iconUrl'>;
  size: number;
}

/** Renders a custom image when configured, falling back to the built-in icon if it fails to load. */
export function ServiceIcon({ service, size }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = service.iconUrl;

  useEffect(() => {
    setFailedUrl(null);
  }, [url]);

  if (url && failedUrl !== url) {
    return <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(url)} />;
  }
  const Icon = SERVICE_ICONS[service.icon] ?? SERVICE_ICONS[DEFAULT_ICON];
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
