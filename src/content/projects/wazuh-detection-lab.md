---
title: "Wazuh Detection Lab"
summary: "Deploying Wazuh as the lab's SIEM and XDR to monitor the identity stack: Active Directory, Windows endpoints and Linux servers, with detections for identity attacks."
status: Planned
tags: [Security Operations, Wazuh, SIEM, Detection, Active Directory, Homelab]
stack: [Wazuh, Windows Server, Active Directory, Ubuntu Server, Proxmox]
featured: false
order: 5
---

## Goal

Add visibility to the lab. The identity systems I'm building are exactly what attackers go after, so the next step is watching them: collecting logs, detecting suspicious activity, and responding to it.

## Plan

- Deploy the Wazuh server (indexer, manager and dashboard) on its own VM in Proxmox
- Install agents on the domain controller, the Windows 11 workstation and the Linux servers
- Collect Windows Security events from Active Directory: logons, account changes, group membership changes
- Build detections for identity attacks, such as password spraying, brute force and privileged group changes
- Use file integrity monitoring and vulnerability detection on the lab servers
- Later: pull in Entra ID sign-in logs once the hybrid identity lab is running

Write-ups will be published in the Security Lab series and linked here.
