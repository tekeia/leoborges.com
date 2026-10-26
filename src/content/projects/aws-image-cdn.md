---
title: "Secure Image Hosting on AWS"
summary: "Moving this site's images off GitHub into a private S3 bucket behind CloudFront, with least-privilege IAM, GitHub Actions OIDC instead of access keys, and CloudTrail watching it all."
status: off
tags: [Cloud, AWS, IAM, S3, CloudFront, OIDC, GitHub Actions]
stack: [AWS IAM Identity Center, Amazon S3, Amazon CloudFront, AWS IAM, GitHub Actions, AWS CloudTrail, AWS Certificate Manager]
featured: false
order: 4
---

## Goal

Stop committing images to the site's GitHub repo and serve them from AWS instead, built the way I'd want it built at work. Image hosting is the excuse; the real subject is cloud identity: human access, workload access, least privilege and audit.

## The plan

1. **Account hygiene first.** MFA on the root account, then stop using it. IAM Identity Center for my own admin login, and a budget alert of a few dollars so nothing surprises me.
2. **A private bucket.** Block Public Access stays on. CloudFront sits in front with Origin Access Control, and the bucket policy lets only that distribution read objects.
3. **Least privilege.** An IAM policy that allows `s3:PutObject` to one bucket and prefix, and nothing else. A chance to practice conditions and bucket policies properly.
4. **No long-lived keys.** GitHub Actions federates to AWS with OIDC and assumes a role with temporary credentials. The trust policy is pinned to this repo and branch, not a wildcard.
5. **Visibility.** CloudTrail on, with S3 data events so object uploads show up, not just bucket changes. Later, ship the logs to [Wazuh](/projects/wazuh-detection-lab) in the homelab.
6. **Custom domain.** Images served from `img.leoborges.com` with an ACM certificate.

Write-ups will be published in the Cloud Lab series and linked here.
