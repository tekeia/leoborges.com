---
title: "Hybrid Identity with Entra ID"
summary: "Syncing the lab's on-prem Active Directory to Microsoft Entra ID and securing cloud sign-in with Conditional Access."
status: off
tags: [Cloud, Azure, Entra ID, Active Directory, IAM]
stack: [Microsoft Entra ID, Entra Connect, Active Directory, Azure]
featured: true
order: 3
---

## Goal

Connect the lab's on-prem domain to the cloud the way most enterprises do, and learn the identity side of Azure administration along the way.

## Plan

- Add a routable UPN suffix (`lab.leoborges.com`) to the `whitebox.lan` domain
- Sync users and groups to Entra ID with Entra Connect
- Configure Conditional Access and MFA for cloud sign-in
- Assign Azure RBAC roles to synced groups

Write-ups will be published in the Cloud Lab series and linked here.
