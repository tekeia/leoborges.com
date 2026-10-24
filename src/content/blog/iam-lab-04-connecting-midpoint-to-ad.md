---
title: "IAM Lab #4: Connecting midPoint to Active Directory"
date: 2026-10-17
description: "Creating an Active Directory resource in midPoint with the AD LDAP connector and defining the account object type."
series: "IAM Lab"
part: 4
project: midpoint-identity-lab
tags: ["IAM", "midPoint", "Active Directory"]
---

With the domain prepared and a service account ready, it's time to connect midPoint to Active Directory. In midPoint, every system it manages is called a **resource**. This post covers creating the AD resource and defining which AD objects count as accounts.

## Choosing the connector

In midPoint, go to **Resources → New resource → From scratch**. The resource catalog lists the available connectors:

- **LdapConnector** works with any LDAP directory.
- **AdLdapConnector** is built for Active Directory and understands AD specifics, like how accounts are enabled and disabled and how AD handles passwords and groups.

For AD, I picked **AdLdapConnector**.

## Connection settings

| Setting | Value |
| --- | --- |
| Host | the DC's IP address |
| Port | `389` |
| Connection security | `none` |
| Bind DN | `CN=svc-midpoint,OU=Service Accounts,OU=Lab,DC=dc,DC=whitebox,DC=lan` |
| Bind password | the service account's password |

What these mean:

- **Port 389** is LDAP, the protocol midPoint uses to talk to AD. Port 636 is LDAPS, the encrypted version, which needs a certificate on the DC. Reading users works fine over 389 in a lab; creating accounts and setting passwords will need LDAPS later, because AD refuses password changes over an unencrypted connection.
- **Bind** is LDAP's word for logging in. The **bind DN** is the username for that login, written as a full Distinguished Name. midPoint can only see and change what this account is allowed to.

## Base context

After connecting, midPoint discovered the domain's partitions and offered them as options for the **base context**, the starting point in the AD tree where midPoint searches. I chose the domain root:

```
DC=dc,DC=whitebox,DC=lan
```

The other options (`CN=Configuration`, `CN=Schema` and the `DnsZones` entries) are AD's internal data, not users. Individual OUs don't appear in this list; narrowing midPoint down to a specific OU happens later, per object type.

## Schema

Active Directory has hundreds of object classes. On the schema step, I selected only the three I need:

- `user` for user accounts
- `group` for groups
- `organizationalUnit` for OUs

Fewer classes means a smaller schema and a cleaner setup.

## Defining the account object type

With the resource created, midPoint still doesn't know which AD objects are accounts. That's what an **object type** defines. Under **Schema handling → Object types**, I added one:

| Field | Value |
| --- | --- |
| Display name | `AD Account` |
| Kind | `Account` |
| Intent | `default` |
| Default | `True` |
| Object class | `user` |
| Type (midPoint data) | `User` |
| Archetype | none |

- **Kind = Account** tells midPoint these are user accounts, as opposed to groups or other entitlements.
- **Intent** labels a sub-type of account. With a single account type, `default` is the convention.
- **Type = User** links each AD account to a person (a User object) in midPoint.
- An **archetype** would be a sub-type of user, like Employee or Contractor. I don't need one yet.

## Simulation mode

New resources start in the **Proposed (simulation)** lifecycle state. While a resource is Proposed, midPoint only simulates changes: it shows what it would do without writing anything. That's a good safety net while setting things up.

## What's next

Next post: inbound mappings, correlation and synchronization rules, and importing the AD users into midPoint.
