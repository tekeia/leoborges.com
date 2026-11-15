---
title: "Cloud Lab #1: Managing Okta with Terraform, and every error on the way"
date: 2026-11-15
description: "I tried to create one Okta group with Terraform using OAuth 2.0 client credentials and private_key_jwt. It took six errors to get there, and each one taught me a different step of the flow."
series: "Cloud Lab"
part: 1
tags: ["IAM", "Okta", "Terraform", "OAuth 2.0", "IaC"]
draft: false
---

At work I change Okta by clicking in the admin console. I wanted to try the other way: describe the configuration in code, run `terraform apply`, and let Terraform make the change. The goal for this first session was small, **one group**, created by Terraform in my Okta trial org.

The resource is five lines. Getting Terraform allowed to create it took most of a morning.

## Why not just an API token

The quick way to authenticate Terraform to Okta is an API token (the `SSWS` header). It works, but the token runs with the permissions of the admin who created it and doesn't expire on its own. That's not how I'd want a pipeline to talk to an identity provider at a bank.

The better way is an **API Services app** in Okta that authenticates with **OAuth 2.0 client credentials**, using a **private key** instead of a client secret (`private_key_jwt`). No person logs in. Terraform proves who it is with a signed JWT and gets a short-lived, scoped access token.

## The config

```hcl
terraform {
  required_providers {
    okta = {
      source  = "okta/okta"
      version = "~> 6.15"
    }
  }
}

provider "okta" {
  org_name       = "<org-name>"
  base_url       = "okta.com"
  client_id      = "<client-id>"
  private_key_id = "<kid>"
  private_key    = "C:/Users/<me>/okta/terraform_key.key"

  scopes = [
    "okta.groups.read",
    "okta.groups.manage",
  ]
}

resource "okta_group" "terraform" {
  name        = "Terraform-Lab-Group"
  description = "Group managed by Terraform"
}
```

In Okta: **Applications → Create App Integration → API Services**, public key / private key client authentication, and the public half of my key uploaded under *Client Credentials → Public Keys*.

<!-- screenshot: Okta API Services app, Client Credentials section -->

## What actually happens on `terraform apply`

This is the part I didn't understand until things broke. Before Terraform can touch a group, the provider goes through these steps:

```
1. Read the private key file
2. Parse the key
3. Build a JWT (iss = sub = client_id, aud = the token endpoint, exp = now + 1h)
   and sign it with the private key; the header carries the kid
4. POST it to /oauth2/v1/token with grant_type=client_credentials
5. Okta checks the signature, kid, exp, scopes, DPoP → returns an access token
6. POST /api/v1/groups with "Authorization: Bearer <token>"
   → Okta checks the token's scope AND the app's admin role
```

Every error I hit maps to one of those steps.

## The errors

### "empty access token" (step 5)

This was the first error and it stayed for a long time. It's not Okta's message. It's the provider saying *Okta didn't give me a token*, while hiding the reason why.

The fix for that is debug logging, which I should have done first:

```powershell
$env:TF_LOG="DEBUG"; terraform apply -auto-approve 2> tf-debug.log; Remove-Item Env:TF_LOG
Select-String tf-debug.log -Pattern "error_description|invalid_" -Context 0,3
```

That shows Okta's real response from the token endpoint. Behind "empty access token" there turned out to be four different problems:

- **DPoP was on.** New API Services apps have *Require Demonstrating Proof of Possession (DPoP) header in token requests* checked by default. The Terraform provider doesn't send a DPoP header, so every token request was refused. Unchecked it.
- **One scope wasn't granted.** `okta.groups.manage` was granted on the *Okta API Scopes* tab, but `okta.groups.read` wasn't. If even one requested scope isn't granted, Okta refuses the whole token request. Listing a scope in Terraform doesn't grant it.
- **"The client_assertion token has an expiration too far into the future."** Provider 7.1.0 sets the JWT's `exp` to exactly one hour, and Okta wants *less than* one hour from its own clock. If your machine's clock is even a fraction of a second ahead, it fails. Syncing the Windows clock wasn't enough. Moving to provider **6.15** made it go away.
- **"The client_assertion JWT kid is invalid."** The `private_key_id` in my config didn't match an active key on the app. I copied the KID from Okta with the copy button and it passed.

<!-- screenshot: debug log with the error_description -->

### "invalid private key" (step 2)

Halfway through I thought the key format was the problem and converted it from PKCS8 (`BEGIN PRIVATE KEY`) to PKCS1 (`BEGIN RSA PRIVATE KEY`):

```powershell
openssl rsa -in terraform_key.key -out terraform_key_pkcs1.key -traditional
```

(Two small lessons there: OpenSSL on Windows doesn't expand `~` in paths, and OpenSSL 3 keeps writing PKCS8 unless you add `-traditional`.)

The new error was actually good news. With PKCS1 the provider failed **on my machine** at step 2, before it even contacted Okta. With PKCS8 it had been getting all the way to step 5. So the original key was fine. I switched back to it.

### "You do not have permission to perform the requested action" (step 6)

The first error that came from the Groups API instead of the token endpoint, which meant authentication finally worked. The token had the right scope, but **scopes aren't enough**: an API Services app also needs an **admin role**, assigned on the app's *Admin roles* tab. With Super Administrator assigned, `terraform apply` created the group.

<!-- screenshot: Terraform-Lab-Group in Directory → Groups -->

## The checklist I'd use next time

| Check | Where in Okta | Error if wrong |
|---|---|---|
| DPoP unchecked | General → Client Credentials | empty access token |
| Public key / private key auth | General → Client Credentials | empty access token (`invalid_client`) |
| KID matches an **active** key | General → Public Keys | `kid is invalid` |
| Every requested scope **Granted** | Okta API Scopes | empty access token |
| Admin role assigned | Admin roles | 403 permission error |
| Key is PKCS8 | your key file | invalid private key |

And: turn on `TF_LOG=DEBUG` the first time you see "empty access token" instead of guessing.

## What's next

- **Least privilege.** Super Admin is fine on a trial org, but it's not the answer. I want to test Group Administrator scoped to all groups, and then a custom role with only the group permissions.
- **GitHub Actions.** Run `plan` on every pull request and `apply` on merge, with an approval gate, so access changes go through review like code.
