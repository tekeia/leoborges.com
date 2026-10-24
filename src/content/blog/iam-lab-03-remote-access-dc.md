---
title: "IAM Lab #3: SSH and Remote Desktop on the domain controller"
date: 2026-10-17
description: "Enabling OpenSSH and RDP on Windows Server so I can manage my lab DC from my own computer with copy and paste."
series: "IAM Lab"
part: 3
project: midpoint-identity-lab
tags: ["IAM", "Active Directory", "Windows Server"]
---

Typing long PowerShell commands into the Proxmox web console gets old fast, especially when copy and paste doesn't work. The fix is to stop using the console for daily work and connect to the domain controller directly from my computer.

There are two good options:

- **SSH** for a PowerShell terminal, fast and lightweight
- **RDP (Remote Desktop)** for the full Windows desktop and graphical tools

I enabled both. The commands below are the last ones I had to type into the Proxmox console.

## SSH isn't just for Linux

SSH is a protocol, not a Linux tool. Since Windows 10 and Windows Server 2019, Microsoft ships OpenSSH, the same open source SSH used on Linux. My Windows PC already has the SSH client built in; the server just needs the SSH server turned on.

## Step 1: Install and start the SSH server

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
```

- The first line installs the OpenSSH server (it downloads it, so the server needs internet access).
- The second starts it.
- The third makes it start automatically after a reboot.

Check that the firewall rule for port 22 exists:

```powershell
Get-NetFirewallRule -Name *ssh*
```

## Step 2: Make PowerShell the default shell

By default, an SSH session into Windows opens the old `cmd` prompt. This makes it open PowerShell instead:

```powershell
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell `
  -Value "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -PropertyType String -Force
```

## Step 3: Connect from my computer

From PowerShell, Windows Terminal or the VS Code terminal on my PC:

```
ssh administrator@dc.whitebox.lan@<DC-IP>
```

The part before the last `@` is the domain login, and the part after is the server's address. After the password, the prompt changes to `PS C:\Users\administrator>`: that's PowerShell running on the DC. Pasting commands works normally, and `exit` returns to my own PC.

## Step 4: Enable Remote Desktop

For graphical tools like Active Directory Users and Computers or Event Viewer, Remote Desktop is easier:

```powershell
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name fDenyTSConnections -Value 0
Enable-NetFirewallRule -DisplayGroup "Remote Desktop"
```

- The first line turns on Remote Desktop.
- The second opens it in the Windows firewall.

To connect: press **Win+R**, type `mstsc`, enter the DC's IP address and log in as `DC\Administrator`.

## Same command for every server

With SSH enabled on the DC, I now connect to both lab servers the same way:

```
ssh midpoint@<Ubuntu-IP>                        # Linux, opens bash
ssh administrator@dc.whitebox.lan@<DC-IP>       # Windows, opens PowerShell
```

I also keep all the PowerShell scripts for the lab saved on my computer, so I have a record of how everything was built and can run them again if I rebuild the DC.

## What's next

Next post: connecting midPoint to Active Directory.
