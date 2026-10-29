---
title: "SSO & Federation Lab"
summary: "Building both sides of single sign-on in my own Keycloak: SAML between an IdP and an SP, OIDC and OAuth 2.0 tokens, and reading the protocol traffic to understand who signs what."
status: active
tags: [IAM, SSO, SAML, OIDC, OAuth 2.0, Keycloak]
stack: [Keycloak, MariaDB, Debian, Proxmox, Postman, SAML-tracer, jwt.io]
featured: false
order: 1
started: 2026-10-29
---

## Goal

At work I manage SSO and API tokens from the admin consoles of finished products. In this lab I build both sides myself, so I understand what actually travels between the identity provider, the application and the browser, and how to troubleshoot it when it breaks.

## Setup

- **Keycloak 26** in a Debian 12 LXC container on Proxmox, backed by MariaDB
- Two realms playing both roles: `homelab` as the identity provider, `app` as the service provider
- **SAML-tracer** to read SAML traffic, **jwt.io** to read OIDC and OAuth tokens, **Postman** as the OAuth client

## What's working so far

- SP-initiated SAML SSO between the two realms, with signed assertions
- The OAuth 2.0 authorization code flow with OIDC, returning ID, access and refresh tokens

## Next

- A small Flask app that requests tokens, and a tiny API that validates them
- An ESP32 display that signs in with the OAuth Device Authorization Grant

The write-ups are in the Federation Lab series below.
