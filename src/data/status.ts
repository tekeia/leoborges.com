// Project status lights. `status` in a project's frontmatter must be one of these keys.
export const STATUSES = ['active', 'briefly-paused', 'off', 'abandoned'] as const;
export type Status = (typeof STATUSES)[number];

export const statusInfo: Record<Status, { label: string; meaning: string }> = {
  'active': { label: 'active', meaning: 'being worked on now' },
  'briefly-paused': { label: 'briefly paused', meaning: 'on hold for a bit, coming back soon' },
  'off': { label: 'off', meaning: 'planned or stopped, not running right now' },
  'abandoned': { label: 'abandoned', meaning: 'not coming back; kept for the record' },
};
