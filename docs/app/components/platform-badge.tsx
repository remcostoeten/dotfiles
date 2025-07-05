interface PlatformBadgeProps {
  platform: 'linux' | 'macos' | 'cross-platform';
  className?: string;
}

const platformIcons = {
  linux: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00.04.14c.757 3.909 3.609 2.219 3.609 2.219 1.24-1.16 1.65-2.777 1.65-2.777.156.584.556 1.08 1.145 1.372.191.094.365.172.483.234.428.238.666.425.666.425.31-.827.694-1.853 1.297-2.49.603-.637 1.838-1.263 2.553-1.899.715-.636 1.799-2.266 2.553-3.905.754-1.639.559-4.555.559-4.555-.08-2.718-1.39-4.86-3.27-5.645C14.611.4 13.108.054 12.504 0z"/>
    </svg>
  ),
  macos: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  ),
  'cross-platform': (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  ),
};

const platformLabels = {
  linux: 'Linux',
  macos: 'macOS',
  'cross-platform': 'Cross Platform',
};

export function PlatformBadge({ platform, className = '' }: PlatformBadgeProps) {
  return (
    <span className={`platform-badge ${platform} ${className}`}>
      {platformIcons[platform]}
      {platformLabels[platform]}
    </span>
  );
}
