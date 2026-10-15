export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M8 17h16a8 8 0 0 1-16 0z" fill="var(--accent-contrast)" />
      <circle cx="16" cy="11" r="3.5" fill="var(--accent-contrast)" />
    </svg>
  );
}
