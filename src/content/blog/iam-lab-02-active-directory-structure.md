---
title: "IAM Lab #2: Preparing Active Directory for midPoint"
date: 2026-10-17
description: "Creating the OU structure, a service account for midPoint and test users in my lab domain with PowerShell."
series: "IAM Lab"
part: 2
project: midpoint-identity-lab
tags: ["IAM", "Active Directory", "PowerShell"]
---

With midPoint running, the next piece of the lab is Active Directory. midPoint needs something to manage, and AD is what most companies use. In this post I prepare the domain: an OU structure, a dedicated service account for midPoint, and a few test users.

My lab domain is `dc.whitebox.lan`, running on a Windows Server VM in Proxmox. Everything below runs in PowerShell as Administrator on the domain controller.

## How AD paths work

Every object in AD has a full address called a **Distinguished Name (DN)**. It's read from right to left, from the top of the tree down:

```
CN=Ana Souza,OU=Employees,OU=Lab,DC=dc,DC=whitebox,DC=lan
```

- `DC=dc,DC=whitebox,DC=lan` is the domain itself. Each part of the domain name between the dots becomes one `DC=` (domain component).
- `OU=Lab` is an organizational unit inside the domain.
- `OU=Employees` is an OU inside Lab.
- `CN=Ana Souza` is the user.

To avoid typing the domain part over and over, I store it in a variable:

```powershell
$base = "DC=dc,DC=whitebox,DC=lan"
```

## Step 1: Create the OU structure

I put everything under one top-level OU called `Lab`, which keeps my test objects separate from AD's built-in containers. It also makes permissions easier later: I can delegate rights to midPoint on `Lab` once, instead of on the whole domain.

```powershell
New-ADOrganizationalUnit -Name "Lab" -Path $base
New-ADOrganizationalUnit -Name "Employees"        -Path "OU=Lab,$base"
New-ADOrganizationalUnit -Name "Disabled"         -Path "OU=Lab,$base"
New-ADOrganizationalUnit -Name "Groups"           -Path "OU=Lab,$base"
New-ADOrganizationalUnit -Name "Service Accounts" -Path "OU=Lab,$base"
```

- **Employees:** active user accounts
- **Disabled:** where leavers are moved
- **Groups:** groups midPoint will manage
- **Service Accounts:** accounts used by applications

`-Path` tells PowerShell where in the tree to create each OU. Without it, objects land in the default containers.

## Step 2: Create a service account for midPoint

midPoint needs its own account to log in to AD. A dedicated service account means I control exactly what midPoint can see and change.

```powershell
$pw = Read-Host "Password for svc-midpoint" -AsSecureString
New-ADUser -Name "svc-midpoint" -SamAccountName "svc-midpoint" `
  -UserPrincipalName "svc-midpoint@dc.whitebox.lan" `
  -Description "Service account for midPoint" `
  -Path "OU=Service Accounts,OU=Lab,$base" `
  -AccountPassword $pw -Enabled $true -PasswordNeverExpires $true
```

`Read-Host -AsSecureString` asks for the password without showing it on screen or saving it in the command history.

The account's DN is what midPoint will use to log in:

```
CN=svc-midpoint,OU=Service Accounts,OU=Lab,DC=dc,DC=whitebox,DC=lan
```

## Step 3: Create test users

Three test employees, each with a department and an email address:

```powershell
$userPw = Read-Host "Password for test users" -AsSecureString
$users = @(
  @{First="Ana";   Last="Souza";  Dept="Finance"},
  @{First="Bruno"; Last="Lima";   Dept="IT"},
  @{First="Carla"; Last="Mendes"; Dept="HR"}
)
foreach ($u in $users) {
  $sam = $u.First.Substring(0,1).ToUpper() + $u.Last.Substring(0,1).ToUpper() + $u.Last.Substring(1).ToLower()
  New-ADUser -Name "$($u.First) $($u.Last)" -GivenName $u.First -Surname $u.Last `
    -SamAccountName $sam -UserPrincipalName "$sam@dc.whitebox.lan" `
    -EmailAddress "$($u.First.ToLower()).$($u.Last.ToLower())@whitebox.lan" `
    -Department $u.Dept -Path "OU=Employees,OU=Lab,$base" `
    -AccountPassword $userPw -Enabled $true
}
```

The username takes the first letter of the first name and the last name, both capitalized: Ana Souza becomes `ASouza`. AD logins are case-insensitive, so `asouza` still works when signing in; AD just displays the name the way it was set.

## Username, UPN and email are three different things

Each test user ends up with three identifiers that look alike but are stored in separate attributes:

| What | Example | AD attribute |
| --- | --- | --- |
| Username | `ASouza` (login as `DC\ASouza`) | `sAMAccountName` |
| User Principal Name | `ASouza@dc.whitebox.lan` | `userPrincipalName` |
| Email address | `ana.souza@whitebox.lan` | `mail` |

The UPN looks like an email address, but it's only a login name. The email address is a separate attribute used for mail delivery. In many companies they differ, which is why users often ask whether to log in with their email or their username.

## Step 4: Check the result

```powershell
Get-ADUser -Filter * -SearchBase "OU=Lab,$base" -Properties mail, Department |
  Select-Object Name, SamAccountName, UserPrincipalName, mail, Department
```

This lists `svc-midpoint` and the three test users. `-SearchBase` limits the search to the Lab OU, so built-in accounts don't show up.

## What's next

Next post: setting up SSH and Remote Desktop on the domain controller, so I can stop typing commands into the Proxmox console.
