// Lab series a blog post can belong to (the `series` field in post frontmatter).
// To start a new series, add its name here and an entry in seriesInfo below.
export const SERIES = ['IAM Lab', 'Cloud Lab'] as const;

// Display info for each lab series. Keys must match SERIES above.
export const seriesInfo: Record<string, { description: string; project?: string }> = {
  'IAM Lab': {
    description:
      'Building an identity governance lab at home: HR as the source of truth, midPoint, Active Directory, and the protocols in between.',
    project: 'midpoint-identity-lab',
  },
  'Cloud Lab': {
    description:
      'Extending the lab into the cloud: hybrid identity with Entra ID, Azure administration, and infrastructure as code with Terraform.',
    project: 'hybrid-identity-entra',
  },
};

export const seriesSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');
