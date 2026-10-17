---
title: "IAM Lab #5: Importing Active Directory users into midPoint"
date: 2026-10-17
description: "Inbound mappings, correlation, synchronization reactions, limiting the scope with an XML edit, and importing AD accounts as midPoint users."
---

With the AD resource and the account object type in place, midPoint can see the accounts but doesn't yet know what to do with them. In this post I configure the rules that turn AD accounts into midPoint users, limit midPoint to the Employees OU, and run the import.

All of this is on the resource, under **Schema handling → Object types → AD Account**.

## Inbound mappings

Mappings define which AD attribute fills which midPoint field. **Inbound** means data flows from AD into midPoint.

| Name | From resource attribute | Expression | Target |
| --- | --- | --- | --- |
| `sAMAccountName-name` | `sAMAccountName` | As is | `name` |
| `givenName` | `givenName` | As is | `givenName` |
| `sn-familyName` | `sn` | As is | `familyName` |
| `cn-fullName` | `cn` | As is | `fullName` |
| `mail` | `mail` | As is | `emailAddress` |
| `department-OU` | `department` | As is | `organizationalUnit` |

AD and midPoint use different names for the same data:

- `sAMAccountName` is the AD username (`ASouza`), and it becomes the midPoint user's unique `name`.
- `sn` is short for *surname* and `cn` for *common name* (the full name, "Ana Souza").

Watch out for the attribute called just `name` in AD. It's not the username; it holds the object's display name ("Ana Souza"). Picking it instead of `sAMAccountName` as the source for the midPoint `name` gives users like "Ana Souza" instead of `ASouza`.

## Correlation

Correlation is how midPoint decides whether an AD account belongs to a user that already exists. I added one rule, **Main Correlation**, with a single item: **`name`**.

In plain words: if the value produced by the `sAMAccountName → name` mapping matches an existing midPoint user's `name`, they're the same person.

In a fresh lab every account is new, but correlation matters in real deployments, where thousands of AD accounts already exist before the IAM system arrives. It's also what prevents duplicates if the import runs twice.

## Synchronization reactions

Every account midPoint processes lands in a **situation**, and each situation gets a **reaction**:

| Situation | Meaning | Reaction |
| --- | --- | --- |
| Unmatched | No midPoint user matches this account | Add focus (create the user) |
| Unlinked | A matching user exists but isn't connected yet | Link |
| Linked | Already connected | Synchronize |

"Focus" is midPoint's word for the object an account belongs to, in this case the user.

## Limiting midPoint to the Employees OU

When I first created the resource, the connector's base context was the whole domain (`DC=dc,DC=whitebox,DC=lan`), because the wizard only offered the domain's top-level partitions. That meant midPoint could see every account in AD: built-in accounts like `Administrator`, `Guest` and `krbtgt`, the service account, and even the domain controller's computer account (in AD, computers are a kind of `user` object).

midPoint has two places where the search scope can be set:

- **Connector base context:** the outer limit for everything the resource can see.
- **Object type base context (delineation):** narrows the search per object type, useful when one connection serves several types, like employees in one OU and groups in another.

With a single object type, the connector-level setting is the simplest. The wizard didn't let me type an OU there, so I changed it in the resource's XML.

On the resource page, **Edit raw** opens the full resource definition. Everything in midPoint is stored as XML, and the GUI is an editor on top of it. In the connector configuration section, I found the base context:

```xml
<cfg:baseContext>DC=dc,DC=whitebox,DC=lan</cfg:baseContext>
```

and changed the value to the Employees OU:

```xml
<cfg:baseContext>OU=Employees,OU=Lab,DC=dc,DC=whitebox,DC=lan</cfg:baseContext>
```

The `cfg:` prefix belongs to the connector configuration namespace; only the value between the tags changes. After saving, **Test connection** makes midPoint reconnect with the new setting.

For reference, the per-object-type version lives inside the object type's `delineation` block. It points at the container's object class and picks the OU by its DN:

```xml
<delineation>
    <objectClass>ri:user</objectClass>
    <baseContext>
        <objectClass>ri:organizationalUnit</objectClass>
        <filter>
            <q:text xmlns:q="http://prism.evolveum.com/xml/ns/public/query-3">attributes/dn = "OU=Employees,OU=Lab,DC=dc,DC=whitebox,DC=lan"</q:text>
        </filter>
    </baseContext>
</delineation>
```

- `ri:` refers to object classes from the resource's own schema (AD's `user` and `organizationalUnit`).
- `q:` is midPoint's query language, and `attributes/dn = "..."` is a query that selects the OU.

## Resource objects vs. Accounts

After the change, two screens showed different results:

- **Resource objects** queries AD live, so it immediately showed only the three Employees accounts.
- **Accounts** shows **shadows**: records midPoint keeps in its own database for every account it has seen. Records from before the scope change were still listed.

Shadows let midPoint track accounts and their links to users without querying AD every time. To clean up the old ones, I unlinked and deleted the midPoint users that came from out-of-scope accounts, then removed the leftover shadows under **Repository objects**. Deleting there removes only midPoint's record. The **Delete** action in the resource's Accounts tab is different: it deletes the account in AD itself.

## Lifecycle state and import

New resources start in **Proposed (simulation)**, where imports only show what would happen. Once the rules looked right, I switched the resource's lifecycle state to **Active (production)**.

To import, in the **Accounts** tab with **AD Account** selected, I selected the accounts and used the **Import** action. Each account was **Unmatched**, so midPoint created a user for it and linked them. Running the import again on already-linked accounts triggers **Synchronize**, which re-applies the mappings and updates the users.

The result, in **Users → All users**:

| Name | Full name | Email |
| --- | --- | --- |
| ASouza | Ana Souza | ana.souza@whitebox.lan |
| BLima | Bruno Lima | bruno.lima@whitebox.lan |
| CMendes | Carla Mendes | carla.mendes@whitebox.lan |

Each user's **Projections** tab shows the linked AD account. That link is how midPoint knows who owns which account.

## What's next

Next post: handling leavers. Adding a reaction for deleted accounts and running a reconciliation to see midPoint react to changes in AD.
