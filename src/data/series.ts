// Lab series a blog post can belong to (the `series` field in post frontmatter).
// To start a new series, add its name here and an entry in seriesInfo below.
export const SERIES = ['IAM Lab', 'Federation Lab', 'Cloud Lab', 'Security Lab'] as const;

// Display info for each lab series. Keys must match SERIES above.
export const seriesInfo: Record<string, { description: string; project?: string }> = {
  'IAM Lab': {
    description:
      'Building an identity governance lab at home: HR as the source of truth, midPoint, Active Directory, and the protocols in between.',
    project: 'midpoint-identity-lab',
  },
  'Federation Lab': {
    description:
      'Single sign-on from the inside: SAML, OpenID Connect and OAuth 2.0 in my own Keycloak, read at the protocol level.',
    project: 'sso-federation-lab',
  },
  'Cloud Lab': {
    description:
      'Extending the lab into the cloud: hybrid identity with Entra ID, Azure administration, and infrastructure as code with Terraform.',
    project: 'hybrid-identity-entra',
  },
  'Security Lab': {
    description:
      'Monitoring and defending the lab: Wazuh as SIEM and XDR, identity attack detection, and the other security tools I deploy along the way.',
    project: 'wazuh-detection-lab',
  },
};

export const seriesSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');
