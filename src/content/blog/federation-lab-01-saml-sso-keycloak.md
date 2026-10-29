---
title: "Federation Lab #1: SAML SSO between two Keycloak realms"
date: 2026-10-29
description: "I built a SAML IdP and SP inside my own Keycloak, hit 'Invalid requester' and 'Invalid signature', and fixed both by reading the actual XML."
series: "Federation Lab"
part: 1
project: sso-federation-lab
tags: ["IAM", "SAML", "Keycloak", "SSO"]
---

At work I manage SSO every day, but always from the admin console of a finished product. I wanted to see what actually happens on the wire, so I built both sides of a SAML login myself, in a Keycloak instance running in my homelab.

## The setup

Keycloak 26 runs in a Debian 12 LXC container on Proxmox, backed by MariaDB. Instead of wiring it to a real SaaS app, I used two realms to play both roles:

| Role | Realm | Real-world equivalent |
|---|---|---|
| Identity Provider (IdP) | `homelab` | Okta, Entra ID, PingFederate |
| Service Provider (SP) | `app` | Salesforce or any SAML app |

The user `leo` lives only in `homelab`. The goal: open the `app` realm, get redirected to `homelab` to log in, and come back authenticated, without `app` ever seeing my password.

<!-- screenshot: two realms in the Keycloak realm selector -->

## Wiring the two sides

**On the SP side (`app` realm):** I added a SAML v2.0 identity provider with the alias `homelab-idp` and pointed it at the IdP's metadata descriptor:

```
http://<keycloak-host>:8080/realms/homelab/protocol/saml/descriptor
```

That one URL gives the SP everything it needs to trust the IdP: its Entity ID, its SSO endpoint, and its signing certificate.

**On the IdP side (`homelab` realm):** I created a SAML client whose Client ID is the SP's Entity ID (`http://<keycloak-host>:8080/realms/app`), and set the valid redirect URI to the SP's Assertion Consumer Service (ACS) endpoint:

```
http://<keycloak-host>:8080/realms/app/broker/homelab-idp/endpoint
```

To watch the traffic, I installed the **SAML-tracer** browser extension, then started an SP-initiated login from the `app` realm's account page.

## Error 1: "Invalid requester"

The first attempt stopped at the IdP with *Invalid requester*.

The cause: by default, the SAML client in `homelab` required the incoming AuthnRequest to be **signed**, but the `app` realm wasn't signing it. The IdP refused a request it couldn't verify.

**Fix:** in the client's *Keys* tab, I turned off **Client signature required**. In production I'd rather configure the SP to sign its requests, but for the lab this isolated the next problem.

## Error 2: "Invalid signature in response from identity provider"

Now the login at the IdP worked, but the SP rejected the response with a 400 on the ACS endpoint. The Keycloak log showed:

```
type=IDENTITY_PROVIDER_RESPONSE_ERROR, realmId=app, error=invalid_signature
```

This is where SAML-tracer paid off. I opened the `SAMLResponse` and looked at the signature block. The `<dsig:Reference URI="...">` pointed to the ID of the **Response** element, not the **Assertion**.

In other words: the IdP signed the envelope, but not the assertion inside it. The SP was configured to require a signed **assertion**, so it rejected the whole thing.

<!-- screenshot: SAML-tracer showing the Reference URI pointing at the Response ID -->

**Fix:** in the `homelab` client settings, under *Signature and Encryption*, I turned on **Sign assertions**. The next login went through end to end.

## What I actually learned

The thing I kept getting wrong before this lab was *who signs what*. Now it's clear:

1. The IdP authenticates the user and builds an **assertion** (who the user is, attributes, validity window, intended audience).
2. The IdP **signs the assertion with its private key**.
3. The browser posts it to the SP's ACS URL.
4. The SP verifies the signature with the IdP's **public certificate**, which it already has from the metadata. The certificate doesn't travel with the login; it was exchanged up front.
5. If the signature checks out, the SP creates a session.

The analogy that made it click for me: the assertion is a check, the signature is the handwriting on it, and the certificate is the signature card the bank keeps on file.

The bigger lesson is about troubleshooting. Both errors had vague UI messages. Both were solved by reading the actual protocol traffic. "Response signed vs. assertion signed" is the kind of detail that shows up in real production incidents, and now I know where to look.

## Next

The next post covers OIDC: same Keycloak, a new client, and a look inside the ID token, access token, and refresh token.
