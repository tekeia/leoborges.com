---
title: "PAM Lab #1: Automating service accounts with AD and Secret Server"
date: 2026-11-04
description: "I wrote a PowerShell script that creates an AD service account, stores a generated password in Secret Server through its REST API, and only enables the account once the secret exists. No human ever sees the password."
series: "PAM Lab"
part: 1
tags: ["IAM", "PAM", "Delinea", "Secret Server", "Active Directory", "PowerShell", "OAuth 2.0", "Non-human identity"]
---

Creating a service account used to be a checklist at work: create the AD account, add it to its groups, generate a password, paste it into Secret Server, enable the account. Every step was manual, and the password passed through a person, a clipboard, and probably a Notepad window.

So I automated it. One PowerShell script now does the whole thing, and the password never shows up on screen.

## What the script does

1. **Validates the basics**: the target OU and the required group exist before anything is created.
2. **Asks for and validates the input**: full name, `sAMAccountName` (20 characters max, letters, numbers, `.`, `_` and `-` only), the account's purpose, and whether it needs an O365 license. It also checks that the account doesn't already exist.
3. **Authenticates to Secret Server** with OAuth 2.0 and gets an access token.
4. **Generates a 25-character password** that's guaranteed to include each character type.
5. **Creates the AD account disabled**, with the password set to never expire and the user unable to change it, then adds it to its groups.
6. **Creates the secret** in Secret Server through the REST API, in the right folder, using the Active Directory Account template.
7. **Enables the account only after the secret exists.**
8. **Verifies** the result and prints a summary. The password is never displayed.

## The one design rule: no secret, no enabled account

The most important decision is the order of steps 5 to 7. The account is born disabled and stays that way until Secret Server confirms the secret was created.

If anything fails in between, the `catch` block warns that the account exists but its secret doesn't, and that it was left disabled on purpose. You never end up with a live account whose password nobody has.

```powershell
if (($null -ne $NewAccount) -and (-not $SecretCreated)) {
    Write-Warning (
        "The AD account may have been created, but the Secret was not " +
        "created. The account was intentionally left disabled."
    )
}
```

## Talking to the Secret Server API

Two calls do the work. First, get a token from the OAuth endpoint:

```powershell
$TokenResponse = Invoke-RestMethod `
    -Uri "$SecretServerUrl/oauth2/token" `
    -Method Post `
    -ContentType "application/x-www-form-urlencoded" `
    -Body @{
        grant_type = "password"
        username   = $Credential.UserName
        password   = $PlainCredentialPassword
    }
```

Then create the secret with `POST /api/v1/secrets`. The body references the template and folder IDs, and an `items` array maps each template field (domain, username, password, notes) to its value:

```powershell
$SecretBody = @{
    name             = $SecretName
    secretTemplateId = $TemplateId
    siteId           = $SiteId
    folderId         = $FolderId

    # Inherit the folder's permissions
    enableInheritPermissions  = $true
    enableInheritSecretPolicy = $true

    # Don't trigger a password change during creation
    autoChangeEnabled = $false
    changePasswordNow = $false

    items = @(
        @{ fieldId = $DomainFieldId;   itemValue = $Domain   },
        @{ fieldId = $UsernameFieldId; itemValue = $Username },
        @{ fieldId = $PasswordFieldId; itemValue = $Password },
        @{ fieldId = $NotesFieldId;    itemValue = $Notes    }
    )
}
```

The secret's notes record the purpose, the UPN, who ran the script, and when.

At the end, a `finally` block sets every sensitive variable (the password, the token, the credential, the request bodies) to `$null` and forces a garbage collection.

## Why it uses my credentials, not a service account

I could have given the script its own account to authenticate to Secret Server. I chose to make the operator sign in with their own AD credentials instead. That way, Secret Server's audit log shows **who** created each secret, and people can only create secrets where they already have permission. Ownership stays with the person running the process.

The trade-off is real, though. The `password` grant means the script handles the user's password in memory, and that flow usually doesn't support MFA. If I rebuilt the authentication, I'd look for an interactive OAuth flow (authorization code or device code) to keep the operator's identity *and* get MFA.

## The bugs (there were a few)

None of them were exotic, but each one taught me something:

- **`[string]::` was missing.** Several checks read `IsNullOrWhiteSpace($FullName)` instead of `[string]::IsNullOrWhiteSpace($FullName)`. PowerShell then treats `IsNullOrWhiteSpace` as a command name and fails with *"The term ... is not recognized as the name of a cmdlet"*. The error appeared right after the first prompt, which pointed straight at the first check.
- **The error showed up in the wrong place.** After the fixes, the script failed with *"The operation being requested was not performed because the user has not been authenticated"* right after printing *"Enabling the service account..."*. It looked like `Enable-ADAccount` was failing, but the account was actually enabled. The real culprit was the next block, the verification step, which runs without printing anything first. **Lesson: print a line before every step, or the last message you see will lie to you.**
- **`Get-ADPrincipalGroupMembership` is unreliable.** It threw that authentication error even though every other AD cmdlet worked. I replaced it with the user's `MemberOf` property:

  ```powershell
  $CreatedGroups = $CreatedAccount.MemberOf |
      ForEach-Object { Get-ADGroup -Identity $_ } |
      Sort-Object Name
  ```

- **Typos in parameter names.** `-Idenitity` and `PasswordChangeNeverExpires` don't exist. PowerShell's error (*"A parameter cannot be found that matches parameter name 'Idenitity'"*) at least tells you exactly what's wrong.

## What's next: request it from SailPoint

Right now the script is interactive and run by an admin. The next version will start from a request in **SailPoint Identity Security Cloud**:

1. A **form** collects the account details, with regex validation on the name.
2. A **workflow** sends it for **approval**.
3. The workflow creates the AD account through the **ISC API**, disabled.
4. It creates the secret through the **Secret Server API** with `changePasswordNow = true`, so Secret Server sets the password on the account itself, using its own privileged account.
5. The workflow enables the account.

In that design, the password never passes through the workflow or a person at all. Secret Server generates it and sets it directly. Ownership moves from "who ran the script" to "who requested it and who approved it," which is a much better audit trail. I'll build it in our dev tenant first.

## What I took from it

This started as "save myself some clicks" and turned into a lesson in **non-human identity** governance. Service accounts are easy to create and easy to forget, and the risky part is almost never the account itself. It's the password nobody tracks and the owner nobody remembers. Automating the process forces those questions to be answered every time.
