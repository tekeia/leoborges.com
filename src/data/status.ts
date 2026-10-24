// Project status lights. `status` in a project's frontmatter must be one of these keys.
export const STATUSES = ['active', 'briefly-paused', 'hard-paused', 'abandoned', 'not-started'] as const;
export type Status = (typeof STATUSES)[number];

export const statusInfo: Record<Status, { label: string; meaning: string }> = {
  'active': { label: 'active', meaning: 'being worked on now' },
  'briefly-paused': { label: 'briefly paused', meaning: 'on hold for a bit, coming back soon' },
  'hard-paused': { label: 'hard paused', meaning: 'stopped for now, no return date' },
  'abandoned': { label: 'abandoned', meaning: "not coming back; kept for the record" },
  'not-started': { label: 'not started', meaning: 'on the roadmap, not powered on yet' },
};
