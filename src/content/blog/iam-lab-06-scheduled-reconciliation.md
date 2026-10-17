---
title: "IAM Lab #6: Keeping midPoint in sync with scheduled reconciliation"
date: 2026-10-17
description: "Setting up a recurring reconciliation task so midPoint picks up changes in Active Directory automatically, and handling multi-valued attributes."
---

After the initial import, midPoint only knew what AD looked like at that moment. If someone's department changed in AD, midPoint wouldn't notice until I ran another import by hand. In this post I set up a scheduled reconciliation task so midPoint keeps up with AD on its own.

## Import, reconciliation and live sync

midPoint has three ways to bring changes in from a resource:

| Task | What it does | Typical use |
| --- | --- | --- |
| Import | Processes all accounts once | Initial load |
| Reconciliation | Compares every account with midPoint and fixes differences, including accounts that disappeared | Scheduled safety net, hourly or nightly |
| Live sync | Processes only what changed since the last run | Near real-time updates |

I went with reconciliation: it catches everything, and it's the easiest to reason about.

## Creating the reconciliation task

On the resource, in the **Accounts** tab with **AD Account** selected, the **Tasks** menu creates a new task. I picked **Reconciliation** and filled in:

| Setting | Value |
| --- | --- |
| Name | `AD Reconciliation` |
| Kind / Intent | `Account` / `default` |
| Execution mode | Full |
| Recurrence | Recurring |
| Interval | `3600` seconds (1 hour) |

For testing, a shorter interval like 300 seconds (5 minutes) is handy. The task then shows up under **Server tasks → All tasks**, where each run's results and any errors are visible, and **Run now** starts it immediately.

## Testing it

To test, I changed a user's department directly in AD, on the domain controller:

```powershell
Set-ADUser BLima -Department "Security"
Get-ADUser BLima -Properties Department | Select-Object SamAccountName, Department
```

Then I checked it in two places in midPoint:

- **Resource objects** queries AD live, so it showed the new department right away.
- The midPoint user only changes once reconciliation processes the account and the `department → organizationalUnit` inbound mapping runs.

For a single user, there's a shortcut: in **Users → All users**, the row menu has a **Reconcile** action that re-reads that user's linked accounts and re-applies the inbound mappings immediately.

## Multi-valued attributes

After reconciliation ran, Bruno's organizational unit showed **both** values, "IT" and "Security", instead of replacing the old one.

The reason: `organizationalUnit` in midPoint can hold several values. By default, midPoint doesn't assume one mapping owns all of them. The old value could have come from another source, like another resource, a role or a manual edit, so it adds the new value and keeps the old one.

Two settings help here:

- **Strength: Strong** makes midPoint always apply the mapping's value, even when it thinks nothing changed in the source.
- **Exclusive: true** marks the mapping as the only source allowed to provide values for its target. With that set, the AD value replaced the old one, and Bruno showed only "Security".

midPoint also has a **range** setting for mapping targets, which tells it to remove values the mapping no longer produces. It's set in the resource XML, inside the mapping's `<target>` block:

```xml
<target>
    <path>organizationalUnit</path>
    <set>
        <predefined>all</predefined>
    </set>
</target>
```

Exclusive works well while AD is the only source of department data. When an HR source is added later, the department rule will need to move there, or exclusive will need to come off, since an exclusive mapping doesn't allow a second mapping on the same target.

## How links work

Each midPoint user stores a reference to its accounts' **shadows**, the records midPoint keeps for each account it knows. Every shadow belongs to a specific resource.

When a resource is deleted, its shadows go with it, and users lose their links to those accounts. Recreating the resource with the same settings creates a new object with new shadows, so nothing points to them until an import runs. At that point, **correlation** matches each account to the existing user by `name`, the account lands in the **Unlinked** situation, and the **Link** reaction reconnects it. No duplicate users get created.

The same logic applies to accounts that move outside the connector's base context: to midPoint, an account it can no longer see looks the same as an account that was deleted.

## What's next

Next post: the leaver flow. Reacting to disabled and deleted accounts in AD.
