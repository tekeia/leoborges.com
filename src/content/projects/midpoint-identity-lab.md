---
title: "midPoint Identity Governance Lab"
summary: "An HR-driven identity lifecycle built from scratch at home: OrangeHRM as the source of truth, midPoint for governance, and Active Directory as the target."
status: active
tags: [IAM, Identity Governance, midPoint, Active Directory, Homelab]
stack: [midPoint, OrangeHRM, Active Directory, Windows Server, Ubuntu Server, Docker, Proxmox, PowerShell]
featured: true
order: 1
started: 2026-10-16
---

## Goal

Build the identity lifecycle a real company runs, joiner, mover and leaver, using only free tools, so I understand provisioning from the design side and not just the admin console.

## Architecture

- **OrangeHRM** is the authoritative source: every identity starts as an employee record with an Employee ID.
- **midPoint** reads HR, correlates records to existing identities, and decides what accounts each person should have.
- **Active Directory** (`whitebox.lan`) is the first target system, with a dedicated OU structure and a least-privilege service account for midPoint.
- Everything runs as VMs on **Proxmox**.

## What's working so far

- midPoint running in Docker on Ubuntu Server
- AD resource with inbound mappings, correlation and synchronization reactions
- Initial import of AD accounts into midPoint, scoped to the Employees OU
- Scheduled reconciliation so midPoint picks up AD changes on its own
- OrangeHRM deployed as the HR source, with test employees ready for correlation and a first joiner

## Next

Connect midPoint to the HR database, switch the source of truth from AD to HR, then automate joiner, mover and leaver flows end to end.

The full build log is in the IAM Lab series below.
