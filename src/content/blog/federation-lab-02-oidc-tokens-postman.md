---
title: "Federation Lab #2: Getting OIDC tokens from Keycloak with Postman"
date: 2026-10-29
description: "I ran the OAuth 2.0 authorization code flow against my own Keycloak, decoded the ID, access, and refresh tokens, and finally understood why there are three."
series: "Federation Lab"
part: 2
project: sso-federation-lab
tags: ["IAM", "OIDC", "OAuth 2.0", "Keycloak", "JWT"]
---

I use OAuth tokens at work almost every day: Postman, a client ID, a secret, a Bearer token, call the SailPoint API. But I'd never seen a full **OpenID Connect** login where a person signs in and gets an ID token back. So I set one up in the same Keycloak I used for the [SAML lab](/blog/federation-lab-01-saml-sso-keycloak).

## OAuth 2.0 vs. OIDC in one paragraph

**OAuth 2.0** is about *authorization*: it gives a client an **access token** to call an API. **OIDC** is a thin layer on top of OAuth that adds *authentication*: it also returns an **ID token** that says who the user is. What turns an OAuth request into an OIDC request is the scope `openid`.

That also explained my day job: with SailPoint I use the **client credentials** grant. No human logs in, so there's no ID token. That's plain OAuth, not OIDC.

## The client

In the `homelab` realm I created an OpenID Connect client called `oidc-test`:

- **Client authentication:** on (so it gets a client secret, a confidential client)
- **Standard flow:** on (the authorization code flow)
- **Valid redirect URI:** `https://oauth.pstmn.io/v1/callback`, Postman's own callback

## Finding the endpoints

Every OIDC provider publishes its configuration at a well-known URL:

```
http://<keycloak-host>:8080/realms/homelab/.well-known/openid-configuration
```

It's the JSON equivalent of SAML metadata. From it I needed two values:

- `authorization_endpoint` → Postman's **Auth URL**
- `token_endpoint` → Postman's **Access Token URL**

## The Postman setup

New request → *Authorization* → **OAuth 2.0** → *Configure New Token*:

| Field | Value |
|---|---|
| Grant type | Authorization Code |
| Authorize using browser | checked |
| Auth URL | `authorization_endpoint` |
| Access Token URL | `token_endpoint` |
| Client ID | `oidc-test` |
| Client Secret | from the client's *Credentials* tab |
| Scope | `openid` |

Clicking *Get New Access Token* opens the Keycloak login page, I sign in as `leo`, the browser hands an authorization code back to Postman, and Postman exchanges that code for tokens at the token endpoint.

<!-- screenshot: Postman OAuth 2.0 configuration -->

## The mistakes (there were several)

None of these were exotic, but each taught me something:

- **The login URL opened a JSON page with a public key.** I had pasted the `issuer` into the Auth URL instead of the `authorization_endpoint`. The issuer is just the realm's base URL, and that's what it returns.
- **"Invalid username or password."** I had reset the user's password but never confirmed the save dialog. Also: after the SAML lab, Keycloak had created a *brokered copy* of `leo` in the `app` realm. Resetting that copy does nothing for the `homelab` login. Each realm has its own users.
- **`unauthorized_client: Invalid client credentials`.** The Postman console showed a 401 from the token endpoint. Over a few attempts the secret field had stray quotes, then the token URL pasted by accident, then a secret I had regenerated *after* copying it. Lesson: when the login works but the code exchange fails, it's the client credentials.

<!-- screenshot: Postman console with the 401 errors -->

## Looking inside the tokens

With the tokens in hand, I pasted each one into **jwt.io**. The `typ` claim tells you which is which:

| Token | `typ` | Audience | Purpose |
|---|---|---|---|
| ID token | `ID` | the client (`oidc-test`) | Tells the application **who logged in** |
| Access token | `Bearer` | the API / resource server | Sent to an API to say **what the client may do** |
| Refresh token | `Refresh` | Keycloak itself | Gets a new access token **without logging in again** |

Useful claims to read: `iss` (who issued it), `aud` (who it's for), `sub` (the user), `exp` (expiry), `preferred_username`.

The access token expired in about five minutes. That short life is deliberate: if it leaks, the damage window is small, and the refresh token handles renewal quietly.

## What clicked

The rule I'm keeping:

- **ID token (and a SAML assertion):** who are you?
- **Access token:** what can you access?
- **Refresh token:** keep going without logging in again.

And the access token is what goes in `Authorization: Bearer <token>` when calling an API. Never the ID token; it's meant for the app, not the API.

My toolkit for debugging SSO is now two tools: **SAML-tracer** for SAML and **jwt.io** for OIDC/OAuth.

## Next

Looking at tokens from the outside only goes so far. Next I want to build a small Flask app that requests tokens and a tiny API that validates them, and later an ESP32 display that logs in with the OAuth Device Authorization Grant.
